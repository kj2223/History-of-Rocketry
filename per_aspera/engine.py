"""Authoritative simulation. Commands validate first; interfaces only read briefings and submit choices."""
from copy import deepcopy
from datetime import datetime, timedelta
import math
import random

from .definitions import SCENARIO, STAFF, DOMAINS, CONTENT_ID
from . import finance
from .mission_contact import reply, DIALOGUE
from .continuity import launch_context, launch_voices
from .trajectory import PROFILE, trajectory
from .model import State, Person, Event, Evidence, Job


class RuleError(ValueError):
    """A command cannot be performed in the current agency state."""


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def tuples(value):
    return tuple(tuples(item) for item in value) if isinstance(value, (tuple, list)) else value


class Simulation:
    def __init__(self, state: State):
        self.state = state
        if not state.finance:
            finance.initialise(state, legacy=True)
        self.rng = random.Random()
        self.rng.setstate(tuples(state.rng_state))
        if not state.transcript:
            for event in state.events:
                self._record_transcript(event)

    @classmethod
    def new(cls, seed=11):
        if type(seed) is not int or not 0 <= seed < 2**32:
            raise RuleError("Seed must be an integer from 0 to 4,294,967,295.")
        rng = random.Random(seed)
        faults = {key: rng.uniform(0.06, 0.78) for key in DOMAINS}
        people = {}
        for profile in STAFF:
            beliefs = {key: clamp(SCENARIO["components"][key]["prior"] + (0.13 if profile["bias"] == key else -0.03) + .08 * (profile["caution"] - .5)) for key in DOMAINS}
            people[profile["id"]] = Person(profile["id"], beliefs)
        state = State(seed, 0, SCENARIO["budget"], faults, people, rng.getstate(), content_id=CONTENT_ID)
        finance.initialise(state)
        sim = cls(state)
        sim._event("briefing", "The lunar programme", SCENARIO["events"]["opening"])
        sim._observe("opening", "Preflight rehearsal, ambient instrument channel; independent reference unavailable.", "Do not infer the initiating fault from one channel.", "Rehearsal team")
        sim.open_review()
        return sim

    @property
    def mission(self):
        return SCENARIO["missions"][self.state.mission_index]

    def date(self,hour=None,second=None):
        second=(self.state.second if hour is None else 0) if second is None else second
        date=datetime.fromisoformat(SCENARIO['start'])+timedelta(hours=self.state.hour if hour is None else hour,seconds=second)
        return date.strftime('%d %b %Y · %H:%M:%S' if second else '%d %b %Y · %H:%M')

    def _id(self, prefix):
        self.state.sequence += 1
        return f"{prefix}{self.state.sequence:05d}"

    def _event(self, kind, title, detail, actor="Administrator", links=(), interruption=""):
        event = Event(self._id("E"), self.state.hour, kind, title, detail, actor, self.mission["id"], self.state.revision, list(links), interruption, self.state.second)
        self.state.events.append(event)
        self._record_transcript(event)
        self.state.rng_state = self.rng.getstate()
        return event.id

    def _record_transcript(self,event):
        if event.kind in ('mission','phase','operations','outcome','launch','continuity') or event.kind=='evidence' and event.actor=='Flight Control':
            self.state.transcript.append({'id':'T-'+event.id,'hour':event.hour,'second':event.second,'mission':event.mission,'speaker':event.actor,'kind':'mission_event','text':event.title+'. '+event.detail,'links':[event.id]})

    def request_mission_briefing(self,question,contact='flight_director',mission_id=None):
        mission_id=mission_id or self.mission['id']
        if mission_id not in {mission['id'] for mission in SCENARIO['missions']}:
            raise RuleError('Unknown mission.')
        try:
            speaker,text,links=reply(self.briefing(),mission_id,contact,question)
        except ValueError as error:
            raise RuleError(str(error)) from error
        for actor,kind,line in (('Administrator','question',DIALOGUE['questions'][question]['label']+' To '+speaker),(speaker,'briefing',text)):
            self.state.transcript.append({'id':'Q-'+str(len(self.state.transcript)+1),'hour':self.state.hour,'second':self.state.second,'mission':mission_id,'speaker':actor,'kind':kind,'text':line,'links':links})
        return text

    def set_administrator_abort_rule(self,enabled):
        self._preparing()
        if type(enabled) is not bool:
            raise RuleError('Choose a boolean alternate-history rule.')
        self.state.rules['administrator_abort']=enabled
        self._event('decision','Alternate-history abort authority '+('enabled' if enabled else 'disabled'),'Administrator direct abort is an optional fiction. Crew emergency authority and protection against unsafe continuation remain unconditional.')

    def administrator_abort(self):
        if not self.state.rules['administrator_abort']:
            raise RuleError('Grounded rules: operational abort authority remains with Flight Control and the crew.')
        if not self.state.flight or self.state.stage!='flight' or self.state.flight['aborted']:
            raise RuleError('No active continuing mission objective to discontinue.')
        self.state.flight['aborted']=True
        self._event('operations','Administrator discontinues objective (alternate history)','Flight Control owns the return contingency. No manoeuvre command or guarantee of recovery is implied. Crew emergency authority cannot be overridden.',interruption='observation')

    def _preparing(self):
        if self.state.stage != "preparation":
            raise RuleError("This action is available during mission preparation.")

    def funding_block(self, cost, account):
        line = self.state.finance["lines"][account]
        free = finance.available(line)
        if free >= cost:
            return ""
        return (f"{line['name']} has ${free:,} uncommitted; this action needs ${cost:,} "
                f"(${cost - free:,} short). Existing commitments are protected. "
                "Revise the proposed scope, defer unstarted work and reallocate its free funds, "
                "release available R&D reserve, or submit a funding request. No cross-appropriation transfer is authorised.")

    def _spend(self, cost, account="engineering", purpose="Engineering work"):
        reason = self.funding_block(cost, account)
        if reason:
            raise RuleError(reason)
        self.state.finance["lines"][account]["committed"] += cost
        self.state.budget -= cost
        self.state.finance["transactions"].append({"kind": "obligation", "hour": self.state.hour, "programme": "Apollo lunar programme", "account": account, "amount": cost, "purpose": purpose, "remaining": self.state.budget, "account_remaining": finance.available(self.state.finance["lines"][account])})

    def _settle(self, cost, account):
        line = self.state.finance["lines"][account]
        line["committed"] -= cost
        line["expended"] += cost

    def reallocate(self, source, destination, amount, rationale):
        self._preparing()
        f = self.state.finance
        if destination not in f["lines"] or source not in (*f["lines"], "reserve") or source == destination:
            raise RuleError("Choose different accounts within the R&D appropriation.")
        if type(amount) is not int or amount <= 0 or not isinstance(rationale, str) or not rationale.strip() or len(rationale) > 2000:
            raise RuleError("Enter a positive whole-dollar amount and a reason under 2,000 characters.")
        src = f["lines"].get(source)
        appropriation = src["appropriation"] if src else f["reserve_appropriation"]
        if appropriation != f["lines"][destination]["appropriation"]:
            raise RuleError("Transfers between appropriations require external statutory authority; unavailable in this slice.")
        free = finance.available(src) if src else f["reserve"]
        if amount > free:
            raise RuleError(f"Only ${free:,} is legally uncommitted in the source. Authorised work cannot be defunded.")
        if src:
            src["allocation"] -= amount
        else:
            f["reserve"] -= amount
        f["lines"][destination]["allocation"] += amount
        f["transactions"].append({"kind": "reallocation", "hour": self.state.hour, "programme": "Apollo lunar programme", "account": destination, "source": source, "amount": amount, "purpose": rationale.strip(), "remaining": self.state.budget, "account_remaining": finance.available(f["lines"][destination])})
        self._event("funding", "Programme allocation revised", f"${amount:,} from {src['name'] if src else 'Administrator reserve'} to {f['lines'][destination]['name']}. {rationale.strip()} No new appropriation; existing commitments unchanged.")

    def request_funding(self, account, amount, rationale):
        self._preparing()
        f = self.state.finance
        if account not in f["lines"] or type(amount) is not int or not 0 < amount <= 200000 or not isinstance(rationale, str) or not rationale.strip() or len(rationale) > 2000:
            raise RuleError("Request $1–$200,000 for a listed account with a reason under 2,000 characters.")
        if any(item["fiscal_year"] == f["fiscal_year"] for item in f["requests"]):
            raise RuleError("One consolidated supplemental request is allowed per fiscal year in this prototype. Reallocate existing funds or revise scope meanwhile.")
        event = self._event("funding", "Supplemental request submitted", f"${amount:,} requested for {f['lines'][account]['name']}. {rationale.strip()} Recorded for external consideration only. Adjudication is deferred in this prototype; no new funds are granted.")
        f["requests"].append({"line": account, "amount": amount, "rationale": rationale.strip(), "fiscal_year": f["fiscal_year"], "status": "pending", "event": event})

    def _funding_tick(self):
        f = self.state.finance
        year = finance.fiscal_year(self.state.hour)
        if year != f["fiscal_year"]:
            f["fiscal_year"] = year
            self._event("funding", f"Fiscal year {year} opened", "The no-year R&D balance and existing obligations carry forward unchanged. No new appropriation has been enacted automatically.", "Budget office")
    def _available(self, lead):
        if lead not in self.state.staff:
            raise RuleError("Unknown staff member.")
        if len(self.state.jobs) >= SCENARIO["workforce"]["teams"]:
            raise RuleError("Both engineering teams are committed. Advance time to the next report.")
        if any(job.lead == lead for job in self.state.jobs):
            raise RuleError("That lead is already accountable for work in progress.")

    def set_hypothesis(self, hypothesis, rationale=""):
        self._preparing()
        if hypothesis not in (*DOMAINS, "unresolved") or not isinstance(rationale, str) or len(rationale) > 2000:
            raise RuleError("Choose a listed working hypothesis and a note under 2,000 characters.")
        self.state.player_hypothesis = hypothesis
        self.state.player_rationale = rationale.strip()
        return self._event("interpretation", "Administrator's working interpretation", f"{hypothesis}: {rationale.strip() or 'No supporting rationale recorded.'}")

    def order_test(self, method, lead="hayes", cause=""):
        self._preparing()
        if method not in SCENARIO["tests"]:
            raise RuleError("Unknown test method.")
        if any(job.kind == "test" and job.target == method for job in self.state.jobs):
            raise RuleError("That test is already in progress.")
        self._available(lead)
        definition = SCENARIO["tests"][method]
        self._spend(definition["cost"], finance.line_for("test", method), definition["name"])
        event = self._event("decision", "Test authorised", f"{definition['name']}; ${definition['cost']:,}; {definition['hours']} hours. {definition['description']}", links=[cause] if cause else [])
        self.state.jobs.append(Job(self._id("J"), "test", method, lead, self.state.hour, self.state.hour + definition["hours"], definition["cost"], self.state.revision, self.mission["id"], self._snapshot(), event))
        return event

    def _snapshot(self):
        return {"faults": dict(self.state.faults), "fatigue": self.state.fatigue, "crew": self.state.crew_readiness, "environment": self.mission["environment"]}

    def repair(self, component, lead="mercer"):
        self._preparing()
        if component not in DOMAINS:
            raise RuleError("Unknown component.")
        if any(job.kind == "repair" for job in self.state.jobs):
            raise RuleError("Finish the existing configuration change first.")
        self._available(lead)
        definition = SCENARIO["components"][component]
        self._spend(definition["repair_cost"], "engineering", "Modify " + definition["name"])
        event = self._event("decision", "Configuration change authorised", f"Revise {definition['name']}; ${definition['repair_cost']:,}; {definition['repair_hours']} hours. This targets one mechanism; integration and readiness must be repeated.")
        self.state.jobs.append(Job(self._id("J"), "repair", component, lead, self.state.hour, self.state.hour + definition["repair_hours"], definition["repair_cost"], self.state.revision, self.mission["id"], self._snapshot(), event))
        return event

    def open_review(self):
        self._preparing()
        if self.state.meeting:
            raise RuleError("An engineering review is already open.")
        self.state.meeting = {"fatigue": self.state.fatigue, "progress": self.rng.random() * .6, "missing": not any(item.method != "opening" for item in self._current_evidence()), "rounds": 0, "last": "The team disagrees about the pressure discrepancy. Their confidence and evidence differ."}
        self._event("meeting", "Engineering review convened", self.state.meeting["last"], "Nora Bennett")
        self._report_opinions()

    def _profile(self, staff_id):
        return next(profile for profile in STAFF if profile["id"] == staff_id)

    def _remember(self, event):
        for person in self.state.staff.values():
            person.memories.append(event)

    def _current_evidence(self):
        return [item for item in self.state.evidence if item.revision == self.state.revision and item.mission == self.mission["id"]]

    def intervene(self, action):
        self._preparing()
        meeting = self.state.meeting
        if not meeting or action not in ("continue", "break", "outsider", "evidence", "step_aside", "insist"):
            raise RuleError("Open a review and choose a listed intervention.")
        meeting["rounds"] += 1
        challenge = self._challenge(action)
        if action == "continue":
            if meeting["fatigue"] > .68:
                meeting["fatigue"] = clamp(meeting["fatigue"] + .08)
                text = "The same claims recur. Tired participants are no closer to a discriminating test."
            elif not meeting["missing"] and meeting["progress"] > .35:
                meeting["progress"] = clamp(meeting["progress"] + .22)
                text = "The engineers compare falsifiable claims. They narrow the next test's conditions; this is progress, not a diagnosis."
            else:
                meeting["progress"] = clamp(meeting["progress"] + .04)
                text = "Discussion exposes an untested assumption. The team still needs measurements."
        elif action == "break":
            if meeting["fatigue"] > .6:
                meeting["fatigue"] = max(.15, meeting["fatigue"] - .35)
                text = "The pause restores attention. The missing test data and physical hardware remain unchanged."
            elif meeting["progress"] > .5 and not meeting["missing"]:
                meeting["progress"] -= .25
                text = "The interruption breaks a useful comparison. Staff must reconstruct the argument before continuing."
            else:
                text = "A short pause changes the atmosphere, but the missing evidence has not arrived."
        elif action == "outsider":
            if len(self.state.jobs) >= SCENARIO["workforce"]["teams"] or self.rng.random() < .18:
                text = "The available technician declines: their current test cannot be left unattended. No new specialist is added to the staff roster."
            else:
                profile = self.rng.choice(SCENARIO["events"]["outsiders"])
                tested = any(item.method == profile["test"] for item in self._current_evidence())
                text = f"An incidental {profile['role']} asks: ‘{profile['question']}’ "
                if tested:
                    text += "The specialists point to an existing comparison. It does not answer every open question."
                else:
                    text += f"The team proposes {SCENARIO['tests'][profile['test']]['name']}. This is a test suggestion, not a hardware clearance."
                    meeting["suggested_test"] = profile["test"]
                    meeting["progress"] = clamp(meeting["progress"] + .1)
        elif action == "evidence":
            meeting["missing"] = not bool(self._current_evidence())
            text = "Each participant states what measurement would change their conclusion. "
            text += "There is current evidence to compare." if not meeting["missing"] else "The review identifies an evidence gap; repeating the argument will not fill it."
            meeting["progress"] = clamp(meeting["progress"] + .1)
        elif action == "step_aside":
            text = "The Administrator leaves the technical team accountable for its next test and requests a report. Independent assurance retains its authority."
            self.state.meeting = None
        else:
            self.state.candour = max(.15, self.state.candour - .08)
            text = "The Administrator insists on their interpretation. Participants document the unresolved technical question; public agreement does not change the evidence."
        self.state.fatigue = meeting["fatigue"]
        if self.state.meeting is not None:
            meeting["last"] = f"{challenge} {text}".strip()
        event = self._event("intervention", "Review intervention", f"{action.replace('_', ' ')}. {challenge} {text}".strip())
        self._remember(event)
        # Meetings consume real programme time, but are not physical fixes or evidence generators.
        self.advance(1)
        return event

    def _challenge(self, action):
        candidates = []
        for profile in STAFF:
            person = self.state.staff[profile["id"]]
            fair_history = sum(self._event_by_id(item).kind == "intervention" and "step aside" in self._event_by_id(item).detail for item in person.memories)
            willingness = profile["directness"] * self.state.candour + min(.15, fair_history * .03)
            conflict = self.state.player_hypothesis != "unresolved" and person.beliefs[self.state.player_hypothesis] < max(person.beliefs.values()) - .10
            interruption = action == "break" and self.state.meeting["progress"] > .5 and self.state.meeting["fatigue"] < .6
            if willingness > .48 and (conflict or interruption):
                candidates.append(profile)
        if not candidates:
            return ""
        profile = max(candidates, key=lambda item: item["directness"])
        if action == "break" and self.state.meeting["progress"] > .5:
            return f"{profile['name']}: ‘Please let us finish the comparison. We may finally have a discriminating question.’"
        return f"{profile['name']}: ‘I do not think that conclusion follows yet. Test the competing explanation before committing to a redesign.’"

    def _event_by_id(self, event_id):
        return next(event for event in self.state.events if event.id == event_id)

    def _observations(self, method, snapshot):
        faults = snapshot["faults"]
        noise = lambda scale: self.rng.gauss(0, scale)
        if method == "flow":
            return {"reference_flow_ripple": round(clamp(faults["feed"] + noise(.06)), 3), "flight_channel_ripple": round(clamp(faults["feed"] + .35 * faults["sensor"] + noise(.08)), 3)}
        if method == "thermal":
            return {"thermal_zero_shift": round(clamp(faults["sensor"] + noise(.07)), 3)}
        if method in ("integration", "flight"):
            return {"reference_flow_ripple": round(clamp(faults["feed"] * snapshot["environment"] + noise(.10)), 3), "processor_occupancy": round(clamp(.35 + .65 * faults["guidance"] * snapshot["environment"] + .08 * snapshot["fatigue"] + noise(.05)), 3)}
        return {"pressure_channel_discrepancy": round(clamp(.55 * faults["feed"] + .55 * faults["sensor"] + noise(.10)), 3)}

    def _observe(self, method, conditions, caveat, source, snapshot=None, revision=None, mission=None, cause=""):
        readings = self._observations(method, snapshot or self._snapshot())
        event = self._event("evidence", "Observation received", f"{method}: " + "; ".join(f"{key.replace('_', ' ')} = {value:.3f}" for key, value in readings.items()) + f". {caveat}", source, [cause] if cause else [])
        item = Evidence(self._id("D"), self.state.hour, mission or self.mission["id"], revision or self.state.revision, method, readings, conditions, caveat, source, event)
        self.state.evidence.append(item)
        self._update_beliefs(item)
        if self.state.stage == "preparation" and self.state.clearance and item.revision == self.state.revision and item.mission == self.mission["id"]:
            self.state.clearance = None
            self._event("review", "New evidence requires renewed review", "A current-configuration observation arrived after clearance. Mission Assurance must consider it before launch.", "Dr Lila Ortiz", [item.id])
        return item

    def _update_beliefs(self, evidence):
        if evidence.revision != self.state.revision:
            return
        signals = {}
        for key, reading in evidence.observations.items():
            if key == "reference_flow_ripple":
                signals["feed"] = reading
            elif key == "thermal_zero_shift":
                signals["sensor"] = reading
            elif key == "processor_occupancy":
                signals["guidance"] = clamp((reading - .35) / .65)
        if not signals:
            return
        for profile in STAFF:
            beliefs = self.state.staff[profile["id"]].beliefs
            for domain, signal in signals.items():
                # A modest likelihood update preserves disagreement and uncertainty after a single test.
                strength = (.55 + .55 * profile["expertise"][domain]) * (.7 + .4 * profile["openness"])
                likelihood_ratio = math.exp((signal - .34) * 4 * strength)
                prior = beliefs[domain]
                beliefs[domain] = clamp(prior * likelihood_ratio / (1 - prior + prior * likelihood_ratio), .03, .96)

    def opinions(self):
        result = []
        for profile in STAFF:
            person = self.state.staff[profile["id"]]
            domain = max(person.beliefs, key=person.beliefs.get)
            belief = person.beliefs[domain]
            confidence = "strong concern" if belief > .7 else "provisional concern" if belief > .4 else "no dominant confirmed fault"
            method = {"feed": "flow", "sensor": "thermal", "guidance": "integration"}[domain]
            recommendation = f"Compare {SCENARIO['tests'][method]['name'].lower()} against the current configuration before concluding."
            if profile["caution"] > .75:
                recommendation += " Preserve conflicting findings; a successful flight is not a root-cause explanation."
            elif profile["caution"] < .4 and belief < .55:
                recommendation += " Keep the proposed mission opportunity if independent clearance supports it."
            result.append({"id": person.id, "name": profile["name"], "role": profile["role"], "record": profile["record"], "interpretation": f"{SCENARIO['components'][domain]['name']}: {confidence}.", "recommendation": recommendation, "memories": list(person.memories[-5:])})
        return result

    def _report_opinions(self):
        for opinion in self.opinions():
            self._event("staff_assessment", opinion["name"], opinion["interpretation"] + " " + opinion["recommendation"], opinion["name"])

    def delegate(self, manager="bennett", spending_limit=250000, hours_limit=72):
        self._preparing()
        if manager not in self.state.staff or type(spending_limit) is not int or not 0 < spending_limit <= sum(finance.available(line) for line in self.state.finance["lines"].values()) or type(hours_limit) is not int or not 1 <= hours_limit <= 336:
            raise RuleError("Choose a manager, an affordable positive spending limit and 1–336 hours.")
        event = self._event("delegation", "Bounded investigation delegated", f"{self._profile(manager)['name']}; at most ${spending_limit:,} and {hours_limit} hours. Testing only; no unapproved redesign or launch.")
        for decision in self.state.decisions:
            if not decision["resolved"]:
                decision["resolved"] = True
                decision["disposition"] = event
        self.state.delegation = {"manager": manager, "remaining": spending_limit, "deadline": self.state.hour + hours_limit, "completed": [], "status": "active", "cause": event}
        self._delegate_tick()

    def _delegate_tick(self):
        contract = self.state.delegation
        if not contract or contract["status"] != "active" or self.state.stage != "preparation":
            return
        if any(job.lead == contract["manager"] for job in self.state.jobs):
            return
        tested = {item.method for item in self._current_evidence()} | {job.target for job in self.state.jobs if job.kind == "test"}
        beliefs = self.state.staff[contract["manager"]].beliefs
        preferred = {"feed": "flow", "sensor": "thermal", "guidance": "integration"}[max(beliefs, key=beliefs.get)]
        plan = list(dict.fromkeys([preferred, "integration", "thermal", "flow", "crew"]))
        method = next((method for method in plan if method not in tested), None)
        if method is None:
            contract["status"] = "reported"
            self._event("delegation_report", "Manager returns the investigation", "The agreed comparisons are complete. Hardware changes and independent readiness review remain executive/assurance decisions.", self._profile(contract["manager"])["name"], [contract["cause"]])
            return
        definition = SCENARIO["tests"][method]
        if definition["cost"] > min(contract["remaining"], finance.available(self.state.finance["lines"][finance.line_for("test", method)])) or self.state.hour + definition["hours"] > contract["deadline"]:
            contract["status"] = "escalated"
            decision = {"id": self._id("Q"), "text": f"Manager requires {definition['name']} beyond the delegated cost/time boundary. Revise the agreement or choose a narrower test; defer unstarted work and reallocate free programme funds, release R&D reserve, or request supplemental funding. Direct authorisation still requires account funds.", "resolved": False}
            self.state.decisions.append(decision)
            self._event("escalation", "Delegation boundary reached", decision["text"], self._profile(contract["manager"])["name"], [contract["cause"]], interruption="action_required")
            return
        if len(self.state.jobs) >= SCENARIO["workforce"]["teams"]:
            return
        self.order_test(method, contract["manager"], contract["cause"])
        contract["remaining"] -= definition["cost"]
        contract["completed"].append(method)

    def readiness_blocks(self):
        reasons = []
        if self.state.stage != "preparation":
            return ["A mission is in flight or the programme is closed."]
        if self.state.jobs:
            reasons.append("Engineering work is still in progress.")
        if not any(item.method == "integration" for item in self._current_evidence()):
            reasons.append("The current mission/configuration needs an integration rehearsal.")
        if self.state.crew_readiness < .8:
            reasons.append("The crew needs contingency preparation.")
        if any(finding["open"] and finding["revision"] == self.state.revision for finding in self.state.findings):
            reasons.append("An independent safety finding needs corrective action or new discriminating evidence.")
        return reasons

    def request_clearance(self):
        self._preparing()
        reasons = [reason for reason in self.readiness_blocks() if not reason.startswith("An independent")]
        if reasons:
            raise RuleError(" ".join(reasons))
        self._available("ortiz")
        self._spend(30000, "readiness", "Independent readiness review")
        event = self._event("decision", "Independent readiness review commissioned", "Mission Assurance will assess current evidence, configuration and crew preparation; personal trust cannot waive findings.")
        self.state.jobs.append(Job(self._id("J"), "clearance", "readiness", "ortiz", self.state.hour, self.state.hour + 8, 30000, self.state.revision, self.mission["id"], self._snapshot(), event))

    def _finish_job(self, job):
        self._settle(job.cost, finance.line_for(job.kind, job.target))
        if job.kind == "test":
            if job.target == "crew":
                self.state.crew_readiness = clamp(self.state.crew_readiness + .18 * (1 - .3 * job.snapshot["fatigue"]))
                self._event("training", "Crew rehearsal completed", "The aggregate three-person crew practised contingency coordination. Qualification remains mission-specific.", self._profile(job.lead)["name"], [job.cause])
            else:
                definition = SCENARIO["tests"][job.target]
                self._observe(job.target, f"{job.mission} profile, configuration {job.revision}; controlled reference comparison.", definition["description"], self._profile(job.lead)["name"], job.snapshot, job.revision, job.mission, job.cause)
            if self.state.meeting:
                self.state.meeting["missing"] = not any(item.method != "opening" for item in self._current_evidence())
            self._report_opinions()
        elif job.kind == "repair":
            definition = SCENARIO["components"][job.target]
            self.state.faults[job.target] *= definition["repair_factor"]
            self.state.revision += 1
            self.state.clearance = None
            for person in self.state.staff.values():
                person.beliefs[job.target] = max(.15, person.beliefs[job.target] * .6)
            for finding in self.state.findings:
                if finding["component"] == job.target:
                    finding["open"] = False
            self._event("configuration", "Revised hardware released", f"{definition['name']}, assembly configuration {self.state.revision}. The change targets this mechanism; new integration evidence and clearance are required.", self._profile(job.lead)["name"], [job.cause])
        else:
            self._finish_clearance(job)

    def _finish_clearance(self, job):
        if job.revision != self.state.revision or job.mission != self.mission["id"]:
            self._event("review", "Readiness review superseded", "The configuration changed during review. No clearance was issued.", "Dr Lila Ortiz", [job.cause])
            return
        evidence = self._current_evidence()
        # Assurance sees observations, never the hidden fault magnitudes.
        concerns = []
        for component, channel, limit in [("feed", "reference_flow_ripple", .49), ("guidance", "processor_occupancy", .76)]:
            applicable = [item.observations[channel] for item in evidence if channel in item.observations]
            if applicable and sum(applicable) / len(applicable) > limit:
                concerns.append(component)
        for finding in self.state.findings:
            if finding["revision"] == self.state.revision and finding["component"] not in concerns:
                finding["open"] = False
        if concerns:
            for component in concerns:
                if not any(finding["revision"] == self.state.revision and finding["component"] == component and finding["open"] for finding in self.state.findings):
                    self.state.findings.append({"id": self._id("F"), "revision": self.state.revision, "component": component, "open": True, "evidence": [item.id for item in evidence]})
            self.state.clearance = None
            event = self._event("safety_finding", "Readiness clearance withheld", "Observed operating-envelope concern: " + ", ".join(SCENARIO["components"][item]["name"] for item in concerns) + ". Correct the configuration or supply a representative controlled comparison; the Administrator cannot waive this review.", "Dr Lila Ortiz", [job.cause] + [item.id for item in evidence], interruption="action_required")
        else:
            self.state.clearance = {"mission": self.mission["id"], "revision": self.state.revision, "hour": self.state.hour, "evidence": [item.id for item in evidence]}
            event = self._event("clearance", "Conditional mission clearance", "Current observations support this mission's operating envelope. Residual uncertainty remains; this is not proof of a fault-free design or qualification for the next mission.", "Dr Lila Ortiz", [job.cause] + [item.id for item in evidence])
        self._remember(event)

    def window_hour(self):
        delta = datetime.fromisoformat(self.mission["window"]) - datetime.fromisoformat(SCENARIO["start"])
        nominal = int(delta.total_seconds() / 3600)
        # shortcut: the opportunity stays open after its nominal date; add orbital geometry later.
        return nominal if self.state.hour <= nominal else self.state.hour

    def launch_blocks(self):
        reasons = self.readiness_blocks()
        clearance = self.state.clearance
        if not clearance or clearance["mission"] != self.mission["id"] or clearance["revision"] != self.state.revision:
            reasons.append("Independent clearance for this mission and configuration is required.")
        if self.state.hour < self.window_hour():
            reasons.append(f"Mission opportunity opens {self.date(self.window_hour())}.")
        funding = self.funding_block(100000, "operations")
        if funding:
            reasons.append(funding)
        return reasons

    def launch(self):
        self._preparing()
        reasons = self.launch_blocks()
        if reasons:
            raise RuleError(" ".join(reasons))
        public=self.briefing()
        references=launch_context(public,self.mission['id'])
        voices=launch_voices(public,self.mission['id'])
        self._spend(100000, "operations", self.mission["name"] + " flight operations")
        for item in references:
            self.state.transcript.append({'id':'Q-'+str(len(self.state.transcript)+1),'hour':self.state.hour,'mission':self.mission['id'],'speaker':item['speaker'],'kind':'continuity','text':'PRE-LAUNCH RECORD / '+item['text'],'links':item['links']})
        self.state.stage = "flight"
        self.state.meeting = None
        if self.state.delegation:
            self.state.delegation["status"] = "closed"
        event = self._event("mission", "Mission authorised", f"{self.mission['name']} configuration {self.state.revision}. Flight control owns operational decisions; the Administrator approved the mission scope and resource envelope.")
        self.state.flight = {"phase": 0, "elapsed": 0, "fuel": 100.0, "aborted": False, "crew_lost": False, "objective": False, "snapshot": self._snapshot(), "cause": event, "anomalies": [], "second_clock": True, "mission_seconds": 0, "telemetry_trace": [], "launch_events": [], "launch_voices": voices, "spoken_voices": []}

        self._launch_events_due()

    def cancel(self, rationale):
        self._preparing()
        if not isinstance(rationale, str) or not rationale.strip():
            raise RuleError("Record a reason for ending the programme.")
        for job in self.state.jobs:
            self._settle(job.cost, finance.line_for(job.kind, job.target))
        self.state.jobs.clear()
        self._event("decision", "Programme ended by Administrator", rationale.strip() + " Authorised contracts are settled at their committed value; no speculative refunds.")
        self.state.stage = "closed"
        self.state.meeting = None
        if self.state.delegation:
            self.state.delegation["status"] = "closed"

    def _flight_hour(self):
        flight = self.state.flight
        profile = self.mission["phases"]
        phase = profile[flight["phase"]]
        flight["elapsed"] += 1
        if flight["elapsed"] < phase["hours"]:
            return
        if phase.get("test") and not flight["aborted"]:
            snapshot = flight["snapshot"]
            faults = snapshot["faults"]
            environment = snapshot["environment"]
            # Faults influence usable propulsion and workload; luck represents unmodelled dispersion.
            demand = 38 + environment * (faults["feed"] * 42 + faults["guidance"] * 25) + snapshot["fatigue"] * 7 - snapshot["crew"] * 10 + self.rng.gauss(0, 4)
            flight["fuel"] -= demand
            self._observe("flight", f"{self.mission['name']}: {phase['name']}; flight environment {environment:.2f}.", "Operational readings are imperfect and specific to this mission's conditions.", "Flight Control", snapshot, cause=flight["cause"])
            if flight["fuel"] < 23:
                flight["aborted"] = True
                crew_abort=flight['fuel']<12
                actor='Crew Commander' if crew_abort else 'Flight Director'
                flight["anomalies"].append("Crew invokes independent emergency-abort authority; return contingency is in effect." if crew_abort else "Insufficient planned propellant margin; Flight Control invokes the return contingency.")
                self._event("operations", "Crew emergency abort" if crew_abort else "Flight Control discontinues the objective", flight["anomalies"][-1], actor, [flight["cause"]], interruption='observation')
            else:
                flight["objective"] = True
                text = "The crew lands and conducts surface work." if self.mission["id"] == "apollo11" else "The crew completes the planned LM qualification/rehearsal manoeuvre."
                self._event("operations", "Mission objective achieved", text + " The return remains to be completed.", "Flight Director", [flight["cause"]])
        if phase["name"] == "Recovery":
            faults = flight["snapshot"]["faults"]
            return_margin = flight["fuel"] - 12 - faults["feed"] * 16 + flight["snapshot"]["crew"] * 8 + self.rng.gauss(0, 3)
            flight["crew_lost"] = return_margin < 0
            self._finish_flight()
            return
        if phase['name']=='Ascent' and not flight['aborted']:
            opinion=next(person for person in self.opinions() if person['id']=='hayes')
            self._event('continuity','Ascent handover','Departure is recorded; Flight Control takes the next operational priorities. No unresolved concern is declared solved by launch. '+opinion['name']+" reports: "+opinion['interpretation'],opinion['name'],[flight['cause']])
        flight["phase"] += 1
        flight["elapsed"] = 0
        if flight["aborted"]:
            while flight["phase"] < len(profile) - 1 and profile[flight["phase"]]["name"] not in ("Transearth coast", "Recovery"):
                flight["phase"] += 1
        self._event("phase", profile[flight["phase"]]["name"], "Flight Control proceeds through the approved operational profile.", "Flight Director", [flight["cause"]])

    def _finish_flight(self):
        flight = self.state.flight
        self._settle(100000, "operations")
        success = flight["objective"] and not flight["aborted"] and not flight["crew_lost"]
        outcome = "crew_loss" if flight["crew_lost"] else "objective_complete" if success else "safe_return_objective_incomplete"
        event = self._event("outcome", f"{self.mission['name']}: {outcome.replace('_', ' ')}", f"{self.mission['objective']} {'Objective and recovery recorded.' if success else 'The programme must account for the objective and return separately.'} A favourable outcome does not resolve untested mechanisms.", "Post-flight Review", [flight["cause"]], interruption="observation" if flight["crew_lost"] else "")
        self.state.results.append({"mission": self.mission["id"], "outcome": outcome, "hour": self.state.hour, "revision": self.state.revision, "event": event, "samples": success and self.mission["id"] == "apollo11"})
        self._remember(event)
        self._report_opinions()
        self.state.flight = None
        self.state.clearance = None
        self.state.crew_readiness = clamp(self.state.crew_readiness - .04)
        if flight["crew_lost"] or success and self.state.mission_index == len(SCENARIO["missions"]) - 1:
            self.state.stage = "closed"
        else:
            self.state.stage = "preparation"
            if success:
                self.state.mission_index += 1
                self._event("programme", "Next mission proposed", self.mission["objective"] + " Previous flights are relevant records, not clearance for this different environment.", "Nora Bennett", [event])
            else:
                self._event("programme", "Objective remains unqualified", "The next programme milestone remains gated. Investigate, repeat the mission, or end the programme.", "Nora Bennett", [event])

    def _launch_events_due(self):
        flight=self.state.flight
        if not flight or not flight.get('second_clock') or flight['aborted']:
            return
        for entry in PROFILE['events']:
            if entry['second']<=flight['mission_seconds'] and entry['second'] not in flight['launch_events']:
                self._event('launch',entry['title'],entry['text'],entry['speaker'],[flight['cause']])
                flight['launch_events'].append(entry['second'])
        for entry in flight.get('launch_voices',[]):
            if entry['second']<=flight['mission_seconds'] and entry['second'] not in flight['spoken_voices']:
                links=[flight['cause'],*entry['links']]
                if entry['second']>=775:
                    insertion=next((event for event in reversed(self.state.events) if event.mission==self.mission['id'] and event.kind=='launch' and event.title=='Parking orbit insertion' and flight['cause'] in event.links),None)
                    if insertion is None:continue
                    links.append(insertion.id)
                event=self._event('continuity',entry['title'],entry['text'],entry['speaker'],links)
                self.state.staff[entry['person']].memories.append(event)
                flight['spoken_voices'].append(entry['second'])

    def advance_mission_seconds(self,seconds,stop_on_interruption=False):
        if type(seconds) is not int or not 1<=seconds<=36000000:
            raise RuleError('Advance the active mission by 1–36,000,000 whole seconds.')
        if not self.state.flight or not self.state.flight.get('second_clock'):
            raise RuleError('This mission uses the legacy hourly clock; start a new flight for second-resolution observation.')
        remaining=seconds
        while remaining and self.state.stage=='flight':
            flight=self.state.flight
            before=len(self.state.events)
            next_event=min((entry['second']-flight['mission_seconds'] for entry in PROFILE['events']+flight.get('launch_voices',[]) if entry['second']>flight['mission_seconds']),default=3600)
            step=min(remaining,3600-self.state.second,next_event)
            start=flight['mission_seconds']
            flight['mission_seconds']+=step
            self.state.second+=step
            remaining-=step
            phase=self.mission['phases'][flight['phase']]['name']
            # Only the latest ten minutes are retained, on a fixed five-second sampling grid.
            end=flight['mission_seconds']
            first=max((start//5+1)*5,((end-595+4)//5)*5)
            trace=flight['telemetry_trace']
            trace[:]=[sample for sample in trace if sample['second']>=end-595]
            trace.extend(trajectory(t,phase) for t in range(first,end+1,5))
            self._launch_events_due()
            if self.state.second==3600:
                self.state.second=0
                self._advance_whole_hours(1)
            if stop_on_interruption and any(event.interruption for event in self.state.events[before:]):
                break
        self.state.rng_state=self.rng.getstate()

    def advance(self,hours=6):
        if type(hours) is not int or not 1<=hours<=10000:
            raise RuleError('Advance time by 1–10,000 whole hours.')
        if self.state.flight and self.state.flight.get('second_clock'):
            self.advance_mission_seconds(hours*3600)
        else:
            self._advance_whole_hours(hours)

    def _advance_whole_hours(self, hours=6):
        if type(hours) is not int or not 1 <= hours <= 10000:
            raise RuleError("Advance time by 1–10,000 whole hours.")
        if self.state.stage == "closed":
            return
        for _ in range(hours):
            self.state.hour += 1
            self._funding_tick()
            self.state.fatigue = clamp(self.state.fatigue + (.002 if self.state.jobs else -.003), .1, .9)
            if self.state.meeting:
                self.state.meeting["fatigue"] = self.state.fatigue
            for job in self.state.jobs[:]:
                if job.due <= self.state.hour:
                    self.state.jobs.remove(job)
                    self._finish_job(job)
            self._delegate_tick()
            if self.state.stage == "flight":
                self._flight_hour()
                if self.state.stage != "flight":
                    break
        self.state.rng_state = self.rng.getstate()

    def hours_to_next_report(self):
        if self.state.stage == "closed":
            return 0
        if self.state.jobs:
            hours = max(1, min(job.due for job in self.state.jobs) - self.state.hour)
        elif self.state.flight:
            flight = self.state.flight
            hours = self.mission["phases"][flight["phase"]]["hours"] - flight["elapsed"]
        else:
            hours = max(1, self.window_hour() - self.state.hour)
        return hours

    def advance_to_next(self):
        hours=self.hours_to_next_report()
        if hours:
            if self.state.flight and self.state.flight.get('second_clock'):
                self.advance_mission_seconds(hours*3600-self.state.second)
            else:
                self.advance(hours)

    def briefing(self):
        """Explicit public projection; never return asdict(state) to a presentation adapter."""
        state = self.state
        flight = None
        if state.flight:
            raw = state.flight
            flight = {"phase": self.mission["phases"][raw["phase"]]["name"], "elapsed": raw["elapsed"], "remaining": self.mission["phases"][raw["phase"]]["hours"] - raw["elapsed"], "operations": "Return contingency active" if raw["aborted"] else "Flight Control executing approved profile"}
        if flight and state.flight.get('second_clock'):
            raw=state.flight
            phase=self.mission['phases'][raw['phase']]['name']
            launch=trajectory(raw['mission_seconds'],phase)
            if raw['aborted']:
                launch['status']='Return contingency / '+phase
                if launch['met_seconds']<0:
                    launch.update(powered=False,stage='Hold / objective discontinued')
            flight.update(second_clock=True,mission_seconds=raw['mission_seconds'],phase_seconds=raw['elapsed']*3600+state.second,
                          remaining_seconds=flight['remaining']*3600-state.second,launch=launch,telemetry_trace=deepcopy(raw['telemetry_trace']))
        return {
            "transcript": [{**deepcopy(entry), "date": self.date(entry["hour"],entry.get("second",0))} for entry in state.transcript], "rules": dict(state.rules),
            "finances": finance.public(state.finance),
            "date": self.date(), "hour": state.hour, "second":state.second, "seed": state.seed, "budget": state.budget, "stage": state.stage,
            "mission": deepcopy(self.mission), "revision": state.revision,
            "player": {"hypothesis": state.player_hypothesis, "rationale": state.player_rationale},
            "staff": self.opinions(),
            "jobs": [{"id": job.id, "kind": job.kind, "target": job.target, "lead": self._profile(job.lead)["name"], "hours_left": max(0, job.due - state.hour), "revision": job.revision} for job in state.jobs],
            "evidence": [{"id": item.id, "date": self.date(item.hour), "mission": item.mission, "revision": item.revision, "method": item.method, "observations": dict(item.observations), "conditions": item.conditions, "caveat": item.caveat, "source": item.source, "event": item.event} for item in state.evidence],
            "meeting": None if state.meeting is None else {"last": state.meeting["last"], "rounds": state.meeting["rounds"], "suggested_test": state.meeting.get("suggested_test"), "cue": "Participants repeatedly lose their place in the records." if state.meeting["fatigue"] > .65 else "Participants are comparing assumptions; confidence is not consensus."},
            "delegation": deepcopy(state.delegation), "clearance": deepcopy(state.clearance), "findings": deepcopy(state.findings),
            "launch_blocks": self.launch_blocks(), "crew": "Contingency preparation documented" if state.crew_readiness >= .8 else "Further contingency rehearsal required",
            "workforce": {**SCENARIO["workforce"], "busy": len(state.jobs), "condition": "Sustained workload" if state.fatigue > .6 else "Capacity available between assignments"},
            "flight": flight, "results": deepcopy(state.results), "decisions": deepcopy(state.decisions),
            "history": [{"id": event.id, "date": self.date(event.hour,event.second), "kind": event.kind, "title": event.title, "detail": event.detail, "actor": event.actor, "mission": event.mission, "revision": event.revision, "links": list(event.links), "interruption": event.interruption} for event in state.events],
        }
