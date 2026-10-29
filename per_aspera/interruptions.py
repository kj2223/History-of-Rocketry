"""Presentation interruptions derived from authoritative public event metadata."""
from dataclasses import dataclass, field


def classification(event):
    if event.get('interruption'):
        return event['interruption']
    # Backward compatibility for saved events produced before explicit metadata.
    if event['kind']=='operations' and event['title']=='Flight Control discontinues the objective':
        return 'observation'
    if event['kind'] in ('escalation','safety_finding'):
        return 'action_required'
    return ''


@dataclass
class Interruptions:
    seen: set = field(default_factory=set)
    pending: list = field(default_factory=list)

    def ingest(self, events):
        for event in events:
            if event['id'] in self.seen:
                continue
            self.seen.add(event['id'])
            kind=classification(event)
            if kind:
                self.pending.append({**event,'interruption':kind})

    @property
    def current(self):
        return self.pending[0] if self.pending else None

    def acknowledge(self):
        if self.pending:
            self.pending.pop(0)

    @classmethod
    def for_campaign(cls, public):
        tracker=cls({event['id'] for event in public['history']})
        # Reopen an active contingency on load; do not silently play past an emergency.
        if public['flight'] and public['flight']['operations']=='Return contingency active':
            event=next((event for event in reversed(public['history']) if event['mission']==public['mission']['id'] and classification(event)=='observation'),None)
            if event:
                tracker.pending.append({**event,'interruption':'observation'})
        return tracker


def step_observed(sim,hours,tracker):
    """Same authoritative engine, stopped after the first unexpected event batch."""
    if tracker.current:
        return []
    if sim.state.flight and sim.state.flight.get('second_clock'):
        return step_seconds_observed(sim,hours*3600,tracker)
    events=[]
    for _ in range(hours):
        if sim.state.stage=='closed':
            break
        before=len(sim.state.events)
        stage=sim.state.stage
        sim.advance(1)
        new=[{**vars(event),'date':sim.date(event.hour,event.second)} for event in sim.state.events[before:]]
        events.extend(new)
        tracker.ingest(new)
        if tracker.current or stage=='flight' and sim.state.stage!='flight':
            break
    return events


def interruption_text(event,public):
    from .mission_contact import DIALOGUE
    from .observation import instrument_report
    data=' / '.join(instrument_report(public,event['mission']).split('\n')[:2])
    return (event['date']+' / '+event['actor']+': '+event['detail']+'\n'
            +data+'\nUNCERTAINTY / Cause and safe recovery are not established by this report. Indices are not failure probabilities.\n'
            +'Reading/accessibility pause: it creates no in-world opportunity to delay a flight-rule response. Controller/crew actions already recorded remain in effect. Ask the Flight Director for context; resume the same mission when ready.')


def step_seconds_observed(sim,seconds,tracker):
    if tracker.current or seconds<=0:
        return []
    before=len(sim.state.events)
    sim.advance_mission_seconds(seconds,stop_on_interruption=True)
    events=[{**vars(event),'date':sim.date(event.hour,event.second)} for event in sim.state.events[before:]]
    tracker.ingest(events)
    return events
