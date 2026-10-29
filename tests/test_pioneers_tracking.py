from copy import deepcopy
import json
from pathlib import Path
import tempfile
from unittest import TestCase

from per_aspera.pioneers import Pioneers,PROFILES,save,load,validate
from per_aspera.pioneers_tracking import trajectory,row_at,observations
from per_aspera.persistence import SaveError


class TrackingTests(TestCase):
    def test_motion_has_powered_ascent_apogee_descent_and_impact(self):
        rows=trajectory('wac',450,65)
        self.assertEqual(0,row_at(rows,4)[2]);self.assertGreater(row_at(rows,30)[2],row_at(rows,10)[2])
        self.assertAlmostEqual(65000,max(r[2] for r in rows),delta=2)
        peak=max(rows,key=lambda r:r[2]);self.assertGreater(peak[0],54)
        self.assertTrue(any(r[4]<0 for r in rows));self.assertTrue(rows[-1][6]);self.assertEqual(0,rows[-1][2])

    def test_bumper_upper_stage_has_separate_burn(self):
        rows=trajectory('bumper',720,390)
        self.assertTrue(row_at(rows,30)[5]);self.assertFalse(row_at(rows,100)[5]);self.assertTrue(row_at(rows,150)[5])
        self.assertAlmostEqual(390000,max(r[2] for r in rows),delta=3)

    def test_optical_contact_can_leave_bunker_field_and_become_unresolvable(self):
        o=observations('wac',450,65,None,20,True)
        self.assertGreater(o['optical']['elevation_deg'],40)
        o=observations('wac',450,65,None,180,True)
        self.assertFalse(o['optical']['visible']);self.assertIsNone(o['optical']['elevation_deg'])

    def test_radar_has_real_samples_no_future_and_no_perfect_knowledge(self):
        o=observations('wac',450,65,None,30,True)['radar']
        self.assertTrue(o['locked']);self.assertTrue(o['samples'])
        self.assertTrue(all(s['elapsed']<=30 for s in o['samples']))
        for sample in o['samples']:self.assertEqual(0,sample['elapsed']%5)
        self.assertNotIn('velocity',o);self.assertNotIn('target_km',json.dumps(o))

    def test_no_return_means_no_track_and_lost_track_retains_last_fix(self):
        empty=observations('wac',450,65,None,30,False)['radar'];self.assertEqual([],empty['samples']);self.assertIsNone(empty['last_fix'])
        lost=observations('bumper',720,390,None,300,True,True)['radar']
        self.assertFalse(lost['locked']);self.assertIsNotNone(lost['last_fix']);self.assertGreater(lost['age_seconds'],0)
        earlier=observations('bumper',720,390,None,200,True,True)['radar'];self.assertEqual(earlier['last_fix'],lost['last_fix'])

    def test_observation_never_consumes_entropy_or_changes_outcome(self):
        a=Pioneers.new();a.authorise('booster');a.next_report();b=Pioneers(deepcopy(a.state));before=deepcopy(a.state)
        for _ in range(20):a.public()
        self.assertEqual(before,a.state)
        for s in (a,b):
            for _ in range(20):
                while s.state['attention']:s.acknowledge()
                if not s.state['flight']:break
                s.next_report()
        self.assertEqual(a.state,b.state);self.assertIn('tracking',a.state['flights'][0])

    def test_midflight_save_and_legacy_active_save_survive(self):
        s=Pioneers.new();s.authorise('booster');s.next_report();s.next_report()
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'save.json';save(s.state,path);other=Pioneers(load(path));self.assertEqual(s.public(),other.public())
        del s.state['flight']['motion_apogee'];validate(s.state);self.assertIn('tracking',s.public()['flight'])

    def test_report_estimate_comes_from_admitted_trajectory(self):
        s=Pioneers.new();s.authorise('booster','measurement');s.next_report()
        f=deepcopy(s.state['flight']);peak=max(r[2] for r in s.flight_trajectory(f))/1000
        for _ in range(20):
            while s.state['attention']:s.acknowledge()
            if not s.state['flight']:break
            s.next_report()
        result=s.state['flights'][0]
        if result['record']:
            self.assertLessEqual(abs(result['altitude']-peak),peak*.11+.1)
            self.assertEqual(result['altitude'],max(p['height_km'] for p in result['tracking']['samples']))
        self.assertNotIn('motion_apogee',json.dumps(s.public()))

    def test_corrupt_archived_radar_samples_are_rejected(self):
        s=Pioneers.new();s.authorise('booster','measurement')
        for _ in range(20):
            while s.state['attention']:s.acknowledge()
            if not s.state['jobs'] and not s.state['flight']:break
            s.next_report()
        validate(s.state);s.state['flights'][0]['tracking']['samples'][0]['elapsed']=999999
        with self.assertRaises(SaveError):validate(s.state)
