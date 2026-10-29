from copy import deepcopy
import json
from pathlib import Path
import tempfile
from unittest import TestCase

from per_aspera.campaign import Campaign,validate,save,load,DAY
from per_aspera.campaign_catalog import SCHEDULE_CONTENT,MISSIONS
from per_aspera.engine import RuleError
from per_aspera.persistence import SaveError


def opening():
    s=Campaign.new(11);s.commission('study');s.next_report();s.endorse();return s


class TechnicalDelegationTests(TestCase):
    def test_entire_campaign_runs_without_player_selecting_procurement_tests_or_rework(self):
        s=opening();s.authorise_missions(list(MISSIONS))
        for _ in range(300):
            validate(s.state)
            if s.state['status']=='complete' or s.state['schedule_pauses']:break
            s.next_report()
        self.assertEqual(s.state['status'],'complete')
        self.assertEqual(len(s.state['results']),9)
        kinds={e['title'] for e in s.state['events'] if e['kind']=='technical_decision'}
        self.assertTrue(kinds)
        self.assertTrue(all(e['actor']!='Administrator' for e in s.state['events'] if e['kind']=='technical_decision'))
        self.assertTrue(all(p['technical']=={'engineering':0,'readiness':0} for p in s.state['plans'].values()))
        self.assertEqual(s.state['funds']['engineering']['committed'],0)
        self.assertTrue(any(e['operation']=='release' for e in s.state['ledger']))
        for mid in s.state['plans']:
            for account in s.technical_accounts(mid).values():
                self.assertEqual(account['authorised'],sum(account[k] for k in ('available','contracted','released','paid')))

    def test_shared_work_is_funded_and_procured_once(self):
        s=opening();s.authorise_missions(['apollo4','apollo6','apollo7'])
        owners=[mid for mid,p in s.state['plans'].items() if 'csm' in p['technical_claims']]
        self.assertEqual(owners,['apollo4'])
        self.assertEqual(sum(j['component']=='csm' for j in s.state['jobs']),1)
        s.advance(10*DAY);validate(s.state)
        self.assertEqual(sum(j['component']=='csm' for j in s.state['jobs']),1)

    def test_technical_job_assignment_does_not_charge_the_allowance_twice(self):
        s=opening();s.authorise_missions(['apollo1'])
        available=deepcopy({a:s.available(a) for a in ('engineering','readiness')})
        committed=s.state['funds']['engineering']['committed']
        s.next_report()
        self.assertEqual(available,{a:s.available(a) for a in available})
        self.assertLess(s.state['funds']['engineering']['committed'],committed)
        self.assertTrue(any(e['operation']=='assign' for e in s.state['ledger']))
        validate(s.state)

    def test_existing_procurement_is_not_reserved_again(self):
        s=opening();s.commission('develop','csm','service')
        quote=s.technical_estimate('csm')
        self.assertEqual(quote['engineering'],160000000)
        self.assertEqual(len(s.state['jobs']),1)

    def test_planning_does_not_inspect_hidden_condition(self):
        a=opening();b=Campaign(deepcopy(a.state))
        for h in b.state['hardware'].values():h['faults']={k:.99 for k in h['faults']}
        self.assertEqual(a.technical_estimate('csm'),b.technical_estimate('csm'))
        a.authorise_missions(['apollo1','apollo4']);b.authorise_missions(['apollo1','apollo4'])
        self.assertEqual(a.state['jobs'],b.state['jobs'])

    def test_exhausted_allowance_escalates_without_unfunded_work(self):
        s=opening();s.authorise_missions(['apollo1']);p=s.state['plans']['apollo1']
        # Consume the recorded packages normally, then introduce an adverse observed report.
        for _ in range(30):
            if all(s.state['hardware'][k]['status']=='developed' and len(s._evidence(k))==2 for k in ('csm','ground')):break
            s.next_report()
        s.state['hardware']['csm']['evidence'][-1]['observations']['cabin']=.9
        # Explicitly exhaust the still-unassigned correction allowance; do not create funds.
        amount=p['technical']['engineering'];s._money('engineering',amount,'Test exhaustion of approved allowance','settle',mission='apollo1');p['technical']['engineering']=0
        # Any in-progress preparation is allowed to finish before the team reconsiders its evidence.
        for _ in range(5):
            if s.state['schedule_pauses']:break
            if s.next_time() is None:s.dispatch();break
            s.next_report()
        self.assertTrue(p['held']);self.assertTrue(s.state['schedule_pauses'])
        self.assertFalse(any(j['kind']=='rework' for j in s.state['jobs']))
        validate(s.state)

    def test_save_resume_preserves_technical_work_and_funding(self):
        s=opening();s.authorise_missions(['apollo1','apollo4']);s.advance(10*DAY)
        with tempfile.TemporaryDirectory(dir='tmp') as folder:
            path=Path(folder)/'state.json';save(s.state,path);other=Campaign(load(path))
        for _ in range(8):s.next_report();other.next_report()
        self.assertEqual(s.state,other.state)

    def test_version_two_keeps_existing_scope_and_requires_explicit_technical_extension(self):
        s=opening();old=deepcopy(s.state);old.update(version=2,content=SCHEDULE_CONTENT)
        for p in old['plans'].values():
            for key in ('technical_enabled','technical_claims','technical','technical_authorised'):p.pop(key)
        with tempfile.TemporaryDirectory(dir='tmp') as folder:
            path=Path(folder)/'save.json';path.write_text(json.dumps(old),encoding='utf-8')
            new=load(path);save(new,path)
            self.assertTrue(path.with_suffix('.v2-backup.json').exists())
        self.assertEqual(new['funds'],old['funds']);self.assertEqual(new['events'],old['events'])
        self.assertTrue(all(not p['technical_enabled'] for p in new['plans'].values()))

    def test_technical_budget_corruption_is_rejected(self):
        s=opening();s.authorise_missions(['apollo1']);s.state['plans']['apollo1']['technical']['engineering']+=1
        with self.assertRaises(SaveError):validate(s.state)
