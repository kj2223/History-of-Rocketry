"""1961–1969 programme model. No UI imports or wall-clock decisions."""
from copy import deepcopy
from datetime import datetime,timedelta
import hashlib
import json
import math
from pathlib import Path
import random

from .engine import RuleError,tuples
from .persistence import SaveError
from .trajectory import PROFILE,trajectory

from .campaign_catalog import CATALOG,CONTENT,OLD_CONTENT,SCHEDULE_CONTENT,DAY,PEOPLE,PROJECTS,MISSIONS,SCHEDULE,new_plan
from .campaign_schedule import MissionSchedule



class Campaign(MissionSchedule):
    def __init__(self,state):
        state=upgrade(state)
        self.state=state
        self.rng=random.Random()
        state['rng']=tuples(state['rng'])
        self.rng.setstate(state['rng'])

    @classmethod
    def new(cls,seed=11):
        if type(seed) is not int or not 0<=seed<2**32:raise RuleError('Choose a seed from 0 to 4,294,967,295.')
        rng=random.Random(seed)
        hardware={key:{'revision':1,'status':'concept','design':None,'lead':p['lead'],'mass':0,'capacity':0,
                       'faults':{h:rng.uniform(.18,.48) for h in p['hazards']},'evidence':[],'lineage':[]} for key,p in PROJECTS.items()}
        state={'campaign':'apollo_1961','version':3,'content':CONTENT,'seed':seed,'time':0,'rng':rng.getstate(),'sequence':0,
               'architecture':'unselected','study':False,'capacity':2,'hardware':hardware,'jobs':[],
               'staff':{key:{'memories':[],'work':[]} for key in PEOPLE},'funds':{key:{'allocation':amount,'committed':0,'paid':0} for key,amount in CATALOG['funding'].items()},
               'ledger':[],'events':[],'mission_index':0,'prepared':None,'clearance':None,'flight':None,'results':[],
               'plans':{mid:new_plan() for mid in MISSIONS},'schedule_pauses':[],'standdown_mission':None,'standdown':False,'status':'active','theory':'No conclusion recorded.'}
        sim=cls(state)
        sim.event('context','The lunar commitment','25 May 1961. The objective is a lunar landing and safe return before the decade ends. You inherit Mercury, Saturn work, people and commitments; the lunar programme is not yet developed.','Programme briefing')
        return sim

    @property
    def mission(self):return MISSIONS[self.state['flight']['mission']] if self.state['flight'] else CATALOG['missions'][self.state['mission_index']]

    def date(self,at=None):
        value=datetime.fromisoformat(CATALOG['start'])+timedelta(seconds=self.state['time'] if at is None else at)
        return value.strftime('%d %b %Y · %H:%M:%S')

    def event(self,kind,title,detail,actor='Administrator',links=(),component=None,mission=None,routine=False):
        s=self.state;s['sequence']+=1
        entry={'id':f"C{s['sequence']:06}",'time':s['time'],'date':self.date(),'kind':kind,'title':title,'detail':detail,
               'actor':actor,'links':list(links),'mission':mission or self.mission['id'],'component':component,**({'routine':True} if routine else {})}
        s['events'].append(entry);s['rng']=self.rng.getstate()
        return entry['id']

    def remember(self,person,event,work=None):
        if person in self.state['staff']:
            self.state['staff'][person]['memories'].append(event)
            if work and work not in self.state['staff'][person]['work']:self.state['staff'][person]['work'].append(work)

    def _active(self):
        if self.state['status']!='active':raise RuleError('This programme has ended. Start a new campaign to make new commitments.')

    def _project(self,key):
        if key not in PROJECTS:raise RuleError('Choose a listed workstream.')
        return self.state['hardware'][key]

    def _money(self,account,amount,purpose,operation,mission=None):
        fund=self.state['funds'][account]
        if operation=='commit':
            if fund['allocation']-fund['paid']-fund['committed']<amount:
                raise RuleError('Insufficient uncommitted '+account+' funds. Defer new work or explicitly release reserve to this account; authorised work keeps its funding.')
            fund['committed']+=amount
        elif operation=='release':
            if amount>fund['committed']:raise RuleError('Release exceeds the recorded obligation.')
            fund['committed']-=amount
        elif operation=='settle':
            if amount>fund['committed']:raise RuleError('Settlement exceeds the recorded obligation.')
            fund['committed']-=amount;fund['paid']+=amount
        self.state['ledger'].append({'time':self.state['time'],'date':self.date(),'account':account,'amount':amount,'purpose':purpose,'operation':operation,
                                    'available':fund['allocation']-fund['paid']-fund['committed'],**({'mission':mission} if mission else {})})

    def release_reserve(self,account,amount,rationale):
        self._active()
        if account not in ('engineering','readiness','operations') or type(amount) is not int or amount<=0 or not isinstance(rationale,str) or not rationale.strip():raise RuleError('Choose a programme account, positive whole-dollar amount and a reason.')
        source=self.state['funds']['reserve']
        if amount>source['allocation']-source['paid']-source['committed']:raise RuleError('The reserve cannot cover this release.')
        source['allocation']-=amount;self.state['funds'][account]['allocation']+=amount
        self.state['ledger'].append({'time':self.state['time'],'date':self.date(),'account':account,'amount':amount,'purpose':rationale.strip(),'operation':'reserve release','available':self.available(account)})
        self.event('funding','Reserve released to '+account,rationale.strip()+f' Amount ${amount:,}; no money created.')

    def available(self,account):
        f=self.state['funds'][account];return f['allocation']-f['committed']-f['paid']

    def assign(self,component,lead):
        self._active();h=self._project(component)
        if lead not in PEOPLE or lead=='ortiz':raise RuleError('Assign a development lead; independent assurance remains separate.')
        if any(j['component']==component for j in self.state['jobs']):raise RuleError('Finish the current work package before handing responsibility over. Its original lead remains accountable for it.')
        if lead==h['lead']:raise RuleError('That person already owns this workstream.')
        previous=PEOPLE[h['lead']]['name'];h['lead']=lead
        e=self.event('appointment','Responsibility assigned',PEOPLE[lead]['name']+' takes '+PROJECTS[component]['name']+' from '+previous+'. Existing work and evidence remain attributed to their original authors.',component=component)
        self.remember(lead,e)

    def commission(self,kind,component=None,design=None,mission=None,sponsor=None):
        self._active();s=self.state
        if kind in ('prepare','review'):
            self.start_mission_job(kind,self.definition(mission)['id']);return
        if component is not None:self._project(component)
        if kind=='study':
            if s['study'] or any(j['kind']=='study' for j in s['jobs']):raise RuleError('The architecture study is already commissioned or complete.')
            lead='bennett';days=35;cost=12000000;account='engineering';title='Comparative mission architecture study'
        elif kind=='capacity':
            if s['capacity']>=3 or any(j['kind']=='capacity' for j in s['jobs']):raise RuleError('The prototype supports at most three concurrent work packages.')
            lead='bennett';days=180;cost=250000000;account='engineering';title='Third aggregate development/test team'
        elif kind=='investigation':
            if not s['standdown']:raise RuleError('No accident stand-down is awaiting investigation.')
            lead='ortiz';days=90;cost=80000000;account='readiness';title='Independent accident investigation'
        elif kind in ('develop','redesign','rework','component','integration'):
            h=self._project(component);lead=h['lead']
            if s['architecture']!='lor':raise RuleError('Complete the comparative study and endorse the supported LOR programme before authorising development.')
            if any(j['component']==component for j in s['jobs']):raise RuleError('A work package is already active on this configuration.')
            if kind in ('develop','redesign'):
                option=next((d for d in PROJECTS[component]['designs'] if d['id']==design),None)
                if not option:raise RuleError('Choose one of the engineering proposals.')
                if kind=='develop' and h['status']!='concept':raise RuleError('This workstream is already developed; use a revision proposal.')
                if kind=='redesign' and h['status']!='developed':raise RuleError('Finish development before requesting a revision.')
                if kind=='redesign' and h['design']==design:raise RuleError('This is already the current design; use focused rework for a finding.')
                days=option['days']*(1 if kind=='develop' else .4);cost=int(option['cost']*(1 if kind=='develop' else .4));account='engineering';title=PROJECTS[component]['name']+' / '+option['name']
            elif kind=='rework':
                if h['status']!='developed':raise RuleError('Develop the component before authorising focused rework.')
                days=150;cost=240000000 if component=='booster' else 160000000;account='engineering';title=PROJECTS[component]['name']+' / inspection and corrective revision'
            else:
                if h['status']!='developed':raise RuleError('Develop this configuration before testing it.')
                definition=CATALOG['tests'][kind];days=definition['days'];cost=definition['cost'];account='readiness';title=PROJECTS[component]['name']+' / '+definition['name']
            days=math.ceil(days*(1.18-.28*PEOPLE[lead]['skills'][component]))
        else:raise RuleError('Unknown work package.')
        if s['flight'] and kind in ('prepare','review','investigation'):raise RuleError('Flight Control is executing the current attempt.')
        if sum(not j.get('mission') for j in s['jobs'])>=s['capacity']:raise RuleError('All aggregate teams are committed. Wait for a report or expand capacity.')
        if any(j['lead']==lead and (not j.get('mission') or lead=='ortiz') for j in s['jobs']):raise RuleError(PEOPLE[lead]['name']+' already leads an active package. Wait or assign a different lead before commissioning work.')
        if sponsor is not None:
            p=s['plans'].get(sponsor)
            if not p or not p['authority'] or not p['technical_enabled'] or p['held'] or component not in p['technical_claims'] or kind not in ('develop','component','integration','rework') or p['technical'][account]<cost:raise RuleError('Technical work exceeds its recorded delegated scope or funding.')
            p['technical'][account]-=cost;self._money(account,cost,title+' / assigned from delegated allowance','assign',mission=sponsor)
        else:self._money(account,cost,title,'commit')
        e=self.event('technical_decision' if sponsor else 'decision','Work authorised',title+f'. ${cost:,} obligated from {account}; estimated {int(days)} days.',actor=PEOPLE[lead]['name'] if sponsor else 'Administrator',links=([s['plans'][sponsor]['authority']] if sponsor else [])+(self.state['hardware'][component]['lineage'][-1:] if component else []),component=component,mission=sponsor)
        s['jobs'].append({'id':e,'kind':kind,'component':component,'design':design,'lead':lead,'due':s['time']+int(days)*DAY,'cost':cost,'account':account,'title':title,
                          'seed':self.rng.getrandbits(32),'revision':s['hardware'][component]['revision'] if component else None,'fingerprint':self.fingerprint(),**({'sponsor':sponsor} if sponsor else {})})
        s['rng']=self.rng.getstate();self.remember(lead,e)

    def endorse(self,architecture='lor'):
        self._active()
        if not self.state['study']:raise RuleError('Read the comparative study before endorsing a mission architecture.')
        if architecture!='lor':raise RuleError('Direct ascent and Earth-orbit rendezvous are study alternatives; their full vehicle campaigns are not implemented in this build.')
        if self.state['architecture']=='lor':raise RuleError('LOR is already endorsed.')
        self.state['architecture']='lor'
        self.event('architecture','Lunar-orbit rendezvous endorsed','A separate lander and crew spacecraft require compatible interfaces and rendezvous capability. Vehicle development, tests and readiness remain to be established.')

    def fingerprint(self,mission=None):return {k:self.state['hardware'][k]['revision'] for k in self.definition(mission)['requires']}

    def _evidence(self,key):
        h=self.state['hardware'][key]
        return [e for e in h['evidence'] if e['revision']==h['revision']]

    def findings(self,key):
        latest={e['method']:e for e in self._evidence(key)}
        return [e for e in latest.values() if max(e['observations'].values())>.48]

    def mass(self,mission=None):
        m=self.definition(mission);h=self.state['hardware']
        payload=2.0
        if 'csm' in m['requires']:payload+=h['csm']['mass']+(18.0 if m.get('lunar') else 3.0)
        if 'lander' in m['requires']:payload+=h['lander']['mass']+10.5
        capacity=h['booster']['capacity'] if m['vehicle']=='Saturn V' else 20.0
        return {'payload':round(payload,2),'capacity':capacity,'margin':round(capacity-payload,2),'source':'Simplified design mass model; not historical flight mass.'}

    def blocks(self,include_preparation=True,include_clearance=True,mission=None,ignore_active=False):
        s=self.state;blocks=[];m=self.definition(mission);p=s['plans'][m['id']]
        if s['status']!='active':return ['The programme has ended.']
        if s['flight'] and not ignore_active:return ['Current mission is in progress; the shared operations slot is occupied.']
        if m['id'] in self.completed():return ['This milestone is already complete.']
        if p['held']:blocks.append('The mandate is held: '+p['issue'])
        for dependency in SCHEDULE['dependencies'][m['id']]:
            if dependency not in self.completed():blocks.append('Flight evidence required: '+MISSIONS[dependency]['name']+'.')
        if s['standdown']:blocks.append('Complete the independent accident investigation before another mission.')
        if s['architecture']!='lor':blocks.append('Commission the architecture study and endorse a supported mission approach.')
        for key in m['requires']:
            h=s['hardware'][key];name=PROJECTS[key]['name']
            if h['status']!='developed':blocks.append('Develop '+name+'.');continue
            methods={e['method'] for e in self._evidence(key)}
            for method in CATALOG['tests']:
                if method not in methods:blocks.append(name+': '+CATALOG['tests'][method]['name']+' required for revision '+str(h['revision'])+'.')
            if self.findings(key):blocks.append(name+': observed excursions require corrective work and current-revision re-tests.')
            if any(j['component']==key for j in s['jobs']):blocks.append(name+': finish the active work package before freezing a flight configuration.')
        if not m.get('ground') and self.mass(m['id'])['margin']<0:blocks.append('Estimated payload exceeds vehicle allowance. Revise the spacecraft/lander allocation or launch vehicle.')
        if include_preparation and p['prepared']!=self.fingerprint(m['id']):blocks.append('Authorise and complete mission assembly/preparation for the current configuration.')
        if include_clearance and p['clearance']!=self.fingerprint(m['id']):blocks.append('Obtain an independent readiness disposition for the current configuration.')
        return blocks

    def _finish(self,job):
        s=self.state;key=job['component'];kind=job['kind'];lead=job['lead'];rng=random.Random(job['seed']);mid=job.get('mission');p=s['plans'].get(mid)
        if p and p['authority']:p['obligations'][kind]=0
        self._money(job['account'],job['cost'],job['title'],'settle',mission=job.get('sponsor'))
        detail='The authorised package is complete. Payment settles the existing obligation.'
        if kind=='study':
            s['study']=True
            detail='The team compared direct ascent, Earth-orbit rendezvous and lunar-orbit rendezvous. LOR reduces landed spacecraft mass but requires a separate lander and reliable rendezvous. Only the LOR end-to-end campaign is implemented; it still requires substantial development. No hardware is qualified by this study.'
        elif kind=='capacity':s['capacity']=3;detail='A third aggregate team is available. Individual leads still cannot own two concurrent packages.'
        elif kind=='investigation':
            s['standdown']=False;s['prepared']=None;s['clearance']=None
            for k in MISSIONS[s['standdown_mission'] or self.mission['id']]['requires']:s['hardware'][k]['revision']+=1
            detail='The board requires configuration re-examination and new evidence before another attempt. No hardware fault has been repaired by this investigation; previous evidence remains archived.'
        elif key:
            h=s['hardware'][key]
            if kind in ('develop','redesign'):
                option=next(d for d in PROJECTS[key]['designs'] if d['id']==job['design'])
                old=next((d for d in PROJECTS[key]['designs'] if d['id']==h['design']),None)
                if kind=='redesign':h['revision']+=1
                for i,hazard in enumerate(PROJECTS[key]['hazards']):h['faults'][hazard]=max(.025,min(.85,h['faults'][hazard]*option['factors'][i]/(old['factors'][i] if old else 1)))
                h.update(status='developed',design=option['id'],mass=option['mass'],capacity=option.get('capacity',0))
                detail=option['name']+f" delivered as revision {h['revision']}. "+option['tradeoff']+' Development is not qualification.'
                s['clearance']=None;s['prepared']=None
            elif kind=='rework':
                h['revision']+=1
                h['faults']={hazard:max(.025,value*.42) for hazard,value in h['faults'].items()}
                detail=f"Corrective revision {h['revision']} delivered. Prior tests remain in the archive; commission new tests before relying on this configuration."
                s['clearance']=None;s['prepared']=None
            else:
                evidence={'revision':h['revision'],'method':kind,'date':self.date(),'source':PEOPLE[lead]['name'],
                          'observations':{hazard:round(max(0,min(1,value+rng.gauss(0,.065-.035*PEOPLE[lead]['skills'][key]))),3) for hazard,value in h['faults'].items() if kind=='integration' or hazard==PROJECTS[key]['hazards'][0]},
                          'caveat':CATALOG['tests'][kind]['caveat']}
                detail=CATALOG['tests'][kind]['name']+': '+', '.join(k.replace('_',' ')+f' index {v:.3f}' for k,v in evidence['observations'].items())+'. '+evidence['caveat']+' These indices are not failure probabilities.'
                h['evidence'].append(evidence)
        elif kind=='prepare':
            if job['fingerprint']==self.fingerprint(mid):p['prepared']=job['fingerprint'];detail='Preparation complete for this dossier’s recorded revisions. Qualification evidence and independent disposition remain separate flight gates.'
            else:detail='The configuration changed during preparation. The package is paid history; a funded amendment is needed before repeating preparation.'
        elif kind=='review':
            if job['fingerprint']==self.fingerprint(mid) and not self.blocks(include_clearance=False,mission=mid,ignore_active=True):p['clearance']=job['fingerprint'];detail='Independent readiness disposition granted for this mission and configuration. It is not a guarantee of safety.'
            else:detail='Readiness disposition withheld: the configuration, evidence, dependencies or preparation no longer match the scope.'
        e=self.event('mission_report' if job.get('sponsor') or mid and p['authority'] else 'report',job['title'],detail,PEOPLE[lead]['name'],[job['id']],key,mission=mid or job.get('sponsor'))
        if mid and (kind=='prepare' and p['prepared']!=self.fingerprint(mid) or kind=='review' and p['clearance']!=self.fingerprint(mid)):
            self.hold_plan(mid,detail,e)
        if kind=='investigation':
            for k in MISSIONS[s['standdown_mission'] or self.mission['id']]['requires']:self.invalidate_plans(k,e)
            s['standdown_mission']=None
        if key and kind in ('develop','redesign','rework'):self.invalidate_plans(key,e)
        self.sync_focus()
        if key:
            s['hardware'][key]['lineage'].append(e)
            if kind in CATALOG['tests']:s['hardware'][key]['evidence'][-1]['event']=e
        self.remember(lead,e,key)

    def launch(self,mission=None):
        self._active();m=self.definition(mission);blocks=self.blocks(mission=m['id'])
        if blocks:raise RuleError(' '.join(blocks))
        s=self.state;p=s['plans'][m['id']]
        if p['authority']:
            if p['obligations']['execute']!=self.costs(m['id'])['execute']:raise RuleError('The mandate does not fund execution; amend it first.')
        else:self._money('operations',self.costs(m['id'])['execute'],m['name']+' execution','commit')
        cause=self.event('mission',m['name']+' authorised',('Execution proceeds under the recorded delegated mandate. ' if p['authority'] else '')+m['objective']+' Operational decisions belong to Flight Control, test conductors and the crew.',actor=PEOPLE[p['manager']]['name'] if p['authority'] else 'Administrator',links=([p['authority']] if p['authority'] else [])+[event for key in m['requires'] for event in s['hardware'][key]['lineage'][-1:]],mission=m['id'])
        seed=self.rng.getrandbits(32);s['rng']=self.rng.getstate()
        s['flight']={'mission':m['id'],'delegated':bool(p['authority']),'start':s['time'],'phase':0,'phase_start':s['time'],'seed':seed,'snapshot':deepcopy({k:s['hardware'][k] for k in m['requires']}),
                     'mass':self.mass(m['id']),'cause':cause,'aborted':False,'lost':False,'crew_lost':False,'calls':[],'queue':[]}
        f=s['flight']
        if not m.get('ground'):
            if m['vehicle']=='Saturn V':calls=deepcopy(PROFILE['events'])
            else:calls=[{'second':t,'title':title,'text':text,'speaker':'Flight Director'} for t,title,text in [(0,'Terminal countdown','Saturn IB terminal sequence. This schematic does not use Saturn V telemetry.'),(52,'Ignition sequence','Engine start sequence.'),(60,'Liftoff','The vehicle is away.'),(210,'Stage transition','The launch profile enters upper-stage operation.'),(660,'Orbit insertion','Orbital insertion is recorded by the simplified launch profile.')]]
            for entry in calls:entry.update(kind='launch',links=[cause])
            f['queue'].extend(calls)
            for i,key in enumerate(m['requires'][:3]):
                h=f['snapshot'][key];lead=h['lead'];reference=h['lineage'][-1]
                f['queue'].append({'second':4+i*16,'kind':'continuity','title':'The team watches '+PROJECTS[key]['name'],
                                  'speaker':PEOPLE[lead]['name'],'text':f"The revision {h['revision']} work on {PROJECTS[key]['name']} is in this vehicle. We will compare the flight reports with our ground evidence. I want to watch it go.",'links':[cause,reference]})
            f['queue'].append({'second':780,'kind':'continuity','title':'A moment after departure','speaker':'Nora Bennett','text':'There is room to breathe for a moment. This vehicle carries years of the programme’s work. Flight Control has the next checks; I am glad we reached this point.','links':[cause]})
            f['queue'].sort(key=lambda entry:entry['second'])
        self.sync_focus();self._calls()

    def _calls(self):
        f=self.state['flight']
        if not f or f['aborted']:return
        elapsed=self.state['time']-f['start']
        for index,entry in enumerate(f['queue']):
            if index not in f['calls'] and entry['second']<=elapsed:
                e=self.event(entry['kind'],entry['title'],entry['text'],entry['speaker'],entry['links'])
                f['calls'].append(index)
                for person in PEOPLE:
                    if PEOPLE[person]['name']==entry['speaker']:self.remember(person,e)

    def _phase_end(self):
        s=self.state;f=s['flight'];m=self.mission;name,duration,stress=m['phases'][f['phase']]
        rng=random.Random(f['seed']+f['phase']*1009)
        if not f['aborted']:
            values=[v for h in f['snapshot'].values() for v in h['faults'].values()]
            coupling=max(values)*.45+sum(values)/len(values)*.55
            if m.get('ground'):coupling=(f['snapshot']['csm']['faults']['cabin']+f['snapshot']['ground']['faults']['egress'])/2
            margin=1-coupling*stress-rng.gauss(0,.07)
            if margin<.48:
                f['aborted']=True
                f['crew_lost']=m['crew'] and margin<.08
                f['lost']=not m['crew'] and margin<.16
                self.event('interruption','Crew emergency action' if m['crew'] else 'Flight Control discontinues the objective',
                           'Operations have invoked the contingency response. The Administrator is informed; no unsafe-continuation order or delayed emergency intervention is available.',
                           'Crew / Test Conductor' if m.get('ground') else 'Flight Director',[f['cause']])
            else:self.event('operations',name+' report','This phase completed within the simplified operational envelope. This observation applies to the flown/tested configuration; it does not prove every earlier judgement correct.','Test Conductor' if m.get('ground') else 'Flight Director',[f['cause']])
        f['phase']+=1;f['phase_start']=s['time']
        if f['aborted'] or f['phase']>=len(m['phases']):self._finish_mission()
        else:self.event('phase',m['phases'][f['phase']][0],'Operations proceed through the authorised scope.','Flight Director',[f['cause']])

    def _finish_mission(self):
        s=self.state;f=s['flight'];m=self.mission
        # A contingency response is not itself a guarantee of crew recovery.
        if f['aborted'] and m['crew'] and not f['crew_lost']:
            return_hazard=max(v for h in f['snapshot'].values() for v in h['faults'].values())
            f['crew_lost']=return_hazard>.88 and random.Random(f['seed']+909).random()<.65
        outcome='crew_loss' if f['crew_lost'] else 'vehicle_lost' if f['lost'] else 'safe_return_objective_incomplete' if f['aborted'] else 'objective_complete'
        self._money('operations',35000000 if m.get('ground') else 70000000,m['name']+' execution','settle')
        if f['delegated']:s['plans'][m['id']]['obligations']['execute']=0
        e=self.event('outcome',m['name']+' / '+outcome.replace('_',' '),'Objective: '+m['objective']+' The result follows this attempt’s configuration, evidence and operational model. Historical outcomes are not forced.','Post-mission review',[f['cause']],routine=f['delegated'])
        s['results'].append({'mission':m['id'],'name':m['name'],'outcome':outcome,'date':self.date(),'time':s['time'],'event':e,'configuration':{k:h['revision'] for k,h in f['snapshot'].items()},'designs':{k:h['design'] for k,h in f['snapshot'].items()}})
        for person in PEOPLE:self.remember(person,e)
        p=s['plans'][m['id']];p['prepared']=None;p['clearance']=None;s['flight']=None
        if outcome=='objective_complete':
            self.release_technical(m['id'])
            if m['id']=='apollo11':s['status']='complete';self.event('programme','The lunar campaign concludes','The landing and return are recorded. Review the teams, commitments and evidence that led here. Finishing after the deadline remains visible; history is not rewritten.',mission=m['id'])
            else:self.event('programme',m['name']+' evidence recorded','This attempt contributes evidence to dependent dossiers. Other authorised teams continue within their scope.',mission=m['id'])
        else:
            s['standdown']=True;s['standdown_mission']=m['id']
            self.hold_plan(m['id'],'The attempt did not complete its objective. Investigation and a newly funded attempt require executive authority.',e)
            self.event('programme','Investigation and recovery required','Commission an independent investigation. Spent funds, retained commitments and failed attempts remain; there is no free replacement.',mission=m['id'])
        self.sync_focus()

    def next_time(self):
        s=self.state;times=[j['due'] for j in s['jobs']]
        if s['flight']:
            f=s['flight'];times.append(f['phase_start']+self.mission['phases'][f['phase']][1])
            if not f['aborted']:times.extend(f['start']+e['second'] for i,e in enumerate(f['queue']) if i not in f['calls'] and f['start']+e['second']>s['time'])
        return min(times) if times else None

    def advance(self,seconds,stop_on_report=False):
        if self.state['status']!='active' and not self.state['jobs']:raise RuleError('The campaign and all authorised work have ended.')
        if type(seconds) is not int or not 0<seconds<=20*366*DAY:raise RuleError('Advance a positive whole number of seconds within twenty years.')
        s=self.state;target=s['time']+seconds
        self.dispatch()
        if s['schedule_pauses']:return
        while s['time']<target and (s['status']=='active' or s['jobs']):
            before=len(s['events']);next_time=self.next_time();s['time']=min(target,next_time) if next_time else target
            for job in sorted(s['jobs'][:],key=lambda j:(j['due'],j['id'])):
                if job['due']<=s['time']:s['jobs'].remove(job);self._finish(job)
            self._calls()
            f=s['flight']
            if f and s['time']>=f['phase_start']+self.mission['phases'][f['phase']][1]:self._phase_end()
            self.dispatch();new=s['events'][before:]
            if stop_on_report and self.next_time() is None and any(e['kind']=='outcome' for e in new):break
            if any(e['kind'] in ('interruption','escalation') for e in new) or stop_on_report and any(e['kind'] in ('report','outcome') and not e.get('routine') for e in new):break
        s['rng']=self.rng.getstate()

    def next_report(self):
        self.dispatch();due=self.next_time()
        if due is None:raise RuleError('No work or mission is running. Review the current decision or commission a work package first.')
        if self.state['flight']:
            f=self.state['flight'];due=f['phase_start']+self.mission['phases'][f['phase']][1]
        self.advance(max(1,due-self.state['time']),True)

    def record_theory(self,text):
        if not isinstance(text,str) or not 1<=len(text.strip())<=2000:raise RuleError('Record an interpretation of 1–2,000 characters.')
        self.state['theory']=text.strip();self.event('interpretation','Administrator interpretation recorded',text.strip())

    def controller_briefing(self,question):
        if question not in ('observations','uncertainty','authority'):raise RuleError('Choose a listed controller question.')
        public=self.briefing();flight=public['flight'];links=[flight['cause']] if flight else [public['results'][-1]['event']] if public['results'] else []
        if question=='observations':
            text=('Current phase: '+flight['phase']+'. '+('A contingency is already in effect.' if flight['contingency'] else 'Operations continue the approved profile.')+' The displayed trajectory is a nominal estimate, separate from engineering measurements.' if flight else 'No mission is active. '+('Last recorded outcome: '+public['results'][-1]['name']+' / '+public['results'][-1]['outcome'].replace('_',' ')+'.' if public['results'] else 'No mission outcome has been recorded.'))
        elif question=='uncertainty':text='A launch or successful isolated test does not establish that every engineering concern was resolved. Compare observations with the applicable configuration and test conditions; the hidden physical cause is not established by this briefing.'
        else:text='Flight Control, the test conductor and the crew retain operational safety authority. Contingency actions do not await executive permission. Programme resources, future mission scope and organisational changes belong to the Administrator. There is no unsafe-continuation order.'
        self.event('briefing','Controller briefing / '+question,text,'Flight Director',links)

    def briefing(self):
        s=self.state;projects=[]
        for key,p in PROJECTS.items():
            h=s['hardware'][key];evidence=self._evidence(key)
            assessments=[]
            for person in CATALOG['staff']:
                observations=[v for e in evidence for v in e['observations'].values()]
                assessment='Evidence is insufficient for a readiness judgement.' if not observations else 'Observed excursions deserve investigation before further commitments.' if max(observations)>.48 else 'The recorded ground results support further qualification, within their stated limits.'
                if person['id']=='mercer' and observations:
                    first=[e['observations'].get(p['hazards'][0]) for e in evidence if p['hazards'][0] in e['observations']]
                    assessment='The isolated channel merits attention.' if max(first)>.48 else 'The isolated channel supports proceeding with integrated work; it cannot establish the coupled behaviour.'
                elif person['id']=='hayes' and evidence and not any(e['method']=='integration' for e in evidence):
                    assessment='The coupled interface has not been exercised by this revision’s evidence yet.'
                elif person['id']=='bennett' and evidence:
                    assessment='Keep the next dependency and remaining work visible; the available reports do not substitute for an independent readiness disposition.'
                assessments.append({'person':person['name'],'text':assessment+' '+person['view']})
            projects.append({'technical':self.technical_projection(key),'id':key,'name':p['name'],'description':p['description'],'revision':h['revision'],'status':h['status'],'design':h['design'],'lead':h['lead'],'mass':h['mass'],'capacity':h['capacity'],'designs':[{**{k:v for k,v in d.items() if k!='factors'},'estimated_days':math.ceil(d['days']*(1.18-.28*PEOPLE[h['lead']]['skills'][key]))} for d in p['designs']],
                             'tests':{method:{**definition,'estimated_days':math.ceil(definition['days']*(1.18-.28*PEOPLE[h['lead']]['skills'][key]))} for method,definition in CATALOG['tests'].items()},
                             'rework':{'cost':240000000 if key=='booster' else 160000000,'days':math.ceil(150*(1.18-.28*PEOPLE[h['lead']]['skills'][key]))},
                             'evidence':deepcopy(h['evidence']),'findings':deepcopy(self.findings(key)),'lineage':list(h['lineage']),'assessments':assessments})
        funds={k:{**f,'available':f['allocation']-f['paid']-f['committed']} for k,f in s['funds'].items()}
        flight=None
        if s['flight']:
            f=s['flight'];elapsed=s['time']-f['start'];phase=self.mission['phases'][f['phase']][0]
            estimate=trajectory(elapsed,phase) if self.mission['vehicle']=='Saturn V' and not f['aborted'] else None
            flight={'start':f['start'],'hardware':[{'id':k,'name':PROJECTS[k]['name'],'revision':h['revision'],'design':h['design'],'lead':h['lead'],'lineage':h['lineage']} for k,h in f['snapshot'].items()],'elapsed':elapsed,'met':elapsed-60 if not self.mission.get('ground') else elapsed,'phase':phase,'phase_elapsed':s['time']-f['phase_start'],'phase_duration':self.mission['phases'][f['phase']][1],
                    'contingency':f['aborted'],'vehicle':self.mission['vehicle'],'estimate':estimate,'cause':f['cause'],'configuration':{k:h['revision'] for k,h in f['snapshot'].items()}}
        events=deepcopy(s['events'])
        return {'next_report':self.date(self.next_time()) if self.next_time() is not None else None,'campaign':s['campaign'],'date':self.date(),'time':s['time'],'seed':s['seed'],'status':s['status'],'study':s['study'],'architecture':s['architecture'],'capacity':s['capacity'],
                'projects':projects,'jobs':[{k:v for k,v in j.items() if k not in ('seed','fingerprint')}|{'days_left':round(max(0,j['due']-s['time'])/DAY,1),'owner':PEOPLE[j['lead']]['name']} for j in s['jobs']],
                'funds':funds,'ledger':deepcopy(s['ledger']),'events':events,'mission':{**deepcopy(self.mission),'phases':[[p[0],p[1]] for p in self.mission['phases']]},'missions':[{**deepcopy(m),'phases':[[p[0],p[1]] for p in m['phases']]} for m in CATALOG['missions']],
                'mission_index':s['mission_index'],'prepared':s['plans'][self.mission['id']]['prepared']==self.fingerprint(),'clearance':s['plans'][self.mission['id']]['clearance']==self.fingerprint(),'blocks':self.blocks(),'mass':self.mass(),
                'flight':flight,'results':deepcopy(s['results']),'standdown':s['standdown'],'theory':s['theory'],
                'mission_board':self.mission_board(),'preparation_teams':SCHEDULE['preparation_teams'],'development_jobs':sum(not j.get('mission') for j in s['jobs']),'schedule_pauses':list(s['schedule_pauses']),
                'staff':[{**{k:v for k,v in p.items() if k!='skills'},**deepcopy(s['staff'][p['id']])} for p in CATALOG['staff']],
                'deadline_missed':(datetime.fromisoformat(CATALOG['start'])+timedelta(seconds=s['results'][-1]['time'] if s['status']=='complete' else s['time'])).year>1969}


