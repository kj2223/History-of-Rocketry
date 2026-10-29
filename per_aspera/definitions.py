"""Small, inspectable scenario catalogues; no generated population."""
import json
import hashlib
from pathlib import Path

DATA = Path(__file__).with_name("data")
SCENARIO = json.loads((DATA / "scenario.json").read_text(encoding="utf-8"))
STAFF = json.loads((DATA / "staff.json").read_text(encoding="utf-8"))
DOMAINS = tuple(SCENARIO["components"])
CONTENT_ID = hashlib.sha256(json.dumps([SCENARIO, STAFF], sort_keys=True).encode()).hexdigest()[:16]
