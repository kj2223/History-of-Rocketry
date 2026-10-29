from dataclasses import asdict
import unittest
from per_aspera.engine import Simulation
from per_aspera.observation import Observation, LOCATIONS
from per_aspera.pacing import phase_seconds
from per_aspera.persistence import validate
from test_simulation import prepare_fixture


class ObservationTests(unittest.TestCase):
    def test_switching_and_rendering_are_free_and_do_not_change_state(self):
        s=Simulation.new(11)
        before=asdict(s.state)
        desk=Observation()
        for _ in range(3):
            for location in LOCATIONS:
                desk.switch(location,s.briefing())
                desk.project(s.briefing())
        self.assertEqual(before,asdict(s.state))

    def test_switches_do_not_change_flight_outcomes_rng_or_costs(self):
        first,second=Simulation.new(11),Simulation.new(11)
        for s in (first,second):
            prepare_fixture(s)
            s.advance_to_next()
            s.launch()
        desk=Observation()
        while first.state.stage=='flight':
            for location in LOCATIONS:
                desk.switch(location,first.briefing())
                desk.project(first.briefing())
            first.advance_to_next()
            second.advance_to_next()
        self.assertEqual(asdict(first.state),asdict(second.state))
        validate(first.state)

    def test_actual_ui_switch_handler_preserves_running_clock_and_resources(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable; pure observation invariants remain tested')
        from types import SimpleNamespace
        s=Simulation.new(11)
        before=asdict(s.state)
        app=SimpleNamespace(sim=s, observation=Observation(), running=True, refresh=lambda: None)
        for location in LOCATIONS:
            AdministratorApp.switch_location(app,location)
            self.assertTrue(app.running)
        self.assertEqual(before,asdict(s.state))

    def test_lcc_does_not_fabricate_launch_before_authorisation(self):
        s=Simulation.new(11)
        desk=Observation('lcc')
        view=desk.project(s.briefing())
        self.assertIn('planning clock',view['detail'])
        self.assertFalse(view['events'])
        self.assertTrue(all(p['status']=='Planned' for p in view['phases']))
        self.assertTrue(view['blocks'])

    def test_progress_and_logs_use_the_current_engine_phase(self):
        s=Simulation.new(11)
        prepare_fixture(s)
        s.advance_to_next()
        s.launch()
        desk=Observation('mcc')
        self.assertEqual(phase_seconds(s.briefing()['flight']),1800)
        self.assertEqual(desk.project(s.briefing())['heading'],'Ascent')
        s.advance_to_next()
        report=desk.project(s.briefing())
        self.assertEqual(report['heading'],'Earth-orbit systems checkout')
        self.assertEqual(report['elapsed'],1)
        self.assertEqual(report['phases'][0]['status'],'Recorded')
        self.assertEqual(report['phases'][1]['status'],'In progress')
        ids={event['id'] for event in s.briefing()['history']}
        self.assertTrue(all(event['id'] in ids for event in report['events']))

    def test_recovery_remains_on_completed_mission_after_next_proposal(self):
        s=Simulation.new(11)
        prepare_fixture(s)
        s.advance_to_next()
        s.launch()
        desk=Observation('recovery')
        desk.project(s.briefing())
        while s.state.stage=='flight':
            s.advance_to_next()
        report=desk.project(s.briefing())
        self.assertEqual(s.mission['id'],'apollo10')
        self.assertEqual(report['mission']['id'],'apollo9')
        self.assertEqual(report['outcome'],'objective_complete')
        fresh=Observation()
        fresh.switch('recovery',s.briefing())
        self.assertEqual(fresh.project(s.briefing())['mission']['id'],'apollo9')
        fresh.switch('lcc',s.briefing())
        self.assertEqual(fresh.project(s.briefing())['mission']['id'],'apollo10')

    def test_alternate_outcomes_are_not_rewritten_and_recovery_not_assumed(self):
        outcomes=set()
        for faults,crew,fatigue in ((.05,.95,.1),(.65,.85,.2),(1,.1,.9)):
            s=Simulation.new(11)
            prepare_fixture(s)
            s.state.mission_index=2
            s._spend(100000,'operations','Fixture flight')
            s.state.stage='flight'
            s.state.flight={'phase':0,'elapsed':0,'fuel':100.,'aborted':False,'crew_lost':False,'objective':False,'snapshot':{'faults':dict.fromkeys(s.state.faults,faults),'fatigue':fatigue,'crew':crew,'environment':1.},'cause':s.state.events[0].id,'anomalies':[]}
            # The fixture supplies the engine's launch event, not a presentation-generated event.
            s._event('mission','Mission authorised','Controlled outcome fixture')
            desk=Observation('recovery')
            before=desk.project(s.briefing())
            self.assertIsNone(before['outcome'])
            self.assertIn('No splashdown',before['detail'])
            while s.state.stage=='flight':
                s.advance_to_next()
            report=desk.project(s.briefing())
            outcome=s.state.results[-1]['outcome']
            outcomes.add(outcome)
            self.assertEqual(report['outcome'],outcome)
            self.assertEqual(report['result']['id'],s.state.results[-1]['event'])
            if outcome!='objective_complete':
                self.assertTrue(any(p['status']=='Not reached' for p in report['phases']))
        self.assertEqual(outcomes,{'objective_complete','safe_return_objective_incomplete','crew_loss'})

    def test_cancelled_unflown_programme_does_not_offer_a_launch_countdown(self):
        s=Simulation.new(11)
        s.cancel('No funded viable scope')
        report=Observation('lcc').project(s.briefing())
        self.assertEqual(report['heading'],'Programme closed')
        self.assertNotIn('opportunity in',report['detail'])
        self.assertFalse(report['events'])

    def test_observation_does_not_expose_hidden_state(self):
        import json
        public=Simulation.new(11).briefing()
        result=json.dumps(Observation('mcc').project(public))
        for field in ('faults','rng_state','fatigue','candour','beliefs'):
            self.assertNotIn('"'+field+'"',result)

    def test_shared_speed_policy_is_location_independent(self):
        s=Simulation.new(11)
        before=asdict(s.state)
        for location in LOCATIONS:
            desk=Observation(location)
            desk.project(s.briefing())
            self.assertEqual(phase_seconds({'phase':'Translunar coast','elapsed':0}),2)
        self.assertEqual(before,asdict(s.state))


if __name__=='__main__':
    unittest.main()