def _validate(state,legacy=False):
    try:
        if state['campaign']!='apollo_1961' or state['version'] not in ((1,) if legacy else (2,3)) or state['content']!=(OLD_CONTENT if legacy else SCHEDULE_CONTENT if state['version']==2 else CONTENT):raise ValueError('Unsupported campaign catalogue or version.')
        if type(state['time']) is not int or not 0<=state['time']<=30*366*DAY or type(state['seed']) is not int or not 0<=state['seed']<2**32:raise ValueError('Invalid campaign time or seed.')
        if state['status'] not in ('active','complete') or type(state['mission_index']) is not int or not 0<=state['mission_index']<len(CATALOG['missions']):raise ValueError('Invalid programme state.')
        if state['architecture'] not in ('unselected','lor') or type(state['study']) is not bool or state['capacity'] not in (2,3):raise ValueError('Invalid programme commitment.')
        if set(state['hardware'])!=set(PROJECTS) or set(state['staff'])!=set(PEOPLE) or set(state['funds'])!=set(CATALOG['funding']):raise ValueError('Unknown programme records.')
        ids=[e['id'] for e in state['events']]
        if len(ids)!=len(set(ids)) or state['sequence']!=len(ids):raise ValueError('Event sequence does not reconcile.')
        seen=set();previous=-1
        for event in state['events']:
            if type(event['time']) is not int or not previous<=event['time']<=state['time'] or any(link not in seen for link in event['links']):raise ValueError('Invalid event chronology or causal link.')
            seen.add(event['id']);previous=event['time']
        for key,h in state['hardware'].items():
            if h['lead'] not in PEOPLE or h['lead']=='ortiz' or type(h['revision']) is not int or h['revision']<1 or h['status'] not in ('concept','developed'):raise ValueError('Invalid hardware ownership or revision.')
            if set(h['faults'])!=set(PROJECTS[key]['hazards']) or any(type(v) not in (int,float) or not 0<=v<=1 for v in h['faults'].values()):raise ValueError('Invalid component condition.')
            if h['design'] is not None and h['design'] not in {d['id'] for d in PROJECTS[key]['designs']}:raise ValueError('Unknown design.')
            option=next((d for d in PROJECTS[key]['designs'] if d['id']==h['design']),None)
            if h['status']=='developed' and (option is None or h['mass']!=option['mass'] or h['capacity']!=option.get('capacity',0)) or h['status']=='concept' and (h['design'] is not None or h['mass']!=0 or h['capacity']!=0):raise ValueError('Design mass/performance does not match the configuration.')
            if any(link not in seen for link in h['lineage']):raise ValueError('Missing configuration provenance.')
            for e in h['evidence']:
                if e['event'] not in seen or e['method'] not in CATALOG['tests'] or not 1<=e['revision']<=h['revision'] or not e['observations'] or not set(e['observations']).issubset(h['faults']) or any(type(v) not in (int,float) or not 0<=v<=1 for v in e['observations'].values()):raise ValueError('Invalid qualification evidence.')
        busy=set();components=set()
        if sum(not j.get('mission') for j in state['jobs'])>state['capacity']:raise ValueError('Work exceeds team capacity.')
        for job in state['jobs']:
            if job['id'] not in seen or job['lead'] not in PEOPLE or (not job.get('mission') or job['lead']=='ortiz') and job['lead'] in busy or type(job['due']) is not int or job['due']<=state['time'] or type(job['cost']) is not int or job['cost']<0 or job['account'] not in state['funds']:raise ValueError('Invalid active work package.')
            if not job.get('mission') or job['lead']=='ortiz':busy.add(job['lead'])
            if job['component']:
                if job['component'] not in PROJECTS or job['component'] in components:raise ValueError('Conflicting hardware work.')
                components.add(job['component'])
        for account,fund in state['funds'].items():
            if any(type(v) is not int or v<0 for v in fund.values()) or fund['paid']+fund['committed']>fund['allocation']:raise ValueError('Funding does not reconcile.')
            obligations=sum(j['cost'] for j in state['jobs'] if j['account']==account and not j.get('delegated'))
            if not legacy:
                obligations+=sum(p['obligations']['review'] if account=='readiness' else p['obligations']['prepare']+p['obligations']['execute'] if account=='operations' else 0 for p in state['plans'].values())
                if state['version']==3:obligations+=sum(p['technical'].get(account,0) for p in state['plans'].values())
            if account=='operations' and state['flight'] and not state['flight'].get('delegated'):obligations+=35000000 if (CATALOG['missions'][state['mission_index']] if legacy else MISSIONS[state['flight']['mission']]).get('ground') else 70000000
            if obligations!=fund['committed']:raise ValueError('Commitments differ from authorised work.')
        if sum(f['allocation'] for f in state['funds'].values())!=sum(CATALOG['funding'].values()):raise ValueError('Funding was created or lost.')
        replay={k:{'allocation':v,'committed':0,'paid':0} for k,v in CATALOG['funding'].items()}
        ledger_time=0
        for entry in state['ledger']:
            if type(entry['amount']) is not int or entry['amount']<0 or not ledger_time<=entry['time']<=state['time']:raise ValueError('Invalid financial transaction.')
            ledger_time=entry['time'];fund=replay[entry['account']];amount=entry['amount']
            if entry['operation']=='commit':fund['committed']+=amount
            elif entry['operation']=='settle':fund['committed']-=amount;fund['paid']+=amount
            elif state['version']==3 and entry['operation']=='assign':pass
            elif state['version']==3 and entry['operation']=='release':fund['committed']-=amount
            elif entry['operation']=='reserve release':
                if entry['account']=='reserve':raise ValueError('Invalid reserve transfer.')
                replay['reserve']['allocation']-=amount;fund['allocation']+=amount
            else:raise ValueError('Unknown financial transaction.')
            if any(v<0 for f in replay.values() for v in f.values()) or fund['allocation']-fund['paid']-fund['committed']!=entry['available']:raise ValueError('Transaction balance does not reconcile.')
        if replay!=state['funds']:raise ValueError('Funding differs from its transaction ledger.')
        for p in state['staff'].values():
            if any(link not in seen for link in p['memories']) or any(key not in PROJECTS for key in p['work']):raise ValueError('Invalid personnel memory.')
        completed=[]
        for result in state['results']:
            if result['mission'] not in {m['id'] for m in CATALOG['missions']} or result['outcome'] not in ('objective_complete','safe_return_objective_incomplete','crew_loss','vehicle_lost') or result['event'] not in seen or not 0<=result['time']<=state['time']:raise ValueError('Invalid mission result.')
            if result['outcome']=='objective_complete':
                if not legacy and (result['mission'] in completed or any(d not in completed for d in SCHEDULE['dependencies'][result['mission']])):raise ValueError('Mission dependency evidence is missing.')
                completed.append(result['mission'])
        if legacy:
            expected=state['mission_index']+(1 if state['status']=='complete' else 0)
            if completed!=[m['id'] for m in CATALOG['missions'][:expected]]:raise ValueError('Mission progression does not match qualification history.')
        else:
            expected=next((i for i,m in enumerate(CATALOG['missions']) if m['id'] not in completed),len(MISSIONS)-1)
            if state['mission_index']!=expected or (state['status']=='complete')!=('apollo11' in completed):raise ValueError('Campaign focus or completion differs from its evidence.')
            validate_schedule(state,seen)
        required=(CATALOG['missions'][state['mission_index']] if legacy or not state['flight'] else MISSIONS[state['flight']['mission']])['requires']
        for flag in ('prepared','clearance'):
            value=state[flag]
            if value is not None and (not isinstance(value,dict) or set(value)!=set(required) or any(type(v) is not int or not 1<=v<=state['hardware'][k]['revision'] for k,v in value.items())):raise ValueError('Invalid mission configuration disposition.')
        if state['clearance'] and state['clearance']!=state['prepared']:raise ValueError('Readiness and preparation configurations differ.')
        f=state['flight']
        if f:
            m=CATALOG['missions'][state['mission_index']] if legacy else MISSIONS[f['mission']]
            if f['cause'] not in seen or not 0<=f['start']<=f['phase_start']<=state['time'] or not 0<=f['phase']<len(m['phases']) or state['time']>=f['phase_start']+m['phases'][f['phase']][1] or set(f['snapshot'])!=set(m['requires']):raise ValueError('Invalid active mission.')
            if any(type(i) is not int or not 0<=i<len(f['queue']) for i in f['calls']) or len(set(f['calls']))!=len(f['calls']):raise ValueError('Invalid launch event cursor.')
        random.Random().setstate(tuples(state['rng']))
        json.dumps(state,allow_nan=False)
    except (KeyError,TypeError,ValueError,OverflowError) as error:raise SaveError('Invalid 1961 campaign: '+str(error)) from error


