"""Deterministic point-mass flight and limited ground observations; metres/seconds."""
from functools import lru_cache
import math

G=9.80665
DT=.25
# Scenario approximations, not certified vehicle performance or radar specifications.
ENGINES={
    'booster':((5,8,1),), 'inert':((5,8,1),),
    'partial':((5,7,2),(7,19,1)),
    'wac':((5,7,2),(7,54,1)), 'wac_b':((5,7,2),(7,54,1)),
    'bumper_sep':((5,65,1),), 'bumper':((5,65,1),(140,187,.85))}


def integrate(profile,duration,scale,failed_at=None):
    """Vertical/downrange acceleration, gravity, coasting, and ground impact."""
    x=z=vx=vz=0.;airborne=False;impacted=False;rows=[]
    for step in range(int(duration/DT)+1):
        t=step*DT
        burn=next((weight for a,b,weight in ENGINES[profile] if a<=t<b),0)
        if failed_at is not None and t>=failed_at:burn=0
        rows.append((t,x,z,vx,vz,bool(burn) and not impacted,impacted))
        if impacted or t<5:continue
        # A modest downrange component; no steering command is exposed to the player.
        tilt=.07 if not profile.startswith('bumper') else .11
        ax=scale*burn*math.sin(tilt);az=scale*burn*math.cos(tilt)-G
        if not airborne and az<=0:continue
        airborne=True;x+=vx*DT+.5*ax*DT*DT;z+=vz*DT+.5*az*DT*DT;vx+=ax*DT;vz+=az*DT
        if z<0:z=0;vx=vz=0;impacted=True
    return tuple(rows)


@lru_cache(maxsize=64)
def trajectory(profile,duration,target_km,failed_at=None):
    """Fit a coarse motor scale to the admitted flight envelope, then integrate it."""
    lo,hi=G,6000.
    for _ in range(24):
        mid=(lo+hi)/2;rows=integrate(profile,duration,mid,failed_at)
        if max(r[2] for r in rows)<target_km*1000:lo=mid
        else:hi=mid
    return integrate(profile,duration,(lo+hi)/2,failed_at)


def row_at(rows,elapsed):return rows[min(len(rows)-1,max(0,int(elapsed/DT)))]


def radar_sample(row,enabled,coverage_km):
    t,x,z,vx,vz,burning,impact=row
    distance=math.hypot(x+5000,z)
    if not enabled or t<8 or z<120 or impact or distance>coverage_km*1000:return None
    # Repeatable measurement errors depend on sample time, never on rendering/RNG calls.
    measured_range=round((distance+35*math.sin(t*.37))/1000,2)
    elevation=round(math.degrees(math.atan2(z,x+5000))+.18*math.sin(t*.23),1)
    return {'elapsed':int(t),'range_km':measured_range,'elevation_deg':max(0,min(90,elevation)),
            'height_km':round(measured_range*math.sin(math.radians(elevation)),2)}


def observations(profile,duration,target_km,failed_at,elapsed,radar_enabled,later=False):
    rows=trajectory(profile,duration,target_km,failed_at);row=row_at(rows,elapsed)
    t,x,z,vx,vz,burning,impact=row
    distance=300 if later else 152
    elevation=math.degrees(math.atan2(z,x+distance))
    separated=profile=='bumper' and failed_at is None and t>=120
    length=18 if profile.startswith('bumper') and not separated else 3 if profile=='booster' else 5
    angular_size=math.degrees(2*math.atan(length/2/max(1,math.hypot(x+distance,z))))
    visible=not impact and (angular_size>=.04 or burning)
    previous=row_at(rows,max(0,elapsed-.25));prev_angle=math.degrees(math.atan2(previous[2],previous[1]+distance))
    coverage=160 if later else 80
    samples=[radar_sample(row_at(rows,s),radar_enabled,coverage) for s in range(0,int(elapsed)+1,5)]
    fixes=[s for s in samples if s is not None]
    latest=fixes[-1] if fixes else None
    locked=latest is not None and elapsed-latest['elapsed']<5 and radar_sample(row,radar_enabled,coverage) is not None
    return {'optical':{'elevation_deg':round(elevation,3) if visible else None,'angular_size_deg':round(angular_size,4) if visible else None,
                       'angular_rate':round((elevation-prev_angle)/DT,3) if visible else 0,'visible':visible,'burning':burning and visible,
                       'on_pad':t<=5,'separated':separated and visible,'impacted':impact and x<3000,'observer_distance_m':distance,
                       'status':'On the launcher' if t<=5 else 'Nearby impact observed' if impact and x<3000 else 'Optical contact' if visible else 'No direct optical contact'},
            'radar':{'status':'Tracking' if locked else 'Track lost / last fix retained' if latest else 'Searching / no reliable return',
                     'locked':locked,'last_fix':latest,'age_seconds':round(elapsed-latest['elapsed'],1) if latest else None,
                     'coverage_km':coverage,'samples':fixes,'sample_interval':5,'station_offset_km':5,
                     'note':'Simulated ground-radar measurements; height is derived from range/elevation using a flat-earth approximation.'}}
