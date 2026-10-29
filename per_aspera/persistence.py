"""Versioned JSON snapshots with atomic writes and validation before state replacement."""
from dataclasses import asdict
import json
import math
import os
from pathlib import Path
import random
import tempfile

from . import finance
from .definitions import DOMAINS, STAFF, SCENARIO, CONTENT_ID
from .engine import tuples
from .model import State, Person, Event, Evidence, Job


class SaveError(ValueError):
    pass


def _finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise SaveError("Save contains a non-finite number.")
    if isinstance(value, dict):
        for item in value.values():
            _finite(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            _finite(item)


def validate(state):
    _finite(asdict(state))
    finance.validate(state)
    if type(state.second) is not int or not 0<=state.second<3600:
        raise SaveError("Invalid simulation second.")
    if type(state.version) is not int or state.version != 2:
        raise SaveError("Unsupported state version.")
    if state.content_id != CONTENT_ID:
        raise SaveError("Scenario definitions differ from this save; an explicit migration is required.")
    for key in ("seed", "hour", "budget", "revision", "sequence", "mission_index"):
        if type(getattr(state, key)) is not int or getattr(state, key) < 0:
            raise SaveError(f"Invalid {key}.")
    if state.seed >= 2**32 or state.hour > 1000000 or state.revision < 1 or state.mission_index >= len(SCENARIO["missions"]):
        raise SaveError("Save is outside scenario limits.")
    if state.stage not in ("preparation", "flight", "closed") or state.player_hypothesis not in (*DOMAINS, "unresolved"):
        raise SaveError("Invalid programme state or hypothesis.")
    if not isinstance(state.player_rationale, str) or len(state.player_rationale) > 2000:
        raise SaveError("Invalid player interpretation.")
    for value in (state.fatigue, state.candour, state.crew_readiness, *state.faults.values()):
        if type(value) not in (int, float) or not 0 <= value <= 1:
            raise SaveError("Invalid engineering/personnel value.")
    if set(state.faults) != set(DOMAINS) or set(state.staff) != {item["id"] for item in STAFF}:
        raise SaveError("Save uses unknown components or staff.")
    for key, person in state.staff.items():
        if person.id != key or set(person.beliefs) != set(DOMAINS) or any(type(value) not in (int, float) or not 0 <= value <= 1 for value in person.beliefs.values()):
            raise SaveError("Invalid staff interpretations.")
    if set(state.rules) != {'administrator_abort'} or type(state.rules['administrator_abort']) is not bool:
        raise SaveError('Invalid mission authority rules.')
    transcript_ids=[item['id'] for item in state.transcript]
    if len(transcript_ids)!=len(set(transcript_ids)):
        raise SaveError('Duplicate transcript entries.')
    missions={mission['id'] for mission in SCENARIO['missions']}
    for item in state.transcript:
        if not isinstance(item['speaker'],str) or not isinstance(item['id'],str) or item['mission'] not in missions or type(item.get('second',0)) is not int or not 0<=item.get('second',0)<3600 or type(item['hour']) is not int or not 0<=item['hour']<=state.hour or item['kind'] not in ('mission_event','question','briefing','continuity') or not isinstance(item['text'],str) or len(item['text'])>10000 or any(link not in {event.id for event in state.events} for link in item['links']):
            raise SaveError('Invalid mission transcript.')
    if any(event.interruption not in ('','observation','action_required') or type(event.second) is not int or not 0<=event.second<3600 or (event.hour,event.second)>(state.hour,state.second) for event in state.events):
        raise SaveError('Invalid interruption type.')
    ids = [event.id for event in state.events]
    if len(ids) != len(set(ids)) or any(type(event.hour) is not int or not 0 <= event.hour <= state.hour or not isinstance(event.detail, str) for event in state.events):
        raise SaveError("Invalid event history.")
    if any(person_event not in ids for person in state.staff.values() for person_event in person.memories):
        raise SaveError("Staff memory refers to a missing event.")
    missions = {item["id"] for item in SCENARIO["missions"]}
    for item in state.evidence:
        if item.mission not in missions or item.event not in ids or type(item.revision) is not int or not 1 <= item.revision <= state.revision or not isinstance(item.observations, dict) or any(type(value) not in (int, float) for value in item.observations.values()):
            raise SaveError("Invalid evidence record.")
    for job in state.jobs:
        if job.kind not in ("test", "repair", "clearance") or job.lead not in state.staff or job.mission not in missions or type(job.due) is not int or not job.start <= state.hour < job.due or job.cost < 0 or job.cause not in ids:
            raise SaveError("Invalid scheduled work.")
        if job.kind == "test" and job.target not in SCENARIO["tests"] or job.kind == "repair" and job.target not in DOMAINS:
            raise SaveError("Unknown scheduled action.")
        _validate_snapshot(job.snapshot)
    if len(state.jobs) > SCENARIO["workforce"]["teams"] or len({job.lead for job in state.jobs}) != len(state.jobs):
        raise SaveError("Scheduled work exceeds staff capacity.")
    if state.stage == "flight":
        if not isinstance(state.flight, dict):
            raise SaveError("Missing active mission.")
        phases = SCENARIO["missions"][state.mission_index]["phases"]
        flight = state.flight
        if type(flight["phase"]) is not int or not 0 <= flight["phase"] < len(phases) or type(flight["elapsed"]) is not int or not 0 <= flight["elapsed"] < phases[flight["phase"]]["hours"]:
            raise SaveError("Invalid mission phase.")
        if type(flight["fuel"]) not in (int, float) or not -100 <= flight["fuel"] <= 100 or flight["cause"] not in ids:
            raise SaveError("Invalid active mission record.")
        if flight.get('second_clock'):
            if flight['second_clock'] is not True or type(flight['mission_seconds']) is not int or flight['mission_seconds']<0 or not isinstance(flight['launch_events'],list) or len(flight['launch_events'])!=len(set(flight['launch_events'])) or len(flight['telemetry_trace'])>120:
                raise SaveError('Invalid second-resolution flight state.')
            authorisation=next((event for event in state.events if event.id==flight['cause']),None)
            if authorisation is None:
                raise SaveError('Missing mission authorisation event.')
            expected_seconds=(state.hour-authorisation.hour)*3600+state.second-authorisation.second
            if flight['mission_seconds']!=expected_seconds:
                raise SaveError('Mission clock does not match its phase.')
            from .trajectory import PROFILE
            if any(type(value) is not int or value not in {item['second'] for item in PROFILE['events']} or value>flight['mission_seconds'] for value in flight['launch_events']):
                raise SaveError('Invalid launch event clock.')
            times=[sample['second'] for sample in flight['telemetry_trace']]
            if times!=sorted(set(times)):
                raise SaveError('Trajectory samples must be ordered and unique.')
            for sample in flight['telemetry_trace']:
                if type(sample['second']) is not int or not 0<=sample['second']<=flight['mission_seconds']:
                    raise SaveError('Invalid trajectory sample.')
                for key in ('altitude_km','range_km','speed_km_s','latitude','longitude','q_kpa'):
                    if sample[key] is not None and type(sample[key]) not in (int,float):
                        raise SaveError('Invalid trajectory measurement.')
        if 'launch_voices' in flight:
            from .continuity import EXPERIENCE
            allowed={entry['second'] for entry in EXPERIENCE['anticipation']+EXPERIENCE['aftermath']}
            voices=flight['launch_voices'];spoken=flight['spoken_voices']
            if not flight.get('second_clock') or not isinstance(voices,list) or len(voices)>6 or not isinstance(spoken,list) or len(set(spoken))!=len(spoken):
                raise SaveError('Invalid launch continuity records.')
            times=[entry['second'] for entry in voices]
            if times!=sorted(set(times)) or any(type(t) is not int or t not in allowed for t in times) or any(type(t) is not int or t not in times or t>flight['mission_seconds'] for t in spoken):
                raise SaveError('Invalid launch continuity clock.')
            for entry in voices:
                if entry['person'] not in state.staff or any(not isinstance(entry[key],str) or not entry[key] for key in ('title','text','speaker')) or not entry['links'] or any(link not in ids for link in entry['links']):
                    raise SaveError('Invalid launch continuity source.')
        _validate_snapshot(flight["snapshot"])
    elif state.flight is not None:
        raise SaveError("Active flight conflicts with programme state.")
    if state.clearance and (state.clearance["mission"] not in missions or state.clearance["revision"] != state.revision):
        raise SaveError("Invalid mission clearance.")
    if state.meeting is not None:
        if not isinstance(state.meeting, dict) or any(type(state.meeting[key]) not in (int, float) or not 0 <= state.meeting[key] <= 1 for key in ("fatigue", "progress")) or not isinstance(state.meeting["last"], str):
            raise SaveError("Invalid engineering review.")
    if state.delegation:
        contract = state.delegation
        if contract["manager"] not in state.staff or type(contract["remaining"]) is not int or contract["remaining"] < 0 or contract["status"] not in ("active", "escalated", "reported", "closed"):
            raise SaveError("Invalid delegation agreement.")
    random.Random().setstate(tuples(state.rng_state))


def _validate_snapshot(snapshot):
    if set(snapshot["faults"]) != set(DOMAINS) or any(type(value) not in (int, float) or not 0 <= value <= 1 for value in snapshot["faults"].values()):
        raise SaveError("Invalid configuration snapshot.")
    for key in ("fatigue", "crew", "environment"):
        if type(snapshot[key]) not in (int, float) or not 0 <= snapshot[key] <= 1:
            raise SaveError("Invalid operating conditions.")


def save(state, path):
    try:
        validate(state)
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        raise SaveError(f"Cannot save invalid state: {error}") from error
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=destination.parent, prefix=destination.name + ".", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(asdict(state), stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def load(path):
    try:
        source = Path(path)
        if source.stat().st_size > 16 * 1024 * 1024:
            raise SaveError("Save exceeds the prototype's 16 MB limit.")
        raw = json.loads(source.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or type(raw.get("version")) is not int or raw.get("version") not in (1, 2):
            raise SaveError("Unsupported save version; the original file has not been changed.")
        raw["staff"] = {key: Person(**value) for key, value in raw["staff"].items()}
        for field, record in (("events", Event), ("evidence", Evidence), ("jobs", Job)):
            raw[field] = [record(**item) for item in raw[field]]
        state = State(**raw)
        if state.version == 1:
            finance.initialise(state, legacy=True)
        validate(state)
        return state
    except (ValueError, TypeError, KeyError, AttributeError, OSError, OverflowError) as error:
        raise SaveError(f"Could not load campaign: {error}") from error
