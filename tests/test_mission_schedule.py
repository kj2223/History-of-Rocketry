from copy import deepcopy
import json
from pathlib import Path
import tempfile
from unittest import TestCase
from unittest.mock import patch

from per_aspera.campaign import Campaign,develop_campaign,validate,save,load,DAY
from per_aspera.campaign_catalog import OLD_CONTENT,CONTENT,MISSIONS,SCHEDULE
from per_aspera.campaign_server import Controller
from per_aspera.engine import RuleError
from per_aspera.persistence import SaveError


class MissionScheduleTests(TestCase):
    @classmethod
    def setUpClass(cls):cls.ready=deepcopy(develop_campaign().state)

    def ready_campaign(self):return Campaign(deepcopy(self.ready))

    def run_schedule(self,sim,chunk=None):
        for _ in range(20000):
            if sim.state['status']=='complete' or sim.state['schedule_pauses']:break
            if chunk:sim.advance(chunk)
            else:sim.next_report()
        else:self.fail('The delegated schedule did not terminate.')

    def test_batch_authorisation_commits_once_and_starts_parallel_preparation(self):
        sim=self.ready_campaign();before=deepcopy(sim.state['funds'])
        sim.authorise_missions(['apollo4','apollo5','apollo6'],'hayes')
        self.assertEqual({j['mission'] for j in sim.state['jobs']},{'apollo4','apollo5','apollo6'})
        self.assertTrue(all(j['kind']=='prepare' for j in sim.state['jobs']))
        self.assertEqual(sim.available('operations'),before['operations']['allocation']-before['operations']['paid']-480000000)
        self.assertEqual(sim.state['funds']['readiness']['committed'],60000000)
        balance=sim.available('operations');sim.advance(61*DAY)
        self.assertEqual(sim.available('operations'),balance)
        validate(sim.state)

    def test_partial_batch_with_duplicate_or_unfunded_scope_is_atomic(self):
        sim=self.ready_campaign();before=deepcopy(sim.state)
        with self.assertRaises(RuleError):sim.authorise_missions(['apollo4','apollo4'])
        self.assertEqual(before,sim.state)
        sim.release_reserve('engineering',sim.available('reserve'),'Reserve explicitly committed elsewhere.')
        sim.state['funds']['operations']['allocation']=1  # Boundary test: no commit is allowed.
        before=deepcopy(sim.state)
        with self.assertRaises(RuleError):sim.authorise_missions(['apollo4','apollo5'])
        self.assertEqual(before,sim.state)

    def test_preparation_can_precede_flight_evidence_and_independent_review(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo7'])
        sim.advance(100*DAY)
        p=sim.state['plans']['apollo7']
        self.assertIsNotNone(p['prepared']);self.assertIsNone(p['clearance'])
        self.assertIsNone(sim.state['flight'])
        blocks=sim.blocks(mission='apollo7')
        self.assertTrue(any('Apollo 1' in x for x in blocks));self.assertTrue(any('Apollo 4' in x for x in blocks))
        with self.assertRaises(RuleError):sim.launch('apollo7')

    def test_authorisation_order_can_prioritise_crewed_preparation(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo7','apollo4','apollo5','apollo6'])
        self.assertEqual([j['mission'] for j in sim.state['jobs']],['apollo7','apollo4','apollo5'])
        self.assertFalse(any(j.get('mission')=='apollo6' for j in sim.state['jobs']))
        validate(sim.state)

    def test_delegated_campaign_finishes_out_of_numeric_order_with_valid_dependencies(self):
        sim=self.ready_campaign();sim.authorise_missions(list(MISSIONS));self.run_schedule(sim)
        self.assertEqual(sim.state['status'],'complete')
        self.assertEqual(sim.state['results'][0]['mission'],'apollo5')
        done=set()
        for r in sim.state['results']:
            self.assertTrue(set(SCHEDULE['dependencies'][r['mission']]).issubset(done))
            self.assertEqual(r['outcome'],'objective_complete');done.add(r['mission'])
        self.assertEqual(done,set(MISSIONS));validate(sim.state)
        self.assertTrue(all(e['actor']=='Nora Bennett' and 'delegated mandate' in e['detail'] for e in sim.state['events'] if e['kind']=='mission'))
        self.assertEqual(sim.state['funds']['operations']['committed'],0)
        self.assertEqual(sim.state['funds']['operations']['paid'],1350000000)

    def test_shared_capacity_and_assurance_are_not_multiplied_by_mandates(self):
        sim=self.ready_campaign();sim.authorise_missions(list(MISSIONS))
        self.assertEqual(len(sim.state['jobs']),3)
        for _ in range(30):
            if sim.state['status']=='complete':break
            sim.next_report()
            self.assertLessEqual(sum(j['kind']=='prepare' for j in sim.state['jobs']),3)
            self.assertLessEqual(sum(j['lead']=='ortiz' for j in sim.state['jobs']),1)
            validate(sim.state)

    def test_shared_revision_escalates_and_amendment_retains_existing_obligations(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo7']);sim.advance(90*DAY)
        sim.commission('rework','csm');sim.next_report()
        p=sim.state['plans']['apollo7'];self.assertTrue(p['held']);self.assertTrue(sim.state['schedule_pauses'])
        self.assertEqual(p['obligations'],{'prepare':0,'review':20000000,'execute':70000000})
        sim.state['schedule_pauses'].clear();before=sim.available('operations')
        sim.amend_mission('apollo7')
        self.assertEqual(before-sim.available('operations'),90000000)
        self.assertEqual(p['obligations']['execute'],70000000)
        self.assertEqual(p['obligations']['review'],20000000)
        self.assertFalse(p['held']);validate(sim.state)

    def test_test_findings_are_outside_delegated_authority_and_not_repaired_by_approval(self):
        sim=self.ready_campaign();sim.state['hardware']['csm']['evidence'][-1]['observations']['cabin']=.9
        faults=deepcopy(sim.state['hardware']['csm']['faults'])
        sim.authorise_missions(['apollo7'])
        self.assertTrue(sim.state['plans']['apollo7']['held'])
        self.assertEqual(faults,sim.state['hardware']['csm']['faults'])
        now=sim.state['time'];sim.advance(100*DAY);self.assertEqual(now,sim.state['time'])

    def test_deferral_stops_future_execution_without_refunding_committed_contracts(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo5']);sim.defer_mission('apollo5')
        before=sim.available('operations');sim.advance(90*DAY)
        self.assertIsNone(sim.state['flight']);self.assertEqual(before,sim.available('operations'))
        self.assertEqual(sim.state['plans']['apollo5']['obligations']['execute'],70000000)
        sim.amend_mission('apollo5');self.assertEqual(before,sim.available('operations'));validate(sim.state)

    def test_save_resume_preserves_parallel_packages_funding_and_exception_acknowledgement(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo4','apollo5','apollo6']);sim.advance(30*DAY)
        with tempfile.TemporaryDirectory(dir='tmp') as folder:
            path=Path(folder)/'save.json';save(sim.state,path);other=Campaign(load(path))
        sim.advance(60*DAY);other.advance(60*DAY);self.assertEqual(sim.state,other.state)
        sim.hold_plan('apollo6','Scope requires executive review.')
        c=Controller(sim,Path('unused.json'));self.assertEqual(c.pending,sim.state['schedule_pauses'])
        with patch.object(c,'persist'):c.command({'action':'acknowledge'})
        self.assertEqual(sim.state['schedule_pauses'],[])

    def test_speed_pause_and_location_do_not_change_delegated_outcomes(self):
        states=[]
        for speed in (.5,8):
            sim=self.ready_campaign();sim.authorise_missions(['apollo5']);c=Controller(sim,Path('unused.json'))
            c.speed=speed;c.running=True;clock=0.
            with patch.object(c,'persist'),patch('per_aspera.campaign_server.time.monotonic',side_effect=lambda:clock):
                c.last=0
                for _ in range(5000):
                    clock+=1;c.tick()
                    c.command({'action':'location','location':'office'})
                    if not c.running:break
                else:self.fail('Delegated playback failed to finish.')
            states.append(sim.state)
        # Observer time may extend after the last outcome, but its authoritative records must match.
        for key in ('results','funds','ledger','events','rng'):self.assertEqual(states[0][key],states[1][key])

    def test_version_one_migrates_without_fabricating_authority_or_overwriting_backup(self):
        old=deepcopy(self.ready);old.update(version=1,content=OLD_CONTENT)
        for key in ('plans','schedule_pauses','standdown_mission'):old.pop(key)
        with tempfile.TemporaryDirectory(dir='tmp') as folder:
            path=Path(folder)/'campaign.json';path.write_text(json.dumps(old),encoding='utf-8')
            migrated=load(path);self.assertEqual(migrated['version'],2);self.assertEqual(migrated['content'],CONTENT)
            self.assertTrue(all(not p['authority'] for p in migrated['plans'].values()))
            self.assertEqual(old['ledger'],migrated['ledger']);save(migrated,path)
            self.assertEqual(json.loads(path.with_suffix('.v1-backup.json').read_text()),json.loads(json.dumps(old)))

    def test_corrupt_mission_obligations_and_gates_are_rejected(self):
        sim=self.ready_campaign();sim.authorise_missions(['apollo4'])
        for mutate in (lambda s:s['plans']['apollo4']['obligations'].__setitem__('execute',1),lambda s:s['plans']['apollo4'].__setitem__('manager','ortiz'),lambda s:s['schedule_pauses'].append('missing')):
            state=deepcopy(sim.state);mutate(state)
            with self.assertRaises(SaveError):validate(state)
