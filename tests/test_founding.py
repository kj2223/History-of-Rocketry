from copy import deepcopy
import json
from pathlib import Path
import tempfile
from unittest import TestCase
from unittest.mock import patch

from per_aspera.founding import Founding,DATA,DOMAINS,END,DAY,validate,save,load,demonstrate
from per_aspera.founding_server import FoundingController
from per_aspera.engine import RuleError
from per_aspera.persistence import SaveError


def appointed():
    s=Founding.new(11)
    for pair in (('bennett','hayes'),('mercer','ortiz'),('chen','reed')):
        for person in pair:s.appoint(person)
        s.advance(30*DAY)
    return s


def delegated():
    s=appointed()
    for key in ('spacecraft','human','operations'):
        s.authorise(key,s.quote(key)['cost']);s.delegate(key,'bounded')
    return s


class FoundingTests(TestCase):
    def test_opening_starts_at_nasa_formation_with_inherited_institution(self):
        s=Founding.new();validate(s.state)
        self.assertTrue(s.date().startswith('01 Oct 1958'))
        self.assertIn('NACA',s.state['events'][0]['detail'])
        self.assertTrue(all(p is None for p in s.state['appointments'].values()))
        self.assertTrue(all(p['status']=='unfunded' for p in s.state['research'].values()))

    def test_projection_and_handoff_do_not_leak_reality_rng_or_private_traits(self):
        s=Founding.new();before=deepcopy(s.state);public=json.dumps(s.public());handoff=json.dumps(s.handoff())
        for field in ('"reality"','"difficulty"','"rng"','"skills"','"rigour"','"optimism"','"challenge"','"gain"'):
            self.assertNotIn(field,public);self.assertNotIn(field,handoff)
        self.assertEqual(before,s.state)

    def test_assessing_candidate_creates_interpretation_without_appointment_or_physical_gain(self):
        s=Founding.new();before=deepcopy(s.state['research']);s.assess('mercer');s.advance(21*DAY)
        self.assertIn('mercer',s.state['assessments']);self.assertIsNone(s.state['appointments']['propulsion'])
        self.assertEqual(before,s.state['research']);self.assertEqual(s.state['funds']['organisation']['paid'],250000)
        self.assertIn('interpretations',s.state['assessments']['mercer']['text']);validate(s.state)

    def test_appointment_is_not_an_instant_unlock_and_does_not_improve_research(self):
        s=Founding.new();before=deepcopy(s.state['research']);s.appoint('bennett')
        self.assertIsNone(s.state['appointments']['programme']);s.advance(30*DAY)
        self.assertEqual(s.state['appointments']['programme'],'bennett');self.assertEqual(before,s.state['research'])
        self.assertTrue(s.state['memories']['bennett']);validate(s.state)

    def test_two_staffing_teams_and_post_conflicts_are_enforced(self):
        s=Founding.new();s.appoint('bennett');s.appoint('hayes');before=deepcopy(s.state)
        with self.assertRaises(RuleError):s.appoint('mercer')
        with self.assertRaises(RuleError):s.appoint('cole')
        self.assertEqual(before,s.state)

    def test_lead_recruitment_preserves_current_work_and_changes_future_packages(self):
        s=Founding.new();s.authorise('spacecraft',50000000);old=deepcopy(s.state['jobs'][0]);s.appoint('hayes');s.advance(30*DAY)
        job=next(j for j in s.state['jobs'] if j['kind']=='research');self.assertEqual(job,old)
        while not s.state['attention']:s.next_report()
        self.assertEqual(s.state['research']['spacecraft']['reports'][0]['source'],'Evelyn Price · acting NACA liaison')
        s.acknowledge();s.continue_research('spacecraft')
        self.assertEqual(next(j for j in s.state['jobs'] if j['kind']=='research')['lead'],'hayes');validate(s.state)

    def test_replacement_waits_for_the_accountable_leads_contract(self):
        s=appointed();s.authorise('propulsion',s.quote('propulsion')['cost'])
        with self.assertRaises(RuleError):s.appoint('ward')

    def test_delegation_requires_actual_director_and_relevant_specialist(self):
        s=Founding.new();s.authorise('spacecraft',50000000);before=deepcopy(s.state)
        with self.assertRaises(RuleError):s.delegate('spacecraft','bounded')
        self.assertEqual(before,s.state)
        s.appoint('bennett');s.advance(30*DAY)
        with self.assertRaises(RuleError):s.delegate('spacecraft','bounded')

    def test_direct_oversight_returns_reports_and_requires_explicit_continuation(self):
        s=Founding.new();s.authorise('spacecraft',50000000);s.advance(200*DAY)
        self.assertEqual(s.state['research']['spacecraft']['status'],'awaiting continuation')
        self.assertTrue(s.state['attention']);self.assertEqual(s.state['research']['spacecraft']['stage'],1)
        before=deepcopy(s.state)
        with self.assertRaises(RuleError):s.advance(DAY)
        self.assertEqual(before,s.state)
        s.acknowledge();s.continue_research('spacecraft');self.assertTrue(s.busy('spacecraft'))

    def test_bounded_delegation_progresses_without_player_selecting_technical_procedures(self):
        s=delegated();s.advance(END)
        self.assertEqual(s.state['status'],'complete')
        self.assertTrue(all(s.state['research'][key]['status']=='demonstrated' for key in ('spacecraft','human','operations')))
        self.assertTrue(any(e['actor']=='Rebecca Hayes' and e['kind']=='work' for e in s.state['events']))
        validate(s.state)

    def test_research_and_review_have_independent_frozen_actors(self):
        s=delegated();s.advance(END)
        reports=s.state['research']['spacecraft']['reports']
        self.assertTrue(any(r['source']=='Rebecca Hayes' and r['kind']=='stage' for r in reports))
        self.assertTrue(any(r['source']=='Dr Lila Ortiz' and r['kind']=='review' for r in reports))

    def test_no_assurance_appointment_uses_an_aggregate_independent_panel(self):
        s=Founding.new();cost,days=s.review_quote();self.assertEqual((cost,days),(6000000,70))
        s.appoint('ortiz');s.advance(30*DAY);self.assertEqual(s.review_quote(),(4000000,45))

    def test_candidate_expertise_changes_work_without_a_generic_reward(self):
        cases=[]
        for person in ('mercer','ward'):
            s=Founding.new();s.appoint(person);s.advance(30*DAY);s.authorise('propulsion',60000000)
            due=next(j['due'] for j in s.state['jobs'] if j['kind']=='research');s.advance(due-s.state['time'])
            cases.append((due,s.state['research']['propulsion']['reality']))
        self.assertLess(cases[0][0],cases[1][0]);self.assertGreater(cases[0][1],cases[1][1])

    def test_planner_does_not_read_hidden_physical_conditions(self):
        a=appointed();b=Founding(deepcopy(a.state))
        for p in b.state['research'].values():p['reality']=.01;p['difficulty']=.99
        a.authorise('spacecraft',50000000);b.authorise('spacecraft',50000000)
        self.assertEqual(a.quote('spacecraft'),b.quote('spacecraft'));self.assertEqual(a.state['jobs'],b.state['jobs'])

    def test_authority_assignment_and_payment_are_not_charged_twice(self):
        s=Founding.new();s.authorise('spacecraft',50000000);available=s.available('research');s.advance(100*DAY)
        self.assertEqual(s.available('research'),available);self.assertEqual(s.state['funds']['research']['paid'],4000000)
        self.assertEqual(s.state['research']['spacecraft']['balance'],46000000);validate(s.state)

    def test_budget_exhaustion_holds_before_committing_unfunded_work(self):
        s=Founding.new();s.authorise('spacecraft',1)
        self.assertEqual(s.state['research']['spacecraft']['status'],'resource hold')
        self.assertEqual(s.state['jobs'],[]);self.assertEqual(s.state['funds']['research']['paid'],0)
        s.acknowledge();s.top_up('spacecraft',5000000);self.assertTrue(s.busy('spacecraft'));validate(s.state)

    def test_committed_research_operates_with_zero_reserve(self):
        s=Founding.new();s.authorise('spacecraft',50000000);s.reserve('organisation',10000000,'Explicit reserve decision.')
        s.advance(100*DAY);self.assertEqual(s.available('reserve'),0);self.assertEqual(s.state['funds']['research']['paid'],4000000)
        with self.assertRaises(RuleError):s.reserve('research',1,'No reserve left')
        validate(s.state)

    def test_deferral_returns_only_unassigned_funds_and_preserves_paid_work(self):
        s=Founding.new();s.authorise('spacecraft',50000000);s.defer('spacecraft')
        self.assertEqual(s.state['research']['spacecraft']['released'],46000000)
        s.advance(100*DAY);p=s.state['research']['spacecraft']
        self.assertEqual(p['paid'],4000000);self.assertEqual(p['stage'],1);self.assertEqual(p['status'],'deferred');self.assertFalse(s.busy('spacecraft'));validate(s.state)

    def test_calendar_changes_do_not_create_money(self):
        s=Founding.new();before=deepcopy(s.state['funds']);s.advance(END)
        self.assertEqual(before,s.state['funds'])

    def test_context_is_external_and_does_not_create_player_achievements(self):
        s=Founding.new();s.advance(END)
        self.assertEqual(len(s.state['contexts']),len(DATA['events']))
        self.assertTrue(all(p['status']=='unfunded' for p in s.state['research'].values()))
        self.assertFalse(any(e['kind']=='capability' for e in s.state['events']))
        self.assertEqual(sum(e['title']=='The lunar commitment' for e in s.state['events']),1)

    def test_complete_example_reaches_review_with_recruited_cast_and_research_records(self):
        s=demonstrate();validate(s.state)
        self.assertTrue(s.date().startswith('25 May 1961'));self.assertTrue(all(s.state['appointments'].values()))
        self.assertTrue(all(p['status']=='demonstrated' for p in s.state['research'].values()))
        self.assertTrue(all(p['reports'] for p in s.state['research'].values()))

    def test_export_is_a_separate_contract_without_an_apollo_importer(self):
        s=demonstrate();h=s.handoff()
        self.assertEqual(h['schema'],'per_aspera.founding_handoff');self.assertFalse(h['merge_implemented']);self.assertTrue(h['chapter_complete'])
        self.assertNotIn('hardware',h);self.assertIn('private opening save',h['boundary'])

    def test_end_boundary_preserves_unfinished_contracts_and_outstanding_funding(self):
        s=Founding.new();s.advance(END-10*DAY);s.authorise('propulsion',60000000);s.advance(10*DAY)
        self.assertEqual(s.state['time'],END);self.assertTrue(s.state['jobs'])
        self.assertGreater(s.state['jobs'][0]['due'],END);self.assertEqual(s.state['funds']['research']['paid'],0)
        self.assertTrue(s.handoff()['outstanding_work']);validate(s.state)
        with self.assertRaises(RuleError):s.next_report()

    def test_save_resume_preserves_attention_staff_research_and_outcomes(self):
        s=Founding.new();s.authorise('spacecraft',50000000);s.advance(100*DAY)
        with tempfile.TemporaryDirectory(dir='tmp') as folder:
            path=Path(folder)/'opening.json';save(s.state,path);other=Founding(load(path))
        self.assertEqual(s.state,other.state)
        for sim in (s,other):sim.acknowledge();sim.continue_research('spacecraft');sim.advance(100*DAY)
        self.assertEqual(s.state,other.state)

    def test_advance_chunks_and_observer_projections_do_not_change_the_simulation(self):
        a=delegated();b=Founding(deepcopy(a.state));a.advance(END)
        while b.state['status']=='active':
            before=deepcopy(b.state);b.public();b.handoff();self.assertEqual(before,b.state);b.advance(37*DAY)
        self.assertEqual(a.state,b.state)

    def test_pause_speed_and_resume_preserve_underlying_results(self):
        states=[]
        for speed in (.5,16):
            s=delegated();c=FoundingController(s,Path('unused.json'));c.speed=speed;clock=0.
            with patch.object(c,'persist'),patch('per_aspera.founding_server.time.monotonic',side_effect=lambda:clock):
                before=deepcopy(s.state);c.command({'action':'run'});c.command({'action':'pause'});self.assertEqual(before,s.state)
                c.command({'action':'run'})
                for _ in range(3000):
                    clock+=1;c.tick()
                    if not c.running:break
                else:self.fail('Opening playback failed to finish.')
            states.append(s.state)
        self.assertEqual(states[0],states[1])

    def test_wrong_scenario_and_corrupt_accounts_or_provenance_are_rejected(self):
        for mutate in (lambda s:s.__setitem__('campaign','apollo_1961'),lambda s:s['funds']['research'].__setitem__('paid',1),lambda s:s['events'][0]['links'].append('missing'),lambda s:s['appointments'].__setitem__('assurance','mercer'),lambda s:s.__setitem__('time',END+1)):
            state=Founding.new().state;mutate(state)
            with self.assertRaises(SaveError):validate(state)

    def test_player_interpretation_never_repairs_or_improves_hidden_research(self):
        s=Founding.new();before=deepcopy(s.state['research']);rng=deepcopy(s.state['rng']);s.interpretation('I think we are ready for a lunar landing.')
        self.assertEqual(before,s.state['research']);self.assertEqual(rng,s.state['rng'])