def validate_schedule(state,seen):
    if set(state['plans'])!=set(MISSIONS) or any(e not in seen for e in state['schedule_pauses']) or len(set(state['schedule_pauses']))!=len(state['schedule_pauses']):raise ValueError('Invalid mission dossiers or exception cursor.')
    if state['standdown_mission'] is not None and state['standdown_mission'] not in MISSIONS:raise ValueError('Invalid investigation scope.')
    for mid,p in state['plans'].items():
        if state['version']==3:
            if type(p['technical_enabled']) is not bool or set(p['technical'])!={'engineering','readiness'} or set(p['technical_authorised'])!=set(p['technical']) or set(p['technical_released'])!=set(p['technical']):raise ValueError('Invalid technical remit.')
            if any(type(v) is not int or v<0 or v>p['technical_authorised'][account] for account,v in p['technical'].items()) or any(type(v) is not int or v<0 for v in p['technical_authorised'].values()):raise ValueError('Invalid technical allowance.')
            if any(type(v) is not int or v<0 or v+p['technical'][account]>p['technical_authorised'][account] for account,v in p['technical_released'].items()):raise ValueError('Invalid released allowance.')
            for account in p['technical']:
                entries=[e for e in state['ledger'] if e.get('mission')==mid and e['account']==account]
                amounts={operation:sum(e['amount'] for e in entries if e['operation']==operation) for operation in ('commit','settle','release')}
                contracted=sum(j['cost'] for j in state['jobs'] if j.get('sponsor')==mid and j['account']==account)
                if amounts['commit']!=p['technical_authorised'][account] or amounts['release']!=p['technical_released'][account] or amounts['commit']!=p['technical'][account]+contracted+amounts['settle']+amounts['release']:raise ValueError('Mission technical accounts differ from their transaction ledger.')
            if len(set(p['technical_claims']))!=len(p['technical_claims']) or not set(p['technical_claims']).issubset(MISSIONS[mid]['requires']):raise ValueError('Technical work is outside mission scope.')
            if not p['technical_enabled'] and (p['technical_claims'] or any(p['technical'].values()) or any(p['technical_authorised'].values())) or p['technical_enabled'] and not p['authority']:raise ValueError('Technical authority is missing.')
        if p['manager'] not in PEOPLE or p['manager']=='ortiz' or type(p['held']) is not bool or not isinstance(p['issue'],str) or p['authority'] is not None and p['authority'] not in seen:raise ValueError('Invalid mission authority.')
        if set(p['obligations'])!={'prepare','review','execute'} or any(type(v) is not int or v<0 for v in p['obligations'].values()) or not p['authority'] and any(p['obligations'].values()):raise ValueError('Invalid delegated envelope.')
        for flag in ('prepared','clearance'):
            value=p[flag]
            if value is not None and (not isinstance(value,dict) or set(value)!=set(MISSIONS[mid]['requires']) or any(type(v) is not int or not 1<=v<=state['hardware'][k]['revision'] for k,v in value.items())):raise ValueError('Invalid dossier configuration.')
        if p['clearance'] and p['clearance']!=p['prepared']:raise ValueError('Dossier clearance and preparation differ.')
    mission_jobs=[j for j in state['jobs'] if j.get('mission')]
    if sum(j['kind']=='prepare' for j in mission_jobs)>SCHEDULE['preparation_teams'] or len({j['mission'] for j in mission_jobs})!=len(mission_jobs):raise ValueError('Mission team capacity or dossier conflict.')
    for j in mission_jobs:
        if j['mission'] not in MISSIONS or j['kind'] not in ('prepare','review') or j['component'] is not None:raise ValueError('Invalid mission work.')
        p=state['plans'][j['mission']]
        if j.get('delegated') and (not p['authority'] or p['obligations'][j['kind']]!=j['cost']):raise ValueError('Mission work differs from its mandate funding.')
    for mid,p in state['plans'].items():
        m=MISSIONS[mid];expected={'prepare':35000000 if m.get('ground') else 90000000,'review':20000000,'execute':35000000 if m.get('ground') else 70000000}
        if any(v not in (0,expected[k]) for k,v in p['obligations'].items()):raise ValueError('Envelope exceeds its fixed-price scope.')
    if state['flight']:
        f=state['flight'];p=state['plans'][f['mission']]
        if f.get('delegated') and (not p['authority'] or p['obligations']['execute']==0):raise ValueError('Active mission is not funded by its mandate.')
    for job in state['jobs']:
        if job.get('sponsor'):
            p=state['plans'][job['sponsor']]
            if not p['technical_enabled'] or job['component'] not in p['technical_claims'] or job['kind'] not in ('develop','component','integration','rework'):raise ValueError('Technical package has no matching authority.')


