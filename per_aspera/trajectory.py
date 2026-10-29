"""Engine-owned nominal trajectory estimates, sampled on a deterministic clock."""
import json
import math
from .definitions import DATA

PROFILE=json.loads((DATA/'launch_profile.json').read_text(encoding='utf-8'))
FIELDS=('altitude_km','range_km','speed_km_s','latitude','longitude')


def trajectory(seconds,phase='Ascent'):
    met=seconds-PROFILE['countdown_seconds']
    data={'second':seconds,'met_seconds':met,'source':'Nominal trajectory model','stage':'Prelaunch','status':'Terminal countdown','powered':False,'profile_version':PROFILE['version']}
    if met<0:
        data.update(PROFILE['knots'][0]);data['t']=met
        data['powered']=met>=-8
        data['status']='Ignition sequence' if met>=-8 else 'Terminal countdown'
        data['q_kpa']=0.0
        return data
    if met<=709:
        knots=PROFILE['knots']
        first,second=next(((a,b) for a,b in zip(knots,knots[1:]) if a['t']<=met<=b['t']),(knots[-2],knots[-1]))
        fraction=(met-first['t'])/(second['t']-first['t'])
        for key in FIELDS:
            f=fraction**2 if first['t']==0 and key in ('altitude_km','range_km') else fraction
            data[key]=first[key]+f*(second[key]-first[key])
        data['stage']='S-IC' if met<162 else 'S-II' if met<549 else 'S-IVB'
        data['powered']=met<699
        data['status']='Ascent / '+data['stage'] if met<699 else 'Orbital insertion coast'
    elif phase=='Ascent' or 'Earth-orbit' in phase or 'separation and rendezvous' in phase.lower():
        # Circular parking-orbit estimate; no claim of fitted orbital elements or tracking-station coverage.
        angle=math.pi/2+(met-709)*2*math.pi/(89.3*60)
        inclination=math.radians(32.5)
        data.update(altitude_km=191.1,speed_km_s=7.39,range_km=2705.211+(met-709)*7.39,
                    latitude=math.degrees(math.asin(math.sin(inclination)*math.sin(angle))),
                    longitude=((math.degrees(math.atan2(math.cos(inclination)*math.sin(angle),math.cos(angle)))+(met-709)*-.004178-142.649+180)%360)-180,
                    stage='CSM / LM',status='Parking orbit / estimated',powered=False)
    else:
        data.update({key:None for key in FIELDS})
        data.update(stage='CSM / LM',status=phase+' / trajectory not modelled',powered=False)
    data['q_kpa']=None if data['altitude_km'] is None else .5*1.225*math.exp(-data['altitude_km']/7.2)*(data['speed_km_s']*1000)**2/1000
    return data
