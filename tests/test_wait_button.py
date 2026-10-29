from dataclasses import asdict
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock
from per_aspera.engine import Simulation
from per_aspera.interruptions import Interruptions
from per_aspera.observation import Observation
from per_aspera.pacing import MissionPacing


class WaitButtonTests(TestCase):
    def ready_review(self):
        sim=Simulation.new(11)
        sim.state.faults=dict.fromkeys(sim.state.faults,.08)
        tracker=Interruptions.for_campaign(sim.briefing())
        sim.delegate(spending_limit=1,hours_limit=1)
        tracker.ingest(sim.briefing()['history'])
        sim.order_test('integration','hayes');sim.order_test('crew','bennett')
        while sim.state.jobs:sim.advance_to_next()
        sim.request_clearance()
        self.assertEqual(sim.hours_to_next_report(),8)
        return sim,tracker

    def test_wait_surfaces_blocking_report_then_completes_eight_hour_review(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        sim,tracker=self.ready_review()
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            app=SimpleNamespace(sim=sim,interruptions=tracker,running=False,status=Mock(),refresh=Mock(),pacing=MissionPacing(0),save_path=Path(folder)/'test.json',observation=Observation(),selected_evidence=None,inspect_interruption=Mock())
            before=asdict(sim.state)
            AdministratorApp.act(app,sim.advance_to_next)
            app.inspect_interruption.assert_called_once()
            self.assertEqual(before,asdict(sim.state))
            AdministratorApp.resume_interruption(app)
            app.refresh.assert_called_with(rebuild_office=True)
            self.assertFalse(app.running)
            self.assertIsNone(tracker.current)
            hour,budget=sim.state.hour,sim.state.budget
            AdministratorApp.act(app,sim.advance_to_next)
            self.assertEqual(sim.state.hour,hour+8)
            self.assertFalse(sim.state.jobs)
            self.assertIsNotNone(sim.state.clearance)
            self.assertEqual(sim.state.budget,budget)

    def test_acknowledgement_does_not_clear_executive_issue(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        sim,tracker=self.ready_review()
        app=SimpleNamespace(sim=sim,interruptions=tracker,running=False,pacing=MissionPacing(0),observation=Observation(),refresh=Mock())
        before=asdict(sim.state)
        AdministratorApp.resume_interruption(app)
        self.assertEqual(before,asdict(sim.state))
        self.assertTrue(any(not decision['resolved'] for decision in sim.state.decisions))

    def test_inspection_routes_ground_report_to_daily_briefing(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        app=SimpleNamespace(sim=Simulation.new(11),navigate=Mock(),switch_location=Mock())
        AdministratorApp.inspect_interruption(app)
        app.navigate.assert_called_once_with('Daily briefing')
        app.switch_location.assert_not_called()
