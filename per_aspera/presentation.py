"""Plain-language navigation hints derived only from the public agency briefing."""
from .definitions import SCENARIO

TEST_NAMES = {
    "opening": "Initial pressure discrepancy",
    "flow": "Compare fuel-flow readings",
    "thermal": "Check the pressure sensor",
    "integration": "Rehearse the mission systems",
    "crew": "Practise crew contingencies",
    "flight": "Flight observations",
}
QUESTIONS = {
    "flow": "Is the fuel flow changing, or is the flight instrument misleading us?",
    "thermal": "Does temperature change the sensor's reading when pressure is held steady?",
    "integration": "Do propulsion and guidance behave within the intended mission's operating limits?",
    "crew": "Can the crew coordinate the planned contingency procedures?",
}
HYPOTHESES = {"unresolved": "I haven't reached a conclusion", "feed": "A propellant-feed problem", "sensor": "A pressure-sensor problem", "guidance": "A guidance-workload problem"}
CHANNELS = {"pressure_channel_discrepancy": "Pressure-channel discrepancy", "reference_flow_ripple": "Independent flow variation", "flight_channel_ripple": "Flight-instrument variation", "thermal_zero_shift": "Sensor shift with temperature", "processor_occupancy": "Processor workload"}


def next_step(view):
    """Suggest a workflow, not the correct diagnosis or an authorised safety waiver."""
    if view["stage"] == "closed":
        return ("Programme complete", "Review the mission outcomes and decisions retained in your record.", "Open programme record", "record")
    if view["flight"]:
        phase = view["flight"]
        return (phase["phase"], phase["operations"] + f". The next phase is due in {phase['remaining']} hours.", "Continue to next phase", "advance")
    if view["jobs"]:
        hours = min(job["hours_left"] for job in view["jobs"])
        return ("Your teams are working", f"{len(view['jobs'])} assignment(s) in progress. The next report is due in {hours} hours. You can wait or inspect the work.", "Wait for next report", "advance")
    finding = next((item for item in view["findings"] if item["open"] and item["revision"] == view["revision"]), None)
    if finding:
        name = SCENARIO["components"][finding["component"]]["name"]
        return ("Assurance has withheld clearance", f"{name} has an operating-envelope concern. Read the finding before choosing further tests or a change.", "Review the finding", "findings")
    current = [item for item in view["evidence"] if item["mission"] == view["mission"]["id"] and item["revision"] == view["revision"]]
    methods = {item["method"] for item in current}
    if methods <= {"opening"}:
        return ("A pressure reading needs explaining", "The rehearsal showed a discrepancy. Staff have competing explanations; no root cause is established. Choose a comparison or ask a manager to plan the investigation.", "Choose an investigation", "tests")
    if "integration" not in methods:
        return ("Review the evidence, then test the mission", "You have comparison results, but this mission and configuration still need an integration rehearsal.", "Read the latest findings", "findings")
    if view["crew"] != "Contingency preparation documented":
        return ("The crew needs contingency practice", "Systems evidence is available. Crew preparation is the next readiness requirement.", "Plan crew practice", "crew")
    if not view["clearance"]:
        return ("Ready for independent assessment", "The systems rehearsal and crew preparation are recorded. Mission Assurance must assess the evidence before launch. Required review: 8 hours, funded from the qualification account.", "Request readiness review · $30,000", "clearance")
    if view["launch_blocks"]:
        return ("Clearance received — await the opportunity", "\n".join(view["launch_blocks"]), "Wait for mission opportunity", "advance")
    return ("Your mission is ready for authorisation", f"Independent clearance is current. Residual uncertainty remains; you decide whether to commit the mission. Estimated approved profile: {sum(phase['hours'] for phase in view['mission']['phases'])} hours. Funding: $100,000 from the operations account; the reserve is not charged.", "Authorise mission · $100,000", "launch")


def minimum_remaining_cost(view):
    """Public lower bound for a successful remaining campaign; excludes already committed work."""
    if view["stage"] == "closed":
        return 0
    index = next(index for index, mission in enumerate(SCENARIO["missions"]) if mission["id"] == view["mission"]["id"])
    cost = (len(SCENARIO["missions"]) - index - 1) * 255000
    if view["stage"] == "preparation":
        current = [item for item in view["evidence"] if item["mission"] == view["mission"]["id"] and item["revision"] == view["revision"]]
        planned = {job["target"] for job in view["jobs"]}
        if not any(item["method"] == "integration" for item in current) and "integration" not in planned:
            cost += 90000
        if view["crew"] != "Contingency preparation documented" and "crew" not in planned:
            cost += 35000
        if not view["clearance"] and "readiness" not in planned:
            cost += 30000
        cost += 100000
    return cost
