"""Adaptive wall-clock pacing. No physics, random draws or outcome decisions live here."""
from dataclasses import dataclass


LAUNCH_RATES=((52,1800.0),(84,1800.0),(222,600.0),(237,1200.0),(609,600.0),(624,1200.0),(759,600.0),(769,1200.0),(855,1800.0),(3600,4.0))


def phase_seconds(flight):
    """Real seconds per simulated hour at normal/Auto speed."""
    name = flight['phase'].lower()
    if name=='ascent' and flight.get('second_clock'):
        t=flight['mission_seconds']
        return next((rate for boundary,rate in LAUNCH_RATES if t<boundary),4.0)
    if 'coast' in name or 'rest' in name:
        return 2.0
    if 'checkout' in name:
        return 30.0 if flight['elapsed'] < 2 else 3.2
    if 'surface operations' in name or 'stable' in name:
        return 4.0
    return 30.0


def nominal_duration(mission):
    ascent=sum((boundary-(LAUNCH_RATES[index-1][0] if index else 0))*rate/3600 for index,(boundary,rate) in enumerate(LAUNCH_RATES))
    return sum(ascent if p['name']=='Ascent' else sum(phase_seconds({'phase':p['name'],'elapsed':hour}) for hour in range(p['hours'])) for p in mission['phases'])


@dataclass
class MissionPacing:
    last: float | None = None
    progress: float = 0.0
    ground_seconds: float = 0.0
    alert_until: float = 0.0
    alert: str = ''

    def reset(self, now):
        self.last, self.progress, self.ground_seconds = now, 0.0, 0.0
        self.alert_until, self.alert = 0.0, ''

    def notify(self, events, now):
        significant = [event for event in events if event.get('interruption') or event['kind'] in ('safety_finding','escalation') or event['kind']=='operations' and event['title']=='Flight Control discontinues the objective']
        if significant:
            self.alert_until = now + 20.0
            self.alert = significant[-1]['title']

    def rate(self, flight, now, speed=1.0):
        rate = phase_seconds(flight) / speed
        if now < self.alert_until or flight.get('operations') == 'Return contingency active':
            rate = max(30.0, rate)
        return rate

    def tick(self, now, running, flight, speed=1.0):
        # Discard long callback stalls instead of racing past events after a suspended window.
        elapsed = min(1.0, max(0.0, now-self.last)) if self.last is not None else 0.0
        self.last = now
        if not running:
            return 0
        if not flight:
            self.ground_seconds += elapsed
            if self.ground_seconds >= 1.0:
                self.ground_seconds %= 1.0
                return 6
            return 0
        self.progress += elapsed / self.rate(flight, now, speed)
        if flight.get('second_clock'):
            seconds=int(self.progress*3600+1e-9)
            self.progress=max(0.0,self.progress-seconds/3600)
            return seconds
        if self.progress + 1e-9 >= 1:
            self.progress = max(0.0, self.progress - 1)
            return 1
        return 0
