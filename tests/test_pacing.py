import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch, Mock
from dataclasses import asdict
from per_aspera.engine import Simulation
from per_aspera.observation import Observation
from per_aspera.pacing import MissionPacing
from per_aspera.persistence import load


class PacingTests(TestCase):
    def test_critical_phase_rate_and_fraction(self):
        flight={'phase':'Ascent','elapsed':0}
        clock=MissionPacing(0)
        for second in range(1,30):
            self.assertEqual(clock.tick(second,True,flight),0)
        self.assertEqual(clock.tick(30,True,flight),1)
        self.assertAlmostEqual(clock.progress,0)

    def test_pause_resume_retains_fraction_without_counting_paused_time(self):
        flight={'phase':'Ascent','elapsed':0}
        clock=MissionPacing(0)
        for second in range(1,16):clock.tick(second,True,flight)
        self.assertAlmostEqual(clock.progress,.5)
        self.assertEqual(clock.tick(100,False,flight),0)
        clock.last=200
        hours=sum(clock.tick(second,True,flight) for second in range(201,216))
        self.assertEqual(hours,1)

    def test_ground_clock_keeps_existing_fast_step(self):
        self.assertEqual(MissionPacing(0).tick(1,True,None),6)

    def test_switching_location_preserves_partial_mission_hour(self):
        s=Simulation.new(11)
        before=asdict(s.state)
        clock=MissionPacing(0)
        flight={'phase':'Ascent','elapsed':0}
        for second in range(1,16):clock.tick(second,True,flight)
        desk=Observation()
        for location in ('lcc','office','mcc','recovery'):
            desk.switch(location,s.briefing())
        self.assertEqual(sum(clock.tick(second,True,flight) for second in range(16,31)),1)
        self.assertEqual(before,asdict(s.state))

    def test_restart_uses_same_seed_and_preserves_previous_run(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            sim=Simulation.new(17)
            sim.order_test('thermal')
            before=asdict(sim.state)
            app=SimpleNamespace(sim=sim,running=True,pacing=MissionPacing(0),save_path=Path(folder)/'save.json',root=None,refresh=Mock(),status=Mock(),_replace_sim=Mock())
            with patch('per_aspera.ui.messagebox.askyesno',return_value=True):
                AdministratorApp.restart_save(app)
            restarted=app._replace_sim.call_args.args[0]
            self.assertEqual(asdict(restarted.state),asdict(Simulation.new(17).state))
            self.assertEqual(load(app.save_path).budget,1800000)
            backup=load(Path(folder)/'before-restart.json')
            self.assertEqual(backup.budget,1760000)
            self.assertEqual(backup.jobs[0].target,'thermal')
            self.assertEqual(before,asdict(sim.state))

    def test_restart_backup_failure_keeps_live_campaign(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        app=SimpleNamespace(sim=Simulation.new(11),running=True,pacing=MissionPacing(0),save_path=Path('unused.json'),root=None,refresh=Mock(),status=Mock(),_replace_sim=Mock())
        before=asdict(app.sim.state)
        with patch('per_aspera.ui.messagebox.askyesno',return_value=True),patch('per_aspera.ui.save',side_effect=OSError('disk full')),patch('per_aspera.ui.messagebox.showerror'):
            AdministratorApp.restart_save(app)
        app._replace_sim.assert_not_called()
        self.assertEqual(before,asdict(app.sim.state))

    def test_adaptive_target_duration_and_automatic_deceleration(self):
        from per_aspera.pacing import nominal_duration, phase_seconds
        from per_aspera.definitions import SCENARIO
        self.assertTrue(600<=nominal_duration(SCENARIO['missions'][0])<=960)
        self.assertLess(phase_seconds({'phase':'Translunar coast','elapsed':20}),phase_seconds({'phase':'Powered descent','elapsed':0}))
        self.assertLess(phase_seconds({'phase':'Earth-orbit systems checkout','elapsed':3}),phase_seconds({'phase':'Earth-orbit systems checkout','elapsed':0}))
        clock=MissionPacing(0)
        flight={'phase':'Transearth coast','elapsed':2}
        self.assertEqual(clock.rate(flight,0,8),.25)
        clock.notify([{'kind':'operations','title':'Flight Control discontinues the objective'}],0)
        self.assertGreaterEqual(clock.rate(flight,1,8),30)
        self.assertEqual(clock.rate(flight,21,8),.25)
        flight['operations']='Return contingency active'
        self.assertGreaterEqual(clock.rate(flight,100,8),30)

    def test_outcomes_rng_and_finances_invariant_under_display_speeds(self):
        from test_simulation import prepare_fixture
        outcomes=set()
        for faults,crew,fatigue in ((.05,.95,.1),(.65,.85,.2),(1,.1,.9)):
            states=[]
            for speed in (.5,1,8):
                sim=Simulation.new(11)
                sim.state.mission_index=2
                prepare_fixture(sim)
                sim.advance_to_next()
                sim.launch()
                sim.state.flight['snapshot'].update(faults=dict.fromkeys(sim.state.faults,faults),crew=crew,fatigue=fatigue,environment=1.)
                clock=MissionPacing(0)
                now=0
                while sim.state.stage=='flight':
                    now+=.25
                    public=sim.briefing()
                    seconds=clock.tick(now,True,public['flight'],speed)
                    if seconds:
                        sequence=sim.state.sequence
                        sim.advance_mission_seconds(seconds)
                        clock.notify([event for event in sim.briefing()['history'] if int(event['id'][1:])>sequence],now)
                states.append(asdict(sim.state))
                outcomes.add(sim.state.results[-1]['outcome'])
            self.assertEqual(states[0],states[1])
            self.assertEqual(states[0],states[2])
        self.assertEqual(outcomes,{'objective_complete','safe_return_objective_incomplete','crew_loss'})

    def test_stalled_callbacks_do_not_race_past_multiple_events(self):
        clock=MissionPacing(0)
        self.assertLessEqual(clock.tick(100000,True,{'phase':'Translunar coast','elapsed':0}),1)
