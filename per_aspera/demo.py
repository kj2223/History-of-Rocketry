"""A reproducible example policy using agency observations, never hidden reality."""
from .engine import Simulation, RuleError
from . import finance
from .definitions import SCENARIO


def demonstrate(seed=11):
    return run_policy(Simulation.new(seed))


def run_policy(sim, comparison_rounds=1):
    """Audit policy; extra rounds intentionally model repeated investigation, not better knowledge."""
    def fund(account, cost):
        short = max(0, cost - finance.available(sim.state.finance["lines"][account]))
        if short:
            sim.reallocate("reserve", account, short, "Fund planned qualification in the example policy; defer other reserve uses.")

    sim.intervene("evidence")
    sim.intervene("step_aside")
    for _ in range(3):
        if sim.state.stage == "closed":
            break
        for _ in range(comparison_rounds):
            fund("engineering", 95000)
            sim.order_test("flow", "mercer")
            sim.order_test("thermal", "hayes")
            while sim.state.jobs:
                sim.advance_to_next()
        observations = {key: value for item in sim.briefing()["evidence"] if item["mission"] == sim.mission["id"] and item["revision"] == sim.state.revision for key, value in item["observations"].items()}
        for component, channel, threshold in (("feed", "reference_flow_ripple", .40), ("sensor", "thermal_zero_shift", .48)):
            if observations.get(channel, 0) > threshold:
                sim.set_hypothesis(component, f"The controlled {channel} measurement warrants a targeted change, subject to requalification.")
                fund("engineering", SCENARIO["components"][component]["repair_cost"])
                sim.repair(component)
                sim.advance_to_next()
        for attempt in range(3):
            fund("readiness", 125000)
            sim.order_test("integration", "hayes")
            sim.order_test("crew", "bennett")
            while sim.state.jobs:
                sim.advance_to_next()
            integration = sim.briefing()["evidence"][-1]
            if integration["observations"].get("processor_occupancy", 0) > .70:
                fund("engineering", SCENARIO["components"]["guidance"]["repair_cost"])
                sim.repair("guidance")
                sim.advance_to_next()
                continue
            fund("readiness", 30000)
            sim.request_clearance()
            sim.advance_to_next()
            if sim.state.clearance:
                break
            finding = next((item for item in sim.state.findings if item["open"]), None)
            if finding:
                fund("engineering", SCENARIO["components"][finding["component"]]["repair_cost"])
                sim.repair(finding["component"])
                sim.advance_to_next()
        if not sim.state.clearance:
            raise RuleError("The example policy could not obtain clearance; use the interface to investigate further.")
        if sim.state.hour < sim.window_hour():
            sim.advance_to_next()
        sim.launch()
        while sim.state.stage == "flight":
            sim.advance_to_next()
        if not sim.state.results[-1]["outcome"] == "objective_complete":
            break
    return sim
