from copy import deepcopy
from dataclasses import asdict
from pathlib import Path
import tempfile
from unittest import TestCase
from per_aspera.engine import Simulation,RuleError
from per_aspera.interruptions import Interruptions,classification,step_observed,interruption_text
from per_aspera.mission_contact import reply,DIALOGUE
from per_aspera.continuity import launch_context
from per_aspera.observation import Observation
from per_aspera.persistence import save,load,validate
from test_simulation import prepare_fixture


def active(crew_emergency=False):
    sim=Simulation.new(11)
    sim.state.mission_index=2
    prepare_fixture(sim)
    sim.advance_to_next()
    sim.launch()
    if crew_emergency:
        sim.state.flight['fuel']=1
    return sim


class MissionContactTests(TestCase):
    def test_only_unexpected_events_interrupt_and_types_are_explicit(self):
        for kind,title in (('phase','Recovery'),('launch','Liftoff'),('operations','Mission objective achieved')):
            self.assertEqual(classification({'kind':kind,'title':title}), '')
        self.assertEqual(classification({'kind':'operations','title':'Crew emergency abort','interruption':'observation'}),'observation')
        sim=Simulation.new(11)
        tracker=Interruptions.for_campaign(sim.briefing())
        sim.delegate(spending_limit=1,hours_limit=1)
        tracker.ingest(sim.briefing()['history'])
        self.assertEqual(tracker.current['interruption'],'action_required')
        self.assertTrue(any(not decision['resolved'] for decision in sim.state.decisions))

    def test_observation_pause_stops_at_event_and_resumption_is_neutral(self):
        sim=active(True)
        reference=Simulation(deepcopy(sim.state))
        tracker=Interruptions.for_campaign(sim.briefing())
        step_observed(sim,200,tracker)
        self.assertEqual(tracker.current['interruption'],'observation')
        self.assertEqual(tracker.current['actor'],'Crew Commander')
        self.assertTrue(sim.state.flight['aborted'])
        before=asdict(sim.state)
        self.assertFalse(step_observed(sim,100,tracker))
        tracker.ingest(sim.briefing()['history'])
        self.assertEqual(len(tracker.pending),1)
        self.assertEqual(before,asdict(sim.state))
        text=interruption_text(tracker.current,sim.briefing())
        self.assertIn('creates no in-world opportunity',text)
        tracker.acknowledge()
        self.assertEqual(before,asdict(sim.state))
        while sim.state.stage=='flight':
            step_observed(sim,1,tracker)
            tracker.acknowledge()
        while reference.state.stage=='flight':reference.advance(1)
        self.assertEqual(asdict(sim.state),asdict(reference.state))

    def test_nominal_launch_milestones_do_not_pause(self):
        sim=active()
        tracker=Interruptions()
        tracker.ingest(sim.briefing()['history'])
        self.assertIsNone(tracker.current)
        step_observed(sim,1,tracker)
        self.assertIsNone(tracker.current)
        self.assertTrue(any(event.kind=='continuity' for event in sim.state.events))
        names=[event.title for event in sim.state.events if event.kind=='launch']
        from per_aspera.trajectory import PROFILE
        self.assertEqual(names,[item['title'] for item in PROFILE['events']])

    def test_briefings_use_available_evidence_not_hidden_truth(self):
        sim=active()
        for question in DIALOGUE['questions']:
            for contact in DIALOGUE['contacts']:
                first=reply(sim.briefing(),sim.mission['id'],contact,question)
                old=sim.state.faults.copy()
                sim.state.faults=dict.fromkeys(old,.99)
                second=reply(sim.briefing(),sim.mission['id'],contact,question)
                self.assertEqual(first,second)
                sim.state.faults=old
        response=reply(sim.briefing(),sim.mission['id'],'propulsion','observations')[1]
        self.assertIn('No relevant in-flight instrument',response)
        self.assertNotIn('0.990',response)

    def test_request_records_no_time_rng_or_resource_cost_and_no_override(self):
        sim=active()
        hour,budget,rng,sequence=sim.state.hour,sim.state.budget,sim.state.rng_state,sim.state.sequence
        sim.request_mission_briefing('recommendation')
        self.assertEqual((hour,budget,rng,sequence),(sim.state.hour,sim.state.budget,sim.state.rng_state,sim.state.sequence))
        self.assertIn('cannot order spacecraft manoeuvres',sim.state.transcript[-1]['text'])
        with self.assertRaises(RuleError):sim.request_mission_briefing('order_unsafe_continuation')
        with self.assertRaises(RuleError):sim.administrator_abort()
        with self.assertRaises(RuleError):sim.set_administrator_abort_rule(True)

    def test_transcript_save_roundtrip_and_active_contingency_reopens_notice(self):
        sim=active(True)
        tracker=Interruptions.for_campaign(sim.briefing())
        step_observed(sim,200,tracker)
        sim.request_mission_briefing('recommendation','flight_director')
        self.assertIn('already in effect',sim.state.transcript[-1]['text'])
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'mission.json'
            save(sim.state,path)
            resumed=Simulation(load(path))
        self.assertEqual(resumed.state.transcript,sim.state.transcript)
        self.assertEqual(Interruptions.for_campaign(resumed.briefing()).current['interruption'],'observation')
        validate(resumed.state)

    def test_optional_administrator_abort_cannot_remove_crew_safety(self):
        sim=Simulation.new(11)
        sim.set_administrator_abort_rule(True)
        prepare_fixture(sim)
        sim.advance_to_next();sim.launch()
        sim.administrator_abort()
        self.assertTrue(sim.state.flight['aborted'])
        with self.assertRaises(RuleError):sim.administrator_abort()
        before=sim.state.hour
        sim.request_mission_briefing('recommendation')
        self.assertEqual(sim.state.hour,before)
        self.assertIn('cannot be overridden',sim.state.transcript[-1]['text'])
        while sim.state.stage=='flight':sim.advance_to_next()
        self.assertNotEqual(sim.state.results[-1]['outcome'],'objective_complete')
        validate(sim.state)

    def test_campaign_references_cite_actual_records_without_invented_delegation(self):
        sim=Simulation.new(11)
        prepare_fixture(sim)
        context=launch_context(sim.briefing(),'apollo9')
        events={event.id:event for event in sim.state.events}
        self.assertTrue(context)
        self.assertLessEqual(len(context),3)
        for item in context:
            self.assertEqual(len(item['links']),1)
            source=events[item['links'][0]]
            self.assertIn(source.title,item['text'])
            self.assertIn(source.detail,item['text'])
        self.assertFalse(any('delegat' in item['text'].lower() for item in context))
        before=asdict(sim.state)
        launch_context(sim.briefing(),'apollo9')
        self.assertEqual(before,asdict(sim.state))

    def test_ui_clock_pauses_on_unexpected_event_and_resumes_without_replay(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        from types import SimpleNamespace
        from unittest.mock import Mock,patch
        from per_aspera.pacing import MissionPacing
        sim=active(True)
        while sim.briefing()['flight']['phase']!='Powered descent':sim.advance_to_next()
        pacing=MissionPacing(0,progress=.99)
        app=SimpleNamespace(sim=sim,view=sim.briefing(),observation=Observation(),running=True,pacing=pacing,interruptions=Interruptions.for_campaign(sim.briefing()),_speed_value=lambda:1,save_path=Path('unused.json'),frames={},root=Mock(),status=Mock(),refresh=Mock(),_clock_tick=Mock())
        with patch('per_aspera.ui.time.monotonic',return_value=1),patch('per_aspera.ui.save'):
            AdministratorApp._clock_tick(app)
        self.assertFalse(app.running)
        event=app.interruptions.current['id']
        state=asdict(sim.state)
        with patch('per_aspera.ui.time.monotonic',return_value=10000):
            AdministratorApp.resume_interruption(app)
        self.assertTrue(app.running)
        self.assertEqual(state,asdict(sim.state))
        app.interruptions.ingest(sim.briefing()['history'])
        self.assertIsNone(app.interruptions.current)
        self.assertEqual(len([entry for entry in sim.state.transcript if event in entry['links']]),1)

    def test_pause_and_questions_do_not_change_outcome_or_random_stream(self):
        sim=active(True)
        reference=Simulation(deepcopy(sim.state))
        tracker=Interruptions.for_campaign(sim.briefing())
        step_observed(sim,200,tracker)
        for question in DIALOGUE['questions']:
            sim.request_mission_briefing(question)
        tracker.acknowledge()
        while sim.state.stage=='flight':
            step_observed(sim,1,tracker)
            tracker.acknowledge()
        while reference.state.stage=='flight':reference.advance(1)
        first,second=asdict(sim.state),asdict(reference.state)
        first.pop('transcript');second.pop('transcript')
        self.assertEqual(first,second)
