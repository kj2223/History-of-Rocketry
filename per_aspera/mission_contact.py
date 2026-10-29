"""Deterministic, bounded controller briefings from the public evidence projection only."""
import json
from .definitions import DATA
from .continuity import launch_context

DIALOGUE=json.loads((DATA/'mission_dialogue.json').read_text(encoding='utf-8'))


def reply(public,mission_id,contact,question):
    if contact not in DIALOGUE['contacts'] or question not in DIALOGUE['questions']:
        raise ValueError('Choose a listed contact and structured question.')
    profile=DIALOGUE['contacts'][contact]
    flight=public['flight'] if public['mission']['id']==mission_id else None
    evidence=next((item for item in reversed(public['evidence']) if item['mission']==mission_id and item['method']=='flight'),None)
    result=next((item for item in reversed(public['results']) if item['mission']==mission_id),None)
    assurance=any(item['open'] and item['revision']==public['revision'] for item in public['findings']) if mission_id==public['mission']['id'] else False
    contingency=bool(flight and flight['operations']=='Return contingency active')
    events=[event for event in public['history'] if event['mission']==mission_id and event['kind'] in ('operations','outcome')]
    links=([evidence['event']] if evidence else [])+([events[-1]['id']] if events else [])
    status=flight['phase']+'; '+flight['operations'] if flight else result['outcome'].replace('_',' ') if result else 'No active flight or recorded recovery for this mission.'
    if question=='observations':
        readings={} if evidence is None else {key:value for key,value in evidence['observations'].items() if contact!='recovery' and (not profile['channels'] or key in profile['channels'])}
        detail=status+'\n'+('Last simulated instrument report: '+evidence['date']+' / '+evidence['source']+'. '+', '.join(f'{key.replace("_"," ")}={value:.3f}' for key,value in readings.items())+'. Normalised instrument indices, not failure probabilities. '+evidence['caveat'] if evidence and readings else 'No relevant in-flight instrument measurements are recorded. Continuous position, fuel and communications telemetry are not modelled.')
    elif question=='causes':
        detail=DIALOGUE['causes']
    elif question=='triggers':
        detail=DIALOGUE['triggers']
    elif question=='seriousness':
        detail=('Flight Control has invoked the return contingency; the objective has been discontinued. Safe recovery is not yet confirmed.' if contingency else 'Crew recovery was not confirmed in the recorded outcome.' if result and result['outcome']=='crew_loss' else 'The recorded outcome is '+status+'.' if result else 'Mission Assurance has withheld readiness clearance; the office must address the finding or supply discriminating evidence before launch.' if assurance and not flight else 'No active emergency escalation is reported in the available flight record. This is not a guarantee of safety. '+status)
    else:
        detail=('The return contingency is already in effect. Support the Flight Director and crew; an abort is not awaiting Administrator approval.' if contingency else 'Review the recorded outcome and any future programme implications.' if result else 'No flight is active. Review programme readiness and office authorisation; no operational abort is awaiting an executive decision.' if not flight else 'No abort recommendation is reported in the available record. Flight Control continues the approved profile and may act under flight rules without executive permission.')
        detail+=' The Administrator can request information and address explicitly escalated programme resources, but cannot order spacecraft manoeuvres or unsafe continuation. Crew emergency-abort authority cannot be overridden.'
    if question=='observations' and contact=='flight_director':
        references=launch_context(public,mission_id)
        if references:
            detail+='\nCampaign references: '+' | '.join(item['text'] for item in references)
            links.extend(link for item in references for link in item['links'])
    return profile['name'],DIALOGUE['questions'][question]['lead']+' '+detail+'\n'+profile['scope'],links
