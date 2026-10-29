"""Serializable domain records. Hidden simulation state never goes directly to the UI."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Event:
    id: str
    hour: int
    kind: str
    title: str
    detail: str
    actor: str = "Administrator"
    mission: str = "apollo9"
    revision: int = 1
    links: list[str] = field(default_factory=list)
    interruption: str = ""
    second: int = 0


@dataclass
class Evidence:
    id: str
    hour: int
    mission: str
    revision: int
    method: str
    observations: dict[str, float]
    conditions: str
    caveat: str
    source: str
    event: str


@dataclass
class Job:
    id: str
    kind: str
    target: str
    lead: str
    start: int
    due: int
    cost: int
    revision: int
    mission: str
    snapshot: dict
    cause: str


@dataclass
class Person:
    id: str
    beliefs: dict[str, float]
    memories: list[str] = field(default_factory=list)


@dataclass
class State:
    seed: int
    hour: int
    budget: int
    faults: dict[str, float]
    staff: dict[str, Person]
    rng_state: Any
    content_id: str = ""
    version: int = 2
    sequence: int = 0
    mission_index: int = 0
    revision: int = 1
    stage: str = "preparation"
    crew_readiness: float = 0.66
    fatigue: float = 0.35
    candour: float = 0.70
    player_hypothesis: str = "unresolved"
    player_rationale: str = ""
    evidence: list[Evidence] = field(default_factory=list)
    jobs: list[Job] = field(default_factory=list)
    events: list[Event] = field(default_factory=list)
    meeting: dict | None = None
    delegation: dict | None = None
    clearance: dict | None = None
    flight: dict | None = None
    results: list[dict] = field(default_factory=list)
    decisions: list[dict] = field(default_factory=list)
    findings: list[dict] = field(default_factory=list)
    finance: dict = field(default_factory=dict)
    transcript: list[dict] = field(default_factory=list)
    rules: dict = field(default_factory=lambda: {"administrator_abort": False})
    second: int = 0
