from copy import deepcopy
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from per_aspera.campaign import Campaign,CATALOG,PROJECTS,DAY,demonstrate,validate,save,load
from per_aspera.campaign_server import Controller,campaign_lease
from per_aspera.engine import RuleError
from per_aspera.persistence import SaveError


def opening():
    sim=Campaign.new(11);sim.commission('study');sim.next_report();sim.endorse();return sim


def developed(key='csm',design='service'):
    sim=opening();sim.commission('develop',key,design);sim.next_report();return sim


def tests_for(sim,key):
    for method in CATALOG['tests']:
        sim.commission(method,key);sim.next_report()


class CampaignTests(TestCase):
    def test_fresh_campaign_starts_at_commitment_without_fabricated_history(self):
        sim=Campaign.new(11);public=sim.briefing();validate(sim.state)
        self.assertTrue(public['date'].startswith('25 May 1961'))
        self.assertEqual(len(public['events']),1)
        self.assertEqual(len(public['results']),0)
        self.assertTrue(all(p['status']=='concept' for p in public['projects']))
        self.assertEqual(len(public['missions']),9)
        self.assertTrue(public['mission']['ground'])

    def test_public_projection_excludes_hidden_mechanisms_rng_and_private_expertise(self):
        public=developed().briefing()
        text=json.dumps(public)
        for field in ('"faults"','"rng"','"skills"','"factors"','"seed": 0'):
            self.assertNotIn(field,text)
        before=deepcopy(developed().state)
        sim=Campaign(before);snapshot=deepcopy(sim.state);sim.briefing()
        self.assertEqual(snapshot,sim.state)

    def test_tests_improve_information_without_repairing_hardware(self):
        sim=developed();faults=deepcopy(sim.state['hardware']['csm']['faults'])
        tests_for(sim,'csm')
        self.assertEqual(faults,sim.state['hardware']['csm']['faults'])
        self.assertEqual(len(sim.state['hardware']['csm']['evidence']),2)
        self.assertEqual(len(sim.state['hardware']['csm']['evidence'][0]['observations']),1)
        self.assertEqual(len(sim.state['hardware']['csm']['evidence'][1]['observations']),2)

    def test_configuration_revision_preserves_but_invalidates_old_evidence(self):
        sim=developed();tests_for(sim,'csm');old=deepcopy(sim.state['hardware']['csm']['evidence'])
        sim.commission('rework','csm');sim.next_report()
        self.assertEqual(old,sim.state['hardware']['csm']['evidence'])
        self.assertFalse(sim._evidence('csm'))
        self.assertEqual(sim.state['hardware']['csm']['revision'],2)
        validate(sim.state)

    def test_competing_designs_change_cost_calendar_mass_and_hidden_exposure(self):
        compact=developed(design='compact');service=developed(design='service')
        self.assertLess(compact.state['time'],service.state['time'])
        self.assertLess(compact.state['hardware']['csm']['mass'],service.state['hardware']['csm']['mass'])
        self.assertNotEqual(compact.state['hardware']['csm']['faults'],service.state['hardware']['csm']['faults'])
        self.assertGreater(compact.available('engineering'),service.available('engineering'))

    def test_future_lunar_payload_can_require_a_real_design_revision(self):
        sim=opening()
        for key,option in (('booster','compact'),('csm','service'),('lander','service')):
            sim.commission('develop',key,option);sim.next_report()
        sim.state['mission_index']=8
        self.assertLess(sim.mass()['margin'],0)
        self.assertTrue(any('payload exceeds' in reason for reason in sim.blocks()))
        sim.commission('redesign','booster','growth');sim.next_report()
        self.assertGreaterEqual(sim.mass()['margin'],0)
        self.assertTrue(any('tests' in reason.lower() or 'rehearsal' in reason.lower() for reason in sim.blocks()))

    def test_personnel_ownership_is_recorded_and_concurrent_lead_work_is_blocked(self):
        sim=opening();sim.assign('lander','bennett');sim.commission('develop','lander','modular')
        before=deepcopy(sim.state)
        with self.assertRaises(RuleError):sim.commission('develop','operations','service')
        self.assertEqual(before,sim.state)
        with self.assertRaises(RuleError):sim.assign('lander','mercer')
        sim.next_report()
        self.assertIn('lander',sim.state['staff']['bennett']['work'])
        self.assertTrue(sim.state['staff']['bennett']['memories'])
        with self.assertRaises(RuleError):sim.assign('csm','ortiz')

    def test_same_command_history_is_invariant_to_time_step_size(self):
        a=opening();a.commission('develop','csm','service');b=Campaign(deepcopy(a.state))
        target=a.state['jobs'][0]['due']-a.state['time']
        a.advance(target)
        while target:
            step=min(target,17*DAY);b.advance(step);target-=step
        self.assertEqual(a.state,b.state)

    def test_player_interpretation_does_not_change_test_result_or_hardware(self):
        a=developed();b=Campaign(deepcopy(a.state));b.record_theory('I suspect the wrong mechanism.')
        tests_for(a,'csm');tests_for(b,'csm')
        self.assertEqual(a.state['hardware']['csm']['faults'],b.state['hardware']['csm']['faults'])
        self.assertEqual([e['observations'] for e in a._evidence('csm')],[e['observations'] for e in b._evidence('csm')])

    def test_save_roundtrip_preserves_outstanding_work_and_commitments(self):
        sim=opening();sim.commission('develop','booster','growth');sim.advance(20*DAY)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'campaign.json';save(sim.state,path);resumed=Campaign(load(path))
        self.assertEqual(sim.state,resumed.state)
        sim.next_report();resumed.next_report();self.assertEqual(sim.state,resumed.state)

    def test_obligation_deducted_once_and_committed_work_survives_zero_reserve(self):
        sim=opening();before=sim.available('engineering');sim.commission('develop','csm','service')
        self.assertEqual(sim.available('engineering'),before-1000000000)
        reserve=sim.available('reserve');sim.release_reserve('readiness',reserve,'All reserve explicitly allocated to qualification.')
        committed=sim.available('engineering');sim.next_report()
        self.assertEqual(committed,sim.available('engineering'))
        self.assertEqual(sim.available('reserve'),0)
        self.assertEqual(sim.state['funds']['engineering']['committed'],0)
        validate(sim.state)

    def test_insufficient_funds_and_unrestricted_transfers_are_blocked(self):
        sim=opening();before=deepcopy(sim.state)
        with self.assertRaises(RuleError):sim.release_reserve('engineering',1000000000,'too much')
        with self.assertRaises(RuleError):sim.release_reserve('foreign',1,'not a campaign account')
        self.assertEqual(before,sim.state)

    def test_corruption_rejected_before_state_replacement(self):
        for mutate in (lambda s:s['funds']['reserve'].__setitem__('allocation',999),lambda s:s['hardware']['csm'].__setitem__('mass',999),lambda s:s.__setitem__('mission_index',8),lambda s:s['events'][0]['links'].append('missing')):
            state=deepcopy(developed().state);mutate(state)
            with self.assertRaises(SaveError):validate(state)

    def test_ledger_detects_balanced_but_unrecorded_expenditure(self):
        state=deepcopy(developed().state)
        state['funds']['engineering']['paid']+=1
        with self.assertRaises(SaveError):validate(state)

    def test_campaign_writer_lease_is_exclusive_and_released(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'writer.lock'
            with campaign_lease(path):
                with self.assertRaises(RuleError):
                    with campaign_lease(path):pass
            with campaign_lease(path):pass

    def test_complete_seeded_campaign_covers_every_milestone_without_forcing_fire(self):
        sim=demonstrate(11);validate(sim.state)
        self.assertEqual(sim.state['status'],'complete')
        self.assertEqual([r['mission'] for r in sim.state['results']],[m['id'] for m in CATALOG['missions']])
        self.assertTrue(all(r['outcome']=='objective_complete' for r in sim.state['results']))
        self.assertTrue(sim.date().endswith('22:00:00'))
        self.assertEqual(CATALOG['missions'][2]['vehicle'],'Saturn IB')
        self.assertFalse(sim.briefing()['deadline_missed'])

    def test_unsupported_architectures_and_early_launch_are_not_fake_choices(self):
        sim=opening();before=deepcopy(sim.state)
        with self.assertRaises(RuleError):sim.endorse('direct')
        with self.assertRaises(RuleError):sim.launch()
        self.assertEqual(before,sim.state)


class CampaignFlightTests(TestCase):
    @classmethod
    def setUpClass(cls):
        # Stop a deterministic policy immediately before authorising the first flight.
        cls.full=demonstrate().state
        sim=opening()
        for key in ('csm','ground'):
            sim.commission('develop',key,'service');sim.next_report();tests_for(sim,key)
            if sim.findings(key):
                sim.commission('rework',key);sim.next_report();tests_for(sim,key)
        sim.commission('prepare');sim.next_report();sim.commission('review');sim.next_report()
        cls.ground=deepcopy(sim.state)

    def test_ground_test_is_not_a_saturn_v_launch(self):
        sim=Campaign(deepcopy(self.ground));sim.launch()
        self.assertEqual(sim.mission['vehicle'],'Ground test')
        self.assertEqual(sim.state['flight']['queue'],[])
        self.assertIsNone(sim.briefing()['flight']['estimate'])

    def test_active_mission_freezes_hardware_and_its_actual_provenance(self):
        sim=Campaign(deepcopy(self.ground));sim.launch()
        frozen=deepcopy(sim.state['flight']['snapshot'])
        for key in sim.mission['requires']:
            sim.state['hardware'][key]['revision']+=1
        self.assertEqual(frozen,sim.state['flight']['snapshot'])
        authorised=next(e for e in sim.state['events'] if e['id']==sim.state['flight']['cause'])
        self.assertTrue(authorised['links'])
        self.assertTrue(all(any(e['id']==link and e['time']<=authorised['time'] for e in sim.state['events']) for link in authorised['links']))

    def test_snapshot_and_outcome_unchanged_by_public_viewing_or_chunk_sizes(self):
        a=Campaign(deepcopy(self.ground));a.launch();b=Campaign(deepcopy(a.state))
        snapshot=deepcopy(a.state['flight']['snapshot'])
        a.advance(86400)
        while b.state['flight']:
            before=deepcopy(b.state);b.briefing();self.assertEqual(before,b.state);b.advance(317)
        # Time after the finish is deliberately different; compare authoritative outcome fields.
        self.assertEqual(a.state['results'],b.state['results'])
        self.assertEqual(a.state['rng'],b.state['rng'])
        self.assertEqual(a.state['funds'],b.state['funds'])

    def test_severe_ground_conditions_trigger_independent_action_and_investigation(self):
        sim=Campaign(deepcopy(self.ground));sim.launch()
        for h in sim.state['flight']['snapshot'].values():h['faults']={k:1. for k in h['faults']}
        sim.advance(86400)
        self.assertTrue(sim.state['standdown'])
        self.assertNotEqual(sim.state['results'][-1]['outcome'],'objective_complete')
        self.assertTrue(any(e['kind']=='interruption' for e in sim.state['events']))
        with self.assertRaises(RuleError):sim.launch()
        self.assertEqual(sim.state['mission_index'],0)
        validate(sim.state)

    def test_investigation_does_not_repair_hardware_or_reset_history(self):
        sim=Campaign(deepcopy(self.ground));sim.state['standdown']=True
        before={k:deepcopy(h['faults']) for k,h in sim.state['hardware'].items()}
        count=len(sim.state['events']);sim.commission('investigation');sim.next_report()
        self.assertFalse(sim.state['standdown'])
        self.assertGreater(len(sim.state['events']),count)
        self.assertEqual(before,{k:h['faults'] for k,h in sim.state['hardware'].items()})
        self.assertFalse(sim._evidence('csm'))

    def test_controller_questions_persist_without_time_cost_or_hidden_truth(self):
        sim=Campaign(deepcopy(self.ground));sim.launch()
        before=(sim.state['time'],deepcopy(sim.state['funds']),deepcopy(sim.state['rng']))
        for question in ('observations','uncertainty','authority'):sim.controller_briefing(question)
        self.assertEqual(before,(sim.state['time'],sim.state['funds'],sim.state['rng']))
        self.assertEqual(len([e for e in sim.state['events'] if e['kind']=='briefing']),3)
        self.assertIn('no unsafe-continuation',sim.state['events'][-1]['detail'])

    def test_controller_pause_and_locations_are_presentation_only(self):
        sim=Campaign(deepcopy(self.ground));sim.launch();before=deepcopy(sim.state)
        c=Controller(sim,Path('unused.json'))
        for location in ('lcc','mcc','office','recovery'):c.command({'action':'location','location':location})
        c.command({'action':'speed','value':8})
        with patch.object(c,'persist'):
            c.command({'action':'run'});c.command({'action':'pause'})
        self.assertEqual(before,sim.state)

    def test_full_controller_playback_is_invariant_under_speed_and_location(self):
        completed=[]
        for speed in (.5,1,8):
            sim=Campaign(deepcopy(self.ground));sim.launch();c=Controller(sim,Path('unused.json'))
            c.speed=speed;c.running=True
            clock=0.
            with patch.object(c,'persist'),patch('per_aspera.campaign_server.time.monotonic',side_effect=lambda:clock):
                c.last=clock
                while sim.state['flight']:
                    clock+=1;c.tick()
                    c.command({'action':'location','location':'mcc' if int(clock)%2 else 'lcc'})
                    if c.pending:c.command({'action':'acknowledge'});c.command({'action':'run'})
                    self.assertLess(clock,10000)
            completed.append(sim.state)
        self.assertEqual(completed[0],completed[1]);self.assertEqual(completed[1],completed[2])

    def test_manual_advance_does_not_skip_unexpected_reports(self):
        sim=Campaign(deepcopy(self.ground));sim.launch()
        for h in sim.state['flight']['snapshot'].values():h['faults']={k:1. for k in h['faults']}
        c=Controller(sim,Path('unused.json'))
        with patch.object(c,'persist'):c.command({'action':'next'})
        self.assertTrue(c.pending);self.assertFalse(c.running)
        before=deepcopy(sim.state)
        with self.assertRaises(RuleError):c.command({'action':'next'})
        self.assertEqual(before,sim.state)

    def test_no_automatic_funding_arrives_when_years_change(self):
        sim=opening();before=deepcopy(sim.state['funds']);sim.advance(5*366*DAY)
        self.assertEqual(before,sim.state['funds'])

    def test_mid_flight_save_resume_is_exact(self):
        sim=Campaign(deepcopy(self.ground));sim.launch();sim.advance(1031)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'flight.json';save(sim.state,path);resumed=Campaign(load(path))
        sim.advance(86400);resumed.advance(86400)
        self.assertEqual(sim.state,resumed.state)

