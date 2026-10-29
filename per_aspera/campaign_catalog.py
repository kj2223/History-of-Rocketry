"""Data shared by campaign engineering and delegated mission scheduling."""
import hashlib
import json
from pathlib import Path

DATA=Path(__file__).with_name('campaign_data')
CATALOG=json.loads((DATA/'apollo.json').read_text(encoding='utf-8'))
SCHEDULE=json.loads((DATA/'mission_schedule.json').read_text(encoding='utf-8'))
OLD_CONTENT=hashlib.sha256(json.dumps(CATALOG,sort_keys=True).encode()).hexdigest()[:16]
SCHEDULE_CONTENT=hashlib.sha256(json.dumps([CATALOG,SCHEDULE],sort_keys=True).encode()).hexdigest()[:16]
TECH_POLICY=json.loads((DATA/'technical_policy.json').read_text(encoding='utf-8'))
CONTENT=hashlib.sha256(json.dumps([CATALOG,SCHEDULE,TECH_POLICY],sort_keys=True).encode()).hexdigest()[:16]
DAY=86400
PEOPLE={p['id']:p for p in CATALOG['staff']}
PROJECTS=CATALOG['projects']
MISSIONS={m['id']:m for m in CATALOG['missions']}


def new_plan():
    return {'authority':None,'manager':'bennett','held':False,'issue':'','prepared':None,'clearance':None,
            'obligations':{'prepare':0,'review':0,'execute':0},'technical_enabled':False,'technical_claims':[],
            'technical':{'engineering':0,'readiness':0},'technical_authorised':{'engineering':0,'readiness':0},'technical_released':{'engineering':0,'readiness':0}}
