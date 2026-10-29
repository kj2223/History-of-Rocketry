"""Small launch digest grounded in public campaign events, never invented management history."""
import json
from .definitions import SCENARIO, DATA

EXPERIENCE=json.loads((DATA/'launch_experience.json').read_text(encoding='utf-8'))

def launch_context(public,mission_id):
    history=public['history']
    records=[event for event in history if event['mission']==mission_id]
    chosen=[]
    groups=(('Readiness assessment',('clearance','safety_finding')),('Engineering record',('configuration','evidence')),('Organisation and judgement',('delegation_report','escalation','delegation','intervention','staff_assessment')))
    for label,kinds in groups:
        source=next((event for event in reversed(records) if event['kind'] in kinds),None)
        if label=='Organisation and judgement':
            delegated=next((event for event in reversed(records) if event['kind'] in ('delegation_report','escalation','delegation')),None)
            memories={key for person in public['staff'] for key in person['memories']}
            remembered=next((event for event in reversed(records) if event['id'] in memories and event['kind'] in ('intervention','interpretation','meeting')),None)
            source=delegated or remembered or source
        if source is None and label=='Engineering record':
            source=next((event for event in reversed(history) if event['kind']=='configuration'),None)
        if source:
            summary=source['title']
            if source['kind']=='staff_assessment':
                summary=source['detail'].split('. ')[0]
            elif source['kind']=='evidence':
                method=source['detail'].split(':',1)[0]
                summary=SCENARIO['tests'].get(method,{}).get('name',source['title'])
            chosen.append({'speaker':source['actor'],'summary':label+' / '+source['actor']+' / '+summary,'text':label+' / '+source['date']+' / '+source['title']+'. '+source['detail'],'links':[source['id']]})
    return chosen


def launch_voices(public,mission_id):
    """Capture contemporary staff interpretations and their actual source links."""
    references=launch_context(public,mission_id)
    voices=[]
    for index,template in enumerate(EXPERIENCE['anticipation']):
        source=next((item for item in references if item['summary'].startswith(template['group']+' / ')),None)
        if index==0 and source and any(event['id'] in source['links'] and event['kind']=='staff_assessment' for event in public['history']):
            source=next((item for item in references if item['summary'].startswith('Engineering record / ')),source)
        if source is None:
            continue
        person=next(item for item in public['staff'] if item['id']==template['person'])
        record=source['summary'].split(' / ',2)[-1]
        # Staff can refer to another person's record without claiming to have performed it.
        text=template['text'].format(record='“'+record+'”')
        text+=' '+person['interpretation']
        voices.append({'second':template['second'],'title':template['title'],'text':text,'speaker':person['name'],'links':source['links'],'person':person['id']})
        after=EXPERIENCE['aftermath'][index]
        voices.append({'second':after['second'],'title':after['title'],'text':after['text'].format(reference='I still have “'+record+'” in front of me.'),'speaker':person['name'],'links':source['links'],'person':person['id']})
    return sorted(voices,key=lambda item:item['second'])


def launch_scene(public,mission_id):
    """Presentation uses only already-issued events, never the future voice schedule."""
    flight=public['flight'] if public['mission']['id']==mission_id else None
    active=bool(flight and flight.get('second_clock') and flight['mission_seconds']<EXPERIENCE['focus_until'])
    entries=[event for event in public['history'] if event['mission']==mission_id and event['kind'] in ('launch','continuity','operations')]
    latest=entries[-1] if entries else None
    return {'active':active,'title':latest['title'] if latest else 'Awaiting the launch report',
            'speaker':latest['actor'] if latest else 'Flight Director','text':latest['detail'] if latest else '',
            'contingency':bool(flight and flight['operations']=='Return contingency active')}
