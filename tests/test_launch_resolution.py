from dataclasses import asdict
from pathlib import Path
import tempfile
from unittest import TestCase
from per_aspera.engine import Simulation
from per_aspera.persistence import save,load
from per_aspera.trajectory import trajectory,PROFILE
from per_aspera.observation import Observation
from per_aspera.interruptions import Interruptions,step_seconds_observed
from test_simulation import prepare_fixture


def ready():
    sim=Simulation.new(11)
    prepare_fixture(sim);sim.advance_to_next();sim.launch()
    return sim


class LaunchResolutionTests(TestCase):
    def test_milestones_occur_at_their_actual_second_once(self):
        sim=ready()
        pauses=Interruptions()
        for entry in PROFILE['events'][1:]:
            delta=entry['second']-sim.state.flight['mission_seconds']
            if delta>1:step_seconds_observed(sim,delta-1,pauses)
            self.assertNotIn(entry['title'],[event.title for event in sim.state.events if event.kind=='launch'])
            step_seconds_observed(sim,1,pauses)
            event=sim.state.events[-1]
            self.assertEqual(event.title,entry['title'])
            self.assertEqual(event.second,entry['second'])
            self.assertIsNone(pauses.current)
        events=[event for event in sim.state.events if event.kind=='launch']
        self.assertEqual(len(events),len(PROFILE['events']))

    def test_chunk_size_preserves_trace_rng_finances_and_events(self):
        states=[]
        for chunk in (1,37,3600):
            sim=ready()
            remaining=7207
            while remaining:
                step=min(chunk,remaining);sim.advance_mission_seconds(step);remaining-=step
            states.append(asdict(sim.state))
        self.assertEqual(states[0],states[1]);self.assertEqual(states[0],states[2])

    def test_mid_launch_save_and_resume_is_exact(self):
        sim=ready();sim.advance_mission_seconds(143)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'launch.json';save(sim.state,path)
            resumed=Simulation(load(path))
        sim.advance_mission_seconds(3600);resumed.advance_mission_seconds(3600)
        self.assertEqual(asdict(sim.state),asdict(resumed.state))

    def test_observation_does_not_change_the_second_clock(self):
        sim=ready();sim.advance_mission_seconds(63)
        before=asdict(sim.state)
        observer=Observation()
        for location in ('lcc','mcc','office','recovery'):
            observer.switch(location,sim.briefing());observer.project(sim.briefing())
        self.assertEqual(before,asdict(sim.state))

    def test_profile_reports_estimates_and_no_fabricated_lunar_position(self):
        self.assertEqual(trajectory(52)['status'],'Ignition sequence')
        self.assertEqual(trajectory(60)['altitude_km'],0)
        self.assertAlmostEqual(trajectory(222)['altitude_km'],66.726)
        self.assertFalse(trajectory(759)['powered'])
        self.assertIn('model',trajectory(100)['source'].lower())
        for key in ('altitude_km','longitude','latitude','speed_km_s','q_kpa'):
            self.assertIsNone(trajectory(10000,'Translunar coast')[key])

    def test_legacy_flight_remains_loadable_and_hourly(self):
        sim=ready()
        for key in ('second_clock','mission_seconds','telemetry_trace','launch_events','launch_voices','spoken_voices'):
            del sim.state.flight[key]
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'old.json';save(sim.state,path)
            resumed=Simulation(load(path))
        hour=resumed.state.hour;resumed.advance(1)
        self.assertEqual(resumed.state.hour,hour+1)
        self.assertNotIn('second_clock',resumed.briefing()['flight'])
