from copy import deepcopy
import json
from datetime import datetime
from pathlib import Path
import tempfile
from unittest import TestCase
from unittest.mock import patch

from per_aspera.pioneers import Pioneers,PROFILES,DAY,START,save,load,validate
from per_aspera.pioneers_server import PioneersController
from per_aspera.engine import RuleError
from per_aspera.persistence import SaveError


def finish(sim,step=None):
    for _ in range(20000):
        while sim.state['attention']:sim.acknowledge()
        if not sim.state['jobs'] and not sim.state['flight']:break
        sim.next_report() if step is None else sim.advance(step)
    else:raise AssertionError('Campaign stalled')
    validate(sim.state)


def play(seed=11):
    sim=Pioneers.new(seed)
    for profile in PROFILES:
        while sim.blocker(profile).startswith('Sponsor'):
            sim.opportunity()
            while sim.state['attention']:sim.acknowledge()
        for _ in range(8):
            if any(f['profile']==profile and f['useful'] for f in sim.state['flights']):break
            q=sim.quote(profile,'measurement')
            if q['cost']>sim.available():break
            sim.authorise(profile,'measurement');finish(sim)
        if profile=='wac_b':
            while sim.state['time']<int((datetime(1948,1,1)-START).total_seconds()):sim.opportunity()
            sim.proposal()
            while sim.state['attention']:sim.acknowledge()
    return sim