def validate(state):
    _validate(state,legacy=state.get('version')==1)


def upgrade(state):
    version=state.get('version')
    if version not in (1,2):return state
    _validate(state,legacy=version==1);state=deepcopy(state)
    if version==1:
        state.update(plans={mid:new_plan() for mid in MISSIONS},schedule_pauses=[],standdown_mission=None)
        mid=CATALOG['missions'][state['mission_index']]['id'];p=state['plans'][mid]
        p['prepared']=deepcopy(state['prepared']);p['clearance']=deepcopy(state['clearance'])
        if state['standdown']:state['standdown_mission']=mid
        if state['flight']:state['flight'].update(mission=mid,delegated=False)
        for job in state['jobs']:
            if job['kind'] in ('prepare','review'):job.update(mission=mid,delegated=False)
    for p in state['plans'].values():
        for key in ('technical_enabled','technical_claims','technical','technical_authorised','technical_released'):p[key]=deepcopy(new_plan()[key])
    state.update(version=3,content=CONTENT)
    validate(state);return state



def save(state,path):
    import os
    import tempfile
    validate(state);destination=Path(path);destination.parent.mkdir(parents=True,exist_ok=True);temporary=None
    if destination.exists() and state['version']==3:
        previous=json.loads(destination.read_text(encoding='utf-8'))
        if previous.get('campaign')=='apollo_1961' and previous.get('version') in (1,2):
            backup=destination.with_suffix('.v'+str(previous['version'])+'-backup.json')
            if not backup.exists():
                with backup.open('x',encoding='utf-8') as stream:json.dump(previous,stream,indent=2)
    try:
        with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=destination.parent,prefix=destination.name+'.',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name);json.dump(state,stream,allow_nan=False,indent=2);stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,destination)
    finally:
        if temporary and temporary.exists():temporary.unlink()


