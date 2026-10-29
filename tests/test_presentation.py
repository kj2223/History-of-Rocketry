import json
import unittest

from per_aspera.engine import Simulation
from per_aspera.presentation import next_step, TEST_NAMES, HYPOTHESES


class PresentationTests(unittest.TestCase):
    def test_opening_offers_investigation_not_launch(self):
        view = Simulation.new(11).briefing()
        self.assertEqual(next_step(view)[3], "tests")
        self.assertNotIn("faults", json.dumps(next_step(view)))

    def test_active_work_offers_wait_and_due_time(self):
        sim = Simulation.new(11)
        sim.order_test("thermal")
        hint = next_step(sim.briefing())
        self.assertEqual(hint[3], "advance")
        self.assertIn("12 hours", hint[1])

    def test_clearance_does_not_offer_launch_before_window(self):
        view = Simulation.new(11).briefing()
        view["evidence"].append({"method": "integration", "mission": "apollo9", "revision": 1})
        view["crew"] = "Contingency preparation documented"
        self.assertEqual(next_step(view)[3], "clearance")
        view["clearance"] = {"mission": "apollo9", "revision": 1}
        view["launch_blocks"] = ["Mission opportunity has not opened."]
        self.assertEqual(next_step(view)[3], "advance")
        view["launch_blocks"] = []
        self.assertEqual(next_step(view)[3], "launch")

    def test_labels_are_presentations_of_domain_ids(self):
        self.assertEqual(set(HYPOTHESES), {"unresolved", "feed", "sensor", "guidance"})
        self.assertIn("crew", TEST_NAMES)


if __name__ == "__main__":
    unittest.main()