class PioneersTests(TestCase):
    def test_opening_and_projection(self):
        s=Pioneers.new();validate(s.state);before=deepcopy(s.state);p=s.public()
        self.assertIn('1945',p['date']);self.assertEqual(4,len([x for x in p['staff'] if x['appointed']]))
        self.assertEqual(1200000,p['funds']['available']);self.assertEqual(before,s.state)
        for word in ('"reality"','"rng"','"skill"','"optimism"','"success"','"measured"'):self.assertNotIn(word,json.dumps(p))

    def test_no_unfunded_or_locked_flight(self):
        s=Pioneers.new()
        with self.assertRaises(RuleError):s.authorise('bumper')
        with self.assertRaises(RuleError):s.launch()
        with self.assertRaises(RuleError):s.next_report()
        self.assertEqual(0,s.state['time'])

    def test_preparation_and_launch_charged_once(self):
        s=Pioneers.new();q=s.quote('booster');s.authorise('booster');self.assertEqual(q['cost'],s.committed())
        finish(s);self.assertEqual(q['cost'],s.state['paid']);self.assertEqual(0,s.committed())
        self.assertEqual(1,len(s.state['flights']));self.assertEqual(['commit','settle'],[e['operation'] for e in s.state['ledger']])

    def test_repeat_rounds_and_release_only_unused_authority(self):
        s=Pioneers.new();q=s.quote('booster',count=3);s.authorise('booster',count=3);s.release()
        self.assertEqual(q['per_flight'],s.committed());finish(s)
        self.assertEqual(1,len(s.state['flights']));self.assertEqual(q['per_flight'],s.state['paid'])

    def test_delegated_rounds_return_to_report_and_preserve_causes(self):
        s=Pioneers.new();s.authorise('booster',count=3)
        finish(s);self.assertEqual(3,len(s.state['flights']))
        self.assertEqual([1,2,3],[f['revision'] for f in s.state['flights']])
        for f in s.state['flights']:self.assertTrue(f['links'])

    def test_direct_review_is_real_boundary(self):
        s=Pioneers.new();s.authorise('booster',delegated=False);s.next_report()
        self.assertIsNone(s.state['flight']);self.assertTrue(s.state['vehicle']);self.assertTrue(s.state['attention'])
        s.acknowledge();s.launch();finish(s);self.assertEqual(1,len(s.state['flights']))

    def test_exhaustion_does_not_cancel_committed_work(self):
        s=Pioneers.new()
        for _ in range(13):s.authorise('booster',count=3);finish(s)
        s.authorise('booster');self.assertEqual(0,s.available())
        with self.assertRaises(RuleError):s.recruit('chen')
        finish(s);self.assertEqual(40,len(s.state['flights']));self.assertEqual(0,s.available());validate(s.state)

    def test_staff_changes_future_preparation_not_old_records(self):
        a=Pioneers.new();b=Pioneers.new();b.recruit('chen');finish(b)
        a.advance(30*DAY);old=deepcopy(b.state['flights'])
        for s in (a,b):s.authorise('booster');s.next_report()
        self.assertGreater(b.state['reality']['structure'],a.state['reality']['structure']);self.assertEqual(old,b.state['flights'])

    def test_measurement_priority_has_actual_engineering_effect(self):
        a=Pioneers.new();b=Pioneers.new()
        a.authorise('booster','balanced');b.authorise('booster','measurement')
        a.next_report();b.next_report()
        self.assertGreater(b.state['reality']['instrumentation'],a.state['reality']['instrumentation'])
        self.assertGreater(b.state['paid'],a.state['paid'])

    def test_incremental_vs_event_stepping_and_save_resume(self):
        a=Pioneers.new(5);a.authorise('booster','measurement',3);b=Pioneers(deepcopy(a.state))
        finish(a);finish(b,900);self.assertEqual(a.state,b.state)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'save.json';save(a.state,path);c=Pioneers(load(path));self.assertEqual(a.state,c.state)
            a.authorise('booster');c.authorise('booster');finish(a);finish(c);self.assertEqual(a.state,c.state)

    def test_anomaly_pauses_before_final_report(self):
        for seed in range(20):
            s=Pioneers.new(seed);s.authorise('booster');s.next_report()
            while s.state['flight'] and not s.state['attention']:s.next_report()
            if s.state['flight']:
                before=deepcopy(s.state);s.advance(99999);self.assertEqual(before,s.state)
                self.assertEqual('anomaly',s.state['events'][-1]['kind']);s.acknowledge();finish(s);break
        else:self.fail('No anomaly tested')

    def test_observer_projection_and_pause_do_not_consume_rng(self):
        s=Pioneers.new();s.authorise('booster');s.next_report();before=deepcopy(s.state)
        for _ in range(100):s.public()
        self.assertEqual(before,s.state)
        with tempfile.TemporaryDirectory() as d:
            c=PioneersController(s,Path(d)/'x.json');c.command({'action':'pause'});c.command({'action':'speed','value':16})
            self.assertEqual(before,s.state)

    def test_sponsor_can_decline_and_no_duplicate_award(self):
        s=Pioneers.new();s.authorise('booster',count=3);finish(s);s.opportunity()
        with patch.object(s.rng,'random',return_value=.99):s.proposal()
        self.assertEqual([],s.state['grants']);self.assertEqual(1200000,s.state['allocation'])
        with self.assertRaises(RuleError):s.proposal()
        validate(s.state)

    def test_corrupt_finances_and_other_scenarios_rejected(self):
        for key,value in [('campaign','nasa_1958'),('allocation',99999999),('time',-1)]:
            s=Pioneers.new();s.state[key]=value
            with self.assertRaises(SaveError):validate(s.state)

    def test_seed_11_full_1945_49_campaign(self):
        s=play();self.assertTrue(any(f['profile']=='bumper' for f in s.state['flights']))
        self.assertIn('1949',s.date());s.close();validate(s.state)

    def test_fresh_save_preserves_previous_and_rejects_wrong_load(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'old.json';c=PioneersController(Pioneers.new(),path);c.persist();before=path.read_bytes()
            with patch('per_aspera.pioneers_server.fresh_path',return_value=Path(d)/'new.json'):c.command({'action':'fresh','seed':3})
            self.assertEqual(before,path.read_bytes());self.assertEqual(3,c.sim.state['seed'])
            with self.assertRaises(RuleError):c.command({'action':'load','name':'../nasa-1958.json'})

    def test_controller_speed_invariance_and_launch_not_skipped(self):
        results=[]
        for speed in (.5,1,16):
            with tempfile.TemporaryDirectory() as d:
                c=PioneersController(Pioneers.new(8),Path(d)/'x.json');c.command({'action':'authorise','profile':'booster','count':1})
                c.command({'action':'speed','value':speed});c.command({'action':'run'})
                now=c.last
                for _ in range(1000):
                    now+=1
                    with patch('per_aspera.pioneers_server.time.monotonic',return_value=now):c.tick()
                    if c.pending:
                        c.command({'action':'acknowledge'})
                        if c.sim.state['flight']:
                            with patch('per_aspera.pioneers_server.time.monotonic',return_value=now):c.command({'action':'run'})
                    if c.sim.state['flights']:break
                self.assertTrue(c.sim.state['flights']);results.append(c.sim.state)
        self.assertEqual(results[0],results[1]);self.assertEqual(results[1],results[2])

    def test_contextual_briefing_uses_only_available_observations(self):
        s=Pioneers.new();s.authorise('booster');s.next_report();before=s.state['rng']
        s.brief('observations');self.assertIn('Searching / no reliable return',s.state['events'][-1]['detail'])
        s.brief('recommendation');self.assertNotIn('abort command',s.state['events'][-1]['detail']);self.assertEqual(before,s.state['rng'])