def load(path):
    try:
        path=Path(path)
        if path.stat().st_size>16000000:raise SaveError('Campaign save exceeds 16 MB.')
        state=json.loads(path.read_text(encoding='utf-8'));validate(state);return upgrade(state)
    except (OSError,ValueError) as error:raise SaveError('Could not load campaign: '+str(error)) from error


def develop_campaign(seed=11):
    """Example development policy based on public evidence."""
    sim=Campaign.new(seed);sim.commission('study');sim.next_report();sim.endorse()
    sim.commission('capacity')
    while True:
        ready=True
        for key in PROJECTS:
            h=sim.state['hardware'][key]
            if h['status']=='developed' and {e['method'] for e in sim._evidence(key)}==set(CATALOG['tests']) and not sim.findings(key):continue
            ready=False
            if any(j['component']==key or j['lead']==h['lead'] for j in sim.state['jobs']) or len(sim.state['jobs'])>=sim.state['capacity']:continue
            if h['status']=='concept':sim.commission('develop',key,'growth' if key=='booster' else 'service')
            elif sim.findings(key):sim.commission('rework',key)
            else:sim.commission(next(method for method in CATALOG['tests'] if method not in {e['method'] for e in sim._evidence(key)}),key)
        if ready and not sim.state['jobs']:break
        sim.next_report()
    return sim


def demonstrate(seed=11):
    sim=develop_campaign(seed)
    attempts=0
    while sim.state['status']=='active' and attempts<20:
        if sim.state['standdown']:
            sim.commission('investigation')
            while sim.state['jobs']:sim.next_report()
            for key in sim.mission['requires']:
                sim.commission('rework',key)
                while sim.state['jobs']:sim.next_report()
                for method in CATALOG['tests']:
                    sim.commission(method,key)
                    while sim.state['jobs']:sim.next_report()
        sim.commission('prepare')
        while sim.state['jobs']:sim.next_report()
        sim.commission('review')
        while sim.state['jobs']:sim.next_report()
        sim.launch();attempts+=1
        while sim.state['flight']:sim.next_report()
    return sim
