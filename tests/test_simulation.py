from copy import deepcopy
from dataclasses import asdict
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from per_aspera.engine import Simulation, RuleError
from per_aspera.demo import demonstrate
from per_aspera.persistence import load, save, SaveError


def finish_jobs(sim):
    while sim.state.jobs:
        sim.advance_to_next()


def prepare_fixture(sim, faults=0.08):
    """Controlled engineering fixture; this is not a player-accessible cheat or outcome script."""
    sim.state.faults = dict.fromkeys(sim.state.faults, faults)
    sim.order_test("integration", "hayes")
    sim.order_test("crew", "bennett")
    finish_jobs(sim)
    sim.request_clearance()
    finish_jobs(sim)


class SimulationTests(unittest.TestCase):
    def test_same_seed_same_events_and_reality(self):
        first, second = Simulation.new(17), Simulation.new(17)
        for sim in (first, second):
            sim.order_test("thermal")
            sim.advance(12)
        self.assertEqual(asdict(first.state), asdict(second.state))

    def test_three_truths_remain_separate(self):
        first, second = Simulation.new(7), Simulation.new(7)
        first.set_hypothesis("feed", "Pressure trace suggests feed behaviour.")
        second.set_hypothesis("sensor", "Could be a thermal measurement artefact.")
        self.assertEqual(first.state.faults, second.state.faults)
        for sim in (first, second):
            sim.order_test("thermal")
            sim.advance(12)
        self.assertEqual(first.state.evidence[-1].observations, second.state.evidence[-1].observations)
        self.assertNotEqual(first.briefing()["player"], second.briefing()["player"])

    def test_public_projection_does_not_expose_truth_or_traits(self):
        public = Simulation.new(11).briefing()
        for private in ("faults", "rng_state", "fatigue", "candour", "beliefs", "directness", "expertise"):
            self.assertNotIn('"' + private + '"', json.dumps(public))
        self.assertEqual(len(public["staff"]), 4)

    def test_staff_have_distinct_interpretations(self):
        sim = Simulation.new(11)
        self.assertGreater(len({item["interpretation"] for item in sim.opinions()}), 1)
        before = deepcopy(sim.state.staff["hayes"].beliefs)
        sim.state.faults["sensor"] = .9
        sim.order_test("thermal")
        sim.advance(12)
        self.assertGreater(sim.state.staff["hayes"].beliefs["sensor"], before["sensor"])

    def test_work_completes_only_after_time_advances(self):
        sim = Simulation.new(11)
        sim.order_test("thermal")
        initial = len(sim.state.evidence)
        sim.advance(11)
        self.assertEqual(len(sim.state.evidence), initial)
        sim.advance(1)
        self.assertEqual(len(sim.state.evidence), initial + 1)
        self.assertFalse(sim.state.jobs)

    def test_capacity_and_invalid_commands_do_not_spend(self):
        sim = Simulation.new(11)
        sim.order_test("thermal", "hayes")
        before = asdict(sim.state)
        with self.assertRaises(RuleError):
            sim.order_test("flow", "hayes")
        self.assertEqual(asdict(sim.state), before)
        with self.assertRaises(RuleError):
            sim.order_test("unknown")
        sim.order_test("flow", "mercer")
        with self.assertRaises(RuleError):
            sim.order_test("crew", "bennett")

    def test_bounded_delegation_escalates_without_overspending(self):
        sim = Simulation.new(3)
        before = sim.state.budget
        sim.delegate(spending_limit=45000, hours_limit=48)
        sim.advance(80)
        self.assertEqual(sim.state.delegation["status"], "escalated")
        self.assertLessEqual(before - sim.state.budget, 45000)
        self.assertTrue(sim.state.decisions)
        self.assertEqual(sim.state.revision, 1)

    def test_delegation_executes_real_tests_and_stops_at_time_limit(self):
        sim = Simulation.new(3)
        sim.delegate(spending_limit=300000, hours_limit=25)
        sim.advance(40)
        self.assertGreater(len(sim.state.evidence), 1)
        self.assertEqual(sim.state.delegation["status"], "escalated")
        self.assertTrue(all(job.due <= 25 for job in sim.state.jobs))

    def test_break_is_contextual_and_never_a_hardware_fix(self):
        tired, productive, missing = (Simulation.new(10) for _ in range(3))
        tired.state.meeting.update(fatigue=.8, progress=.3, missing=False)
        productive.state.meeting.update(fatigue=.2, progress=.8, missing=False)
        missing.state.meeting.update(fatigue=.2, progress=.2, missing=True)
        for sim in (tired, productive, missing):
            original = dict(sim.state.faults)
            sim.intervene("break")
            self.assertEqual(original, sim.state.faults)
        self.assertLess(tired.state.meeting["fatigue"], .8)
        self.assertLess(productive.state.meeting["progress"], .8)
        self.assertEqual(missing.state.meeting["progress"], .2)
        self.assertTrue(missing.state.meeting["missing"])

    def test_incidental_participant_does_not_become_persistent(self):
        sim = Simulation.new(3)
        people = tuple(sim.state.staff)
        reality = dict(sim.state.faults)
        for _ in range(4):
            sim.intervene("outsider")
        self.assertEqual(tuple(sim.state.staff), people)
        self.assertEqual(sim.state.faults, reality)
        self.assertTrue(any(event.kind == "intervention" for event in sim.state.events))
        self.assertTrue(sim.state.staff["hayes"].memories)

    def test_staff_can_challenge_administrator(self):
        sim = Simulation.new(11)
        sim.state.meeting.update(progress=.8, fatigue=.2, missing=False)
        sim.intervene("break")
        self.assertIn("Please let us finish", sim.state.meeting["last"])

    def test_player_cannot_bypass_independent_review(self):
        sim = Simulation.new(11)
        before = sim.state.budget
        with self.assertRaises(RuleError):
            sim.launch()
        with self.assertRaises(RuleError):
            sim.request_clearance()
        self.assertEqual(sim.state.budget, before)
        self.assertEqual(sim.state.stage, "preparation")

    def test_clearance_uses_evidence_not_secret_truth(self):
        first, second = Simulation.new(11), Simulation.new(11)
        for sim in (first, second):
            prepare_fixture(sim)
            sim.state.clearance = None
        second.state.faults["feed"] = .95
        for sim in (first, second):
            sim.request_clearance()
            finish_jobs(sim)
        self.assertEqual(first.state.clearance, second.state.clearance)

    def test_hardware_revision_and_new_evidence_invalidate_clearance(self):
        sim = Simulation.new(11)
        prepare_fixture(sim)
        self.assertIsNotNone(sim.state.clearance)
        sim.order_test("thermal")
        finish_jobs(sim)
        self.assertIsNone(sim.state.clearance)
        sim.request_clearance()
        finish_jobs(sim)
        self.assertIsNotNone(sim.state.clearance)
        sim.repair("feed")
        finish_jobs(sim)
        self.assertEqual(sim.state.revision, 2)
        self.assertIsNone(sim.state.clearance)
        with self.assertRaises(RuleError):
            sim.request_clearance()

    def test_tests_keep_original_configuration_while_repair_runs(self):
        sim = Simulation.new(11)
        old = dict(sim.state.faults)
        sim.repair("sensor", "mercer")
        sim.order_test("integration", "hayes")
        sim.advance(24)
        self.assertEqual(sim.state.revision, 2)
        self.assertEqual(sim.state.evidence[-1].revision, 1)
        self.assertEqual(sim.state.faults["feed"], old["feed"])
        self.assertIn("needs an integration", " ".join(sim.readiness_blocks()))

    def test_confirmed_operating_concern_blocks_launch(self):
        sim = Simulation.new(11)
        prepare_fixture(sim, .9)
        self.assertIsNone(sim.state.clearance)
        self.assertTrue(any(item["open"] for item in sim.state.findings))
        sim.advance_to_next()
        with self.assertRaises(RuleError):
            sim.launch()

    def test_success_does_not_qualify_the_next_mission(self):
        sim = Simulation.new(11)
        prepare_fixture(sim)
        sim.advance_to_next()
        sim.launch()
        while sim.state.stage == "flight":
            sim.advance_to_next()
        self.assertEqual(sim.state.results[-1]["outcome"], "objective_complete")
        self.assertEqual(sim.mission["id"], "apollo10")
        self.assertIsNone(sim.state.clearance)
        self.assertTrue(any("integration" in reason for reason in sim.readiness_blocks()))

    def test_several_outcomes_follow_actual_margins(self):
        outcomes = set()
        for faults, crew, fatigue in ((.05, .95, .1), (.65, .85, .2), (1.0, .1, .9)):
            sim = Simulation.new(11)
            prepare_fixture(sim)
            sim.state.mission_index = 2
            # Inject an approved in-flight configuration to exercise the numerical outcome model.
            sim._spend(100000, "operations", "Fixture flight")
            sim.state.stage = "flight"
            sim.state.flight = {"phase": 0, "elapsed": 0, "fuel": 100.0, "aborted": False, "crew_lost": False, "objective": False, "snapshot": {"faults": dict.fromkeys(sim.state.faults, faults), "fatigue": fatigue, "crew": crew, "environment": 1.0}, "cause": sim.state.events[0].id, "anomalies": []}
            while sim.state.stage == "flight":
                sim.advance_to_next()
            outcomes.add(sim.state.results[-1]["outcome"])
        self.assertEqual(outcomes, {"objective_complete", "safe_return_objective_incomplete", "crew_loss"})

    def test_demo_runs_apollo9_through_apollo11(self):
        sim = demonstrate(11)
        self.assertEqual([item["mission"] for item in sim.state.results], ["apollo9", "apollo10", "apollo11"])
        self.assertTrue(sim.state.results[-1]["samples"])
        self.assertEqual(sim.state.stage, "closed")
        self.assertGreaterEqual(sim.state.budget, 0)
        self.assertEqual(len(sim.state.staff), 4)

    def test_cancel_is_recorded_and_stops_advancement(self):
        sim = Simulation.new(11)
        sim.cancel("Resources redirected; engineering records retained.")
        hour = sim.state.hour
        sim.advance(10)
        self.assertEqual(hour, sim.state.hour)
        self.assertEqual(sim.state.events[-1].title, "Programme ended by Administrator")


class PersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (Path(__file__).resolve().parent.parent / "tmp").mkdir(exist_ok=True)

    def test_active_investigation_save_continues_exactly(self):
        sim = Simulation.new(11)
        sim.delegate(spending_limit=250000, hours_limit=72)
        sim.advance(6)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / "tmp") as folder:
            path = Path(folder) / "campaign.json"
            save(sim.state, path)
            resumed = Simulation(load(path))
        for instance in (sim, resumed):
            instance.advance(70)
        self.assertEqual(asdict(sim.state), asdict(resumed.state))

    def test_active_flight_save_continues_exactly(self):
        sim = Simulation.new(11)
        prepare_fixture(sim)
        sim.advance_to_next()
        sim.launch()
        sim.advance(2)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / "tmp") as folder:
            path = Path(folder) / "flight.json"
            save(sim.state, path)
            resumed = Simulation(load(path))
        for instance in (sim, resumed):
            while instance.state.stage == "flight":
                instance.advance_to_next()
        self.assertEqual(asdict(sim.state), asdict(resumed.state))

    def test_rejects_corrupt_unknown_and_changed_content_saves(self):
        for corruption in (lambda data: data.update(version=99), lambda data: data.update(hour=-1), lambda data: data.update(rng_state=[1]), lambda data: data.update(content_id="different"), lambda data: data["staff"]["hayes"].update(memories=["missing"])):
            data = asdict(Simulation.new(11).state)
            corruption(data)
            with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / "tmp") as folder:
                path = Path(folder) / "bad.json"
                original = json.dumps(data)
                path.write_text(original, encoding="utf-8")
                with self.assertRaises(SaveError):
                    load(path)
                self.assertEqual(path.read_text(encoding="utf-8"), original)

    def test_atomic_save_preserves_previous_file_on_replace_failure(self):
        state = Simulation.new(11).state
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent / "tmp") as folder:
            path = Path(folder) / "agency.json"
            save(state, path)
            original = path.read_bytes()
            with patch("per_aspera.persistence.os.replace", side_effect=OSError("disk unavailable")):
                with self.assertRaises(OSError):
                    save(state, path)
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(Path(folder).glob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
