"""Read-only mission observation, derived exclusively from the public agency projection."""
from dataclasses import dataclass
from .definitions import SCENARIO

LOCATIONS = {
    'office': "Administrator’s office",
    'lcc': 'Launch Control Center',
    'mcc': 'Mission Control Center',
    'recovery': 'Recovery operations',
}


@dataclass
class Observation:
    location: str = 'office'
    mission_id: str | None = None

    def switch(self, location, public):
        if location not in LOCATIONS:
            raise ValueError('Unknown observation location.')
        self.location = location
        if public['flight'] or location == 'lcc':
            self.mission_id = public['mission']['id']
        elif self.mission_id is None:
            self.mission_id = public['results'][-1]['mission'] if public['results'] else public['mission']['id']

    def project(self, public):
        if public['flight']:
            self.mission_id = public['mission']['id']
        mission_id = self.mission_id or public['mission']['id']
        mission = next(m for m in SCENARIO['missions'] if m['id'] == mission_id)
        measurement_events = {item['event'] for item in public['evidence'] if item['mission'] == mission_id and item['method'] == 'flight'}
        events = [event for event in public['history'] if event['mission'] == mission_id and (event['kind'] in ('mission', 'phase', 'operations', 'outcome', 'launch', 'continuity') or event['id'] in measurement_events)]
        launch = next((index for index in range(len(events)-1, -1, -1) if events[index]['kind'] == 'mission'), None)
        attempt = events[launch:] if launch is not None else []
        result = next((event for event in reversed(attempt) if event['kind'] == 'outcome'), None)
        active = public['flight'] if mission_id == public['mission']['id'] else None
        reached = {event['title'] for event in attempt if event['kind'] == 'phase'}
        if attempt:
            reached.add('Ascent')
        phases = []
        for phase in mission['phases']:
            status = 'Planned'
            if active and phase['name'] == active['phase']:
                status = 'In progress'
            elif phase['name'] in reached:
                status = 'Recorded'
            elif result:
                status = 'Not reached'
            phases.append({**phase, 'status': status})
        elapsed = 0
        if active:
            # Operational time, not a new trajectory or countdown simulation.
            index = next(i for i, p in enumerate(mission['phases']) if p['name'] == active['phase'])
            elapsed = sum(p['hours'] for p in mission['phases'][:index] if p['name'] in reached) + active['elapsed']
        if result:
            heading = result['title']
            detail = result['detail']
        elif active:
            heading, detail = active['phase'], active['operations']
        elif public['stage'] == 'closed':
            heading, detail = 'Programme closed', 'No flight is active. Consult the office registry for the programme disposition.'
        else:
            heading, detail = 'Awaiting mission authorisation', 'No launch or recovery has been recorded for this attempt.'
        if self.location == 'lcc':
            if not attempt and public['stage'] != 'closed':
                from datetime import datetime
                start = datetime.fromisoformat(SCENARIO['start'])
                window = int((datetime.fromisoformat(mission['window'])-start).total_seconds()/3600)
                countdown = max(0, window-public['hour'])
                detail = f"Mission opportunity in {countdown} hours. This is a planning clock, not a live launch countdown. " + ('Authorisation remains an office decision.' if countdown == 0 else 'Flight has not been authorised.')
            elif attempt:
                detail = 'Launch authorisation is recorded. ' + ('Ascent is in progress.' if active and active['phase'] == 'Ascent' else 'Launch activity has passed to the mission record; MCC follows subsequent flight operations.')
        elif self.location == 'recovery':
            if result:
                detail = result['detail']
            elif active and active['phase'] == 'Recovery':
                detail = 'Recovery phase underway. Await Flight Control’s return and retrieval report; safe splashdown is not yet confirmed.'
            else:
                detail = 'Recovery teams awaiting the return phase. No splashdown or retrieval is being asserted.'
        outcome = next((item['outcome'] for item in public['results'] if result and item['event'] == result['id']), None)
        return {'objective_recorded': any(event['kind'] == 'operations' and event['title'] == 'Mission objective achieved' for event in attempt), 'outcome': outcome, 'location': LOCATIONS[self.location], 'mission': mission, 'heading': heading, 'detail': detail, 'flight': active, 'result': result, 'events': events, 'phases': phases, 'elapsed': elapsed,
                'blocks': public['launch_blocks'] if not attempt and mission_id == public['mission']['id'] else []}


@dataclass
class EventCursor:
    """Per-location append cursor; each engine event is rendered once."""
    mission: str | None = None
    seen: set | None = None

    def update(self, report):
        changed = self.mission != report['mission']['id']
        if changed or self.seen is None:
            self.mission, self.seen = report['mission']['id'], set()
        new = [event for event in report['events'] if event['id'] not in self.seen]
        self.seen.update(event['id'] for event in new)
        return changed, new


def instrument_report(public, mission_id):
    """Only recorded synthetic observations; no interpolated physical telemetry."""
    item = next((item for item in reversed(public['evidence']) if item['mission'] == mission_id and item['method'] == 'flight'), None)
    if item is None:
        return 'MEASUREMENTS / No in-flight instrument report yet. Position, communications and continuous fuel telemetry are not modelled.'
    readings = ', '.join(f"{key.replace('_',' ')} {value:.3f}" for key,value in item['observations'].items())
    return f"SIMULATED MEASUREMENTS / {item['date']} / {item['source']}\n{readings}\nNormalised indices, not failure probabilities. Last recorded sample; no interpolation. {item['caveat']}"
