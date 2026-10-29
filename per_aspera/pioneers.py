"""Small, independent 1945–49 flight programme. All money is illustrative dollars."""
from copy import deepcopy
from datetime import datetime,timedelta
import hashlib
import json
import math
import os
from pathlib import Path
import random
import tempfile

from .engine import RuleError,tuples
from .persistence import SaveError

DATA=json.loads((Path(__file__).with_name('campaign_data')/'pioneers.json').read_text(encoding='utf-8'))
CONTENT=hashlib.sha256(json.dumps(DATA,sort_keys=True).encode()).hexdigest()[:16]
DAY=86400
START=datetime.fromisoformat(DATA['start'])
END=int((datetime.fromisoformat(DATA['end'])-START).total_seconds())
PROFILES={p['id']:p for p in DATA['profiles']}
STAFF={p['id']:p for p in DATA['staff']}
FOCI=('balanced','flight margins','measurement')


class Pioneers:
    def __init__(self,state):
        self.state=state;state['rng']=tuples(state['rng']);self.rng=random.Random();self.rng.setstate(state['rng'])

    @classmethod
    def new(cls,seed=11):
        if type(seed) is not int or not 0<=seed<2**32:raise RuleError('Choose a whole-number seed from 0 to 4,294,967,295.')
        rng=random.Random(seed)
        s={'campaign':'pioneers_1945','version':1,'content':CONTENT,'seed':seed,'time':0,'status':'active','rng':rng.getstate(),
           'allocation':DATA['allocation'],'paid':0,'ledger':[],'events':[],'attention':[],'staff':['ellis','morgan','vega','price'],
           'jobs':[],'remit':None,'vehicle':None,'flight':None,'flights':[],'grants':[], 'grant_attempts':[],
           'configuration':1,'focus':'balanced','theory':'No interpretation recorded.',
           'reality':{'structure':rng.uniform(.56,.7),'propulsion':rng.uniform(.42,.58),'instrumentation':rng.uniform(.4,.55),'staging':rng.uniform(.32,.47)}}
        sim=cls(s);sim.event('context','A small experimental programme','September 1945. You lead a fictional university/Army-sponsored research team at White Sands. An inherited design and launch installation await trials. Authorise a funded objective; Ellis chooses preparation and test procedures. No NASA exists yet.','Sponsor liaison');return sim

    def date(self,at=None):return (START+timedelta(seconds=self.state['time'] if at is None else at)).strftime('%d %b %Y · %H:%M:%S')

    def event(self,kind,title,detail,actor='Project lead',links=()):
        s=self.state;e={'id':f"P{len(s['events'])+1:05}",'time':s['time'],'date':self.date(),'kind':kind,'title':title,'detail':detail,'actor':actor,'links':list(links)}
        s['events'].append(e);s['rng']=self.rng.getstate();return e['id']

    def active(self):
        if self.state['status']!='active':raise RuleError('The 1945–49 chapter is complete. Its record remains available.')

    def committed(self):
        s=self.state;return sum(j['cost'] for j in s['jobs'])+(s['remit']['balance'] if s['remit'] else 0)

    def available(self):return self.state['allocation']-self.state['paid']-self.committed()

    def transaction(self,operation,amount,purpose):
        self.state['ledger'].append({'date':self.date(),'time':self.state['time'],'operation':operation,'amount':amount,'purpose':purpose,'programme':'ORDCIT research','available':self.available(),'committed':self.committed(),'paid':self.state['paid']})

    def quote(self,profile,focus=None,count=1):
        if profile not in PROFILES:raise RuleError('Choose a listed flight objective.')
        focus=self.state['focus'] if focus is None else focus
        if focus not in FOCI or type(count) is not int or not 1<=count<=3:raise RuleError('Choose a supported priority and one to three flights.')
        p=PROFILES[profile];extra={'balanced':12000,'flight margins':24000,'measurement':24000}[focus]
        return {'cost':(p['cost']+extra)*count,'per_flight':p['cost']+extra,'days':p['days']+{'balanced':5,'flight margins':12,'measurement':10}[focus],'focus':focus,'count':count,'source':'Army-sponsored research allocation; illustrative no-year account'}

    def blocker(self,profile):
        p=PROFILES[profile];s=self.state
        if p['previous'] and not any(f['profile']==p['previous'] and f['useful'] for f in s['flights']):return 'Needs a usable flight record from '+PROFILES[p['previous']]['name']+'. Repeat or improve measurement coverage if the previous record was inconclusive.'
        if s['time']<int((datetime.fromisoformat(p['opens'])-START).total_seconds()):return 'Sponsor/range opportunity opens '+p['opens']+'.'
        return ''

    def authorise(self,profile,focus='balanced',count=1,delegated=True):
        self.active();s=self.state
        if s['attention']:raise RuleError('Acknowledge the current report before making a new commitment.')
        if type(delegated) is not bool:raise RuleError('Choose direct or delegated execution.')
        if s['remit'] or s['vehicle'] or s['flight']:raise RuleError('The single workshop/range team is already committed. Finish or release its remit first.')
        q=self.quote(profile,focus,count);reason=self.blocker(profile)
        if reason:raise RuleError(reason)
        if q['cost']>self.available():raise RuleError('Insufficient uncommitted funds. Reduce the flight count, release an unused remit, or submit a sponsor proposal when eligible.')
        if s['time']+q['days']*DAY+PROFILES[profile]['flight']>END:raise RuleError('This flight cannot be prepared before the chapter closes.')
        eid=self.event('decision','Flight remit authorised',f"{PROFILES[profile]['name']}; {count} attempt(s); priority: {focus}; {'delegated range release' if delegated else 'return to lead before launch'}. Envelope ${q['cost']:,}. Shared shop, specialist preparation and expendable hardware included.")
        s['focus']=focus;s['remit']={'profile':profile,'focus':focus,'remaining':count,'balance':q['cost'],'unit':q['per_flight'],'days':q['days'],'delegated':delegated,'event':eid}
        self.transaction('commit',q['cost'],'Flight remit');self.dispatch()

    def dispatch(self):
        s=self.state;r=s['remit']
        if not r or s['vehicle'] or s['flight'] or any(j['kind']=='prepare' for j in s['jobs']):return
        if r['remaining']<=0:return
        if s['time']+r['days']*DAY+PROFILES[r['profile']]['flight']>END:
            eid=self.event('report','Remaining flights deferred','The workshop cannot deliver another round within the remaining chapter. Unused authority can be released.','Ruth Ellis',[r['event']]);s['attention'].append(eid);return
        r['balance']-=r['unit'];r['remaining']-=1
        s['jobs'].append({'kind':'prepare','cost':r['unit'],'due':s['time']+r['days']*DAY,'profile':r['profile'],'focus':r['focus'],'revision':s['configuration'],'links':[r['event']]})
        self.event('work','Ellis begins flight preparation',f"{PROFILES[r['profile']]['name']}, configuration {s['configuration']}. "+{'balanced':'Integration checks and an optical/instrument cross-check.','flight margins':'Additional stand and assembly checks; measurement package remains limited.','measurement':'Independent measurement channels and recovery checks; basic vehicle preparation retained.'}[r['focus']],'Ruth Ellis',[r['event']])

    def recruit(self,person):
        self.active();s=self.state
        if person not in STAFF or not STAFF[person]['salary']:raise RuleError('Choose a listed recruit.')
        if person in s['staff'] or any(j.get('person')==person for j in s['jobs']):raise RuleError('This engineer has already joined or is being recruited.')
        cost=STAFF[person]['salary']
        if cost>self.available():raise RuleError('Recruitment exceeds uncommitted funds. Existing contracted work will continue.')
        s['jobs'].append({'kind':'recruit','person':person,'due':s['time']+30*DAY,'cost':cost})
        self.transaction('commit',cost,'Appointment and chapter retainer: '+STAFF[person]['name']);self.event('decision','Recruitment authorised',STAFF[person]['name']+' will join in 30 days. Retainer covers this chapter; no recurring payroll is modelled.')

    def release(self):
        self.active();s=self.state;r=s['remit']
        if not r:raise RuleError('No unused flight remit to release.')
        amount=r['balance'];r['balance']=0;r['remaining']=0
        self.transaction('release',amount,'Unused flight authority returned')
        self.event('decision','Unused flight authority released',f'${amount:,} returned to uncommitted funds. Already contracted preparation and flight work continue.')
        if not s['vehicle'] and not s['flight'] and not any(j['kind']=='prepare' for j in s['jobs']):s['remit']=None

    def launch(self):
        self.active();s=self.state;v=s['vehicle']
        if not v or s['flight']:raise RuleError('No prepared vehicle is awaiting range release.')
        if s['attention']:raise RuleError('Acknowledge the range report first.')
        p=PROFILES[v['profile']]
        # Outcomes are sampled once at range release, never by observer updates.
        domain=p['domain'];margin=.045 if v['focus']=='flight margins' else 0
        performance=max(.08,min(.96,s['reality'][domain]+margin))
        success=self.rng.random()<performance
        measured=self.rng.random()<min(.96,s['reality']['instrumentation']+(.25 if v['focus']=='measurement' else .08))
        recovered=self.rng.random()<(.6 if 'brooks' in s['staff'] else .38)
        s['flight']={**v,'start':s['time'],'index':0,'duration':p['flight'],'success':success,'measured':measured,'recovered':recovered,'anomaly':False,'phase':'Range release','observations':[]}
        s['vehicle']=None;self.event('launch','Range releases the vehicle',f"{p['name']}, configuration {v['revision']}. Vega retains range safety authority. Your funded remit is in execution.",'Daniel Vega',v['links'])
        s['rng']=self.rng.getstate()

    def finish_job(self,job):
        s=self.state;s['jobs'].remove(job);s['paid']+=job['cost'];self.transaction('settle',job['cost'],'Completed '+job['kind'])
        if job['kind']=='recruit':
            s['staff'].append(job['person']);self.event('personnel','An engineer joins the team',STAFF[job['person']]['name']+': '+STAFF[job['person']]['opinion'],'Personnel file');return
        p=PROFILES[job['profile']];domain=p['domain'];expert='reed' if domain=='staging' else 'chen'
        gain=.06+(.04 if expert in s['staff'] else 0)+(.055 if job['focus']=='flight margins' else 0)
        s['reality'][domain]=min(.92,s['reality'][domain]+gain)
        if job['focus']=='measurement':s['reality']['instrumentation']=min(.92,s['reality']['instrumentation']+.09+(.04 if 'brooks' in s['staff'] else 0))
        prior=[f['event'] for f in s['flights'] if f['profile']==job['profile']][-2:]
        eid=self.event('review','Vehicle ready for range review',f"Configuration {job['revision']}: preparation complete. Ellis: ‘The checks support an attempt; they do not establish flight performance.’ Morgan: ‘{('Independent channels fitted; coverage still unproven.' if job['focus']=='measurement' else 'Optical tracking may constrain our conclusions.')}’"+(' This preparation revisited concerns in the linked flight records.' if prior else ''),'Ruth Ellis',job['links']+prior)
        s['vehicle']={k:deepcopy(job[k]) for k in ('profile','focus','revision','links')};s['vehicle']['links'].append(eid)
        s['configuration']+=1
        if s['remit']['delegated']:self.launch()
        else:s['attention'].append(eid)

    def flight_event(self):
        s=self.state;f=s['flight'];p=PROFILES[f['profile']];i=f['index'];offset,label=p['phases'][i];f['phase']=label;f['index']+=1
        if not f['success'] and i==2:
            f['anomaly']=True
            detail='Tracking indicates departure from the intended profile. Vega is executing range procedures. Ellis: vehicle or interface behaviour is a possible cause; available observations do not isolate it. No executive flight command is required.'
            eid=self.event('anomaly','Unexpected flight development',detail,'Daniel Vega',f['links']);s['attention'].append(eid);f['observations'].append(detail)
        else:
            detail=label+'. '+('Instrument channel returning a record; reduction and validation follow the flight.' if f['measured'] and i>=2 else 'Optical observers reporting; no validated altitude measurement yet.')
            self.event('transcript',label,detail,'Range communications',f['links']);f['observations'].append(detail)
        if f['index']<len(p['phases']):return
        altitude=round(p['altitude']*(.88+self.rng.random()*.2)*(1 if f['success'] else .12+self.rng.random()*.4),1)
        estimate=round(altitude*(.9+self.rng.random()*.2),1)
        useful=f['success'] and (f['measured'] or f['recovered'] or f['profile'] in ('booster','inert'))
        report={'profile':f['profile'],'revision':f['revision'],'date':self.date(),'useful':useful,'flight_observed':f['success'],'record':f['measured'],'recovered':f['recovered'],
                'altitude':estimate if f['measured'] else None,'estimate':round(estimate/5)*5 if not f['measured'] else None,'focus':f['focus'],'links':f['links']}
        assessment=('Ellis: the recorded objective is supported; this is not a blanket qualification of the design.' if useful else 'Ellis: the objective remains unconfirmed. Repeat with stronger measurement coverage or address flight margins; a second opinion cannot replace missing evidence.')
        evidence=('Reduced instrument estimate '+str(estimate)+' km; simplified sensor model, not a physics reconstruction.' if f['measured'] else 'No usable instrument altitude. Coarse optical estimate only: approximately '+str(report['estimate'])+' km; substantial uncertainty.')
        eid=self.event('report',p['name']+' — flight report',evidence+' '+('Range observed the intended flight profile. ' if f['success'] else 'Range observed an incomplete flight profile. ')+('Recovered material is available. ' if f['recovered'] else 'Recovery did not return useful material. ')+assessment,'Ruth Ellis',f['links']);report['event']=eid
        s['flights'].append(report);s['flight']=None;s['attention'].append(eid)
        if s['remit'] and s['remit']['remaining']==0:s['remit']=None

    def acknowledge(self):
        if self.state['attention']:self.state['attention'].pop(0)
        if not self.state['attention']:self.dispatch()

    def proposal(self):
        self.active();s=self.state
        window=(START+timedelta(seconds=s['time'])).year
        tier='research' if window<1948 else 'staging'
        if window<1946 or len(s['flights'])<3:raise RuleError('The sponsor needs at least three flight records and a 1946-or-later continuation review.')
        if tier in s['grant_attempts']:raise RuleError('This continuation proposal has already been considered. No automatic repeat requests.')
        if tier=='staging' and not any(f['profile']=='wac_b' and f['useful'] for f in s['flights']):raise RuleError('Staging funding needs a usable improved-WAC record.')
        s['grant_attempts'].append(tier)
        accepted=self.rng.random()<(.88 if any(f['useful'] for f in s['flights']) else .35)
        amount=(500000 if tier=='research' else 1000000) if accepted else 0
        if accepted:s['allocation']+=amount;s['grants'].append(tier);self.transaction('award',amount,tier+' sponsor award')
        eid=self.event('funding','Sponsor continuation review',('A defined '+tier+f' award of ${amount:,} is approved.' if accepted else 'The sponsor declines additional funds. Existing authorised work continues; reduce scope or close the chapter.')+' Prototype discretionary sponsor decision, not a historical appropriation model.','Helen Price',[f['event'] for f in s['flights'][-3:]]);s['attention'].append(eid)

    def next_time(self):
        s=self.state
        if s['status']=='complete':return None
        values=[j['due'] for j in s['jobs']]+[END]
        if s['flight']:
            f=s['flight'];values.append(f['start']+PROFILES[f['profile']]['phases'][f['index']][0])
        return min(values)

    def advance(self,seconds):
        if type(seconds) is not int or seconds<0:raise RuleError('Advance a non-negative number of simulation seconds.')
        if self.state['attention'] or self.state['status']=='complete':return
        s=self.state;target=min(END,s['time']+seconds)
        while self.next_time() is not None and self.next_time()<=target:
            s['time']=self.next_time()
            for job in list(s['jobs']):
                if job['due']<=s['time']:self.finish_job(job)
            f=s['flight']
            if f and f['start']+PROFILES[f['profile']]['phases'][f['index']][0]<=s['time']:self.flight_event()
            if s['time']==END:self.close();break
            if s['attention']:return
        if not s['attention'] and s['status']=='active':s['time']=target
        s['rng']=self.rng.getstate()

    def next_report(self):
        self.active()
        if self.state['attention']:raise RuleError('Read and acknowledge the current report first.')
        if not self.state['jobs'] and not self.state['flight']:raise RuleError('No report is scheduled. Authorise work, release a prepared vehicle, or choose the next research opportunity.')
        self.advance(max(0,self.next_time()-self.state['time']))

    def opportunity(self):
        self.active();s=self.state
        if s['jobs'] or s['flight'] or s['vehicle'] or s['remit']:raise RuleError('Finish or release the current workshop/range commitment first.')
        dates=[int((datetime.fromisoformat(p['opens'])-START).total_seconds()) for p in DATA['profiles'] if not self.blocker(p['id']).startswith('Needs')]
        dates += [int((datetime(year,1,1)-START).total_seconds()) for year in (1946,1948,1949)]
        future=[t for t in dates if s['time']<t<END]
        if not future:raise RuleError('No later opportunity remains. Continue experiments or close the chapter.')
        self.advance(min(future)-s['time']);self.event('context','Next sponsor/range window','Calendar advanced to the next research or sponsor window. No flights, funding, recruitment or capability were granted by the date alone.','Helen Price')

    def interpretation(self,text):
        if not isinstance(text,str) or len(text)>2000:raise RuleError('Keep your interpretation within 2,000 characters.')
        self.state['theory']=text;self.event('interpretation','Your working interpretation',text)

    def brief(self,question):
        s=self.state;f=s['flight'];latest=s['flights'][-1] if s['flights'] else None
        if question=='observations':
            detail=(f['observations'][-1] if f['observations'] else 'Range release is recorded; no flight measurement is validated yet.') if f else next((e['detail'] for e in s['events'] if latest and e['id']==latest['event']),'We have drawings and preparation records, but no validated flight evidence yet.')
        elif question=='causes':detail='Incomplete optical coverage cannot isolate propulsion, structural or instrumentation causes. A successful flight does not establish that every concern was resolved.'
        elif question=='recommendation':detail='Let Vega execute range procedures. Preserve the record and investigate before another round. You cannot command the vehicle.' if f and f['anomaly'] else 'Complete the authorised observation plan, then review the evidence before extending the programme.'
        else:raise RuleError('Choose a listed contextual question.')
        self.event('briefing','Project engineer: '+question,detail,'Ruth Ellis',[latest['event']] if latest else [])

    def close(self):
        self.active();s=self.state
        if s['flight']:raise RuleError('Let the active flight report before closing.')
        s['status']='complete';self.event('closure','Experimental programme review',f"{len(s['flights'])} flights recorded. Outstanding contracts and unspent authority remain recorded. No automatic NASA/Apollo transfer is implemented.",'Helen Price')

    def public(self):
        s=self.state;f=s['flight'];r=s['remit']
        flight=None
        if f:
            p=PROFILES[f['profile']];elapsed=s['time']-f['start']
            flight={'name':p['name'],'elapsed':elapsed,'duration':p['flight'],'phase':f['phase'],'anomaly':f['anomaly'],'revision':f['revision'],'observations':f['observations'],
                    'visual_fraction':max(0,min(1,elapsed/p['flight'])),'vehicle':'bumper' if p['id'].startswith('bumper') else 'wac'}
        return {'campaign':s['campaign'],'seed':s['seed'],'date':self.date(),'time':s['time'],'status':s['status'],'attention':list(s['attention']),
                'funds':{'allocation':s['allocation'],'paid':s['paid'],'committed':self.committed(),'available':self.available()},'ledger':deepcopy(s['ledger']),
                'events':deepcopy(s['events']),'staff':[{k:v for k,v in p.items() if k not in ('skill','optimism')}|{'appointed':p['id'] in s['staff'],'pending':any(j.get('person')==p['id'] for j in s['jobs'])} for p in DATA['staff']],
                'profiles':[p|{'blocker':self.blocker(p['id']),'quote':self.quote(p['id'],'balanced')} for p in DATA['profiles']],
                'jobs':[{k:v for k,v in j.items() if k not in ('links',)}|{'due_date':self.date(j['due'])} for j in s['jobs']],
                'remit':deepcopy(r),'vehicle':deepcopy(s['vehicle']),'flight':flight,'flights':deepcopy(s['flights']),'theory':s['theory'],'grants':list(s['grants']),'grant_attempts':list(s['grant_attempts'])}

    def briefing(self):return self.public()


def validate(s):
    try:
        if s['campaign']!='pioneers_1945' or s['version']!=1 or s['content']!=CONTENT:raise ValueError('Wrong scenario, save version or content.')
        if type(s['seed']) is not int or not 0<=s['seed']<2**32 or type(s['time']) is not int or not 0<=s['time']<=END:raise ValueError('Invalid clock or seed.')
        if s['status'] not in ('active','complete') or s['focus'] not in FOCI:raise ValueError('Invalid campaign state.')
        sim=Pioneers(s)
        if any(type(s[k]) is not int or s[k]<0 for k in ('allocation','paid','configuration')) or sim.available()<0:raise ValueError('Invalid balances.')
        if len(set(s['staff']))!=len(s['staff']) or any(p not in STAFF for p in s['staff']):raise ValueError('Invalid staff.')
        if set(s['reality'])!={'structure','propulsion','instrumentation','staging'} or any(type(v) not in (int,float) or not math.isfinite(v) or not 0<=v<=1 for v in s['reality'].values()):raise ValueError('Invalid engineering state.')
        ids=set();last=-1
        for i,e in enumerate(s['events'],1):
            if e['id']!=f'P{i:05}' or type(e['time']) is not int or not last<=e['time']<=s['time'] or any(link not in ids for link in e['links']):raise ValueError('Invalid event chronology or causal link.')
            last=e['time'];ids.add(e['id'])
        if any(e not in ids for e in s['attention']):raise ValueError('Missing report.')
        for j in s['jobs']:
            if j['kind'] not in ('recruit','prepare') or type(j['cost']) is not int or j['cost']<0 or type(j['due']) is not int or j['due']<s['time']:raise ValueError('Invalid contract.')
            if j['kind']=='recruit' and (j['person'] not in STAFF or j['person'] in s['staff']):raise ValueError('Invalid recruitment.')
            if j['kind']=='prepare' and (j['profile'] not in PROFILES or j['focus'] not in FOCI):raise ValueError('Invalid preparation.')
        r=s['remit']
        if r and (r['profile'] not in PROFILES or r['focus'] not in FOCI or type(r['delegated']) is not bool or type(r['remaining']) is not int or not 0<=r['remaining']<=3 or r['balance']!=r['remaining']*r['unit'] or r['event'] not in ids):raise ValueError('Invalid remit.')
        if r and (r['unit']!=sim.quote(r['profile'],r['focus'])['per_flight'] or r['days']!=sim.quote(r['profile'],r['focus'])['days']):raise ValueError('Remit differs from scoped preparation.')
        if any(j['kind']=='prepare' and (not r or j['profile']!=r['profile'] or j['cost']!=r['unit'] or any(e not in ids for e in j['links'])) for j in s['jobs']):raise ValueError('Contract has no matching remit.')
        if sum(j['kind']=='prepare' for j in s['jobs'])+bool(s['vehicle'])+bool(s['flight'])>1:raise ValueError('Shared range/workshop overlap.')
        for v in (s['vehicle'],s['flight']):
            if v and (not r or v['profile'] not in PROFILES or v['focus'] not in FOCI or any(link not in ids for link in v['links'])):raise ValueError('Invalid vehicle record.')
        f=s['flight']
        if f and (type(f['index']) is not int or not 0<=f['index']<len(PROFILES[f['profile']]['phases']) or not 0<=f['start']<=s['time'] or any(type(f[k]) is not bool for k in ('success','measured','recovered','anomaly'))):raise ValueError('Invalid active flight.')
        if f and (f['duration']!=PROFILES[f['profile']]['flight'] or f['start']+PROFILES[f['profile']]['phases'][f['index']][0]<s['time']):raise ValueError('Flight clock would run backwards.')
        for f in s['flights']:
            if f['profile'] not in PROFILES or f['event'] not in ids or any(type(f[k]) is not bool for k in ('useful','flight_observed','record','recovered')):raise ValueError('Invalid flight evidence.')
        allocation=DATA['allocation'];paid=0;committed=0;last=-1
        for e in s['ledger']:
            a=e['amount'];op=e['operation']
            if type(a) is not int or a<0 or not last<=e['time']<=s['time']:raise ValueError('Invalid ledger.')
            last=e['time']
            if op=='commit':committed+=a
            elif op=='release':committed-=a
            elif op=='settle':committed-=a;paid+=a
            elif op=='award':allocation+=a
            else:raise ValueError('Unknown ledger operation.')
            if min(committed,paid,allocation-committed-paid)<0 or (e['available'],e['committed'],e['paid'])!=(allocation-paid-committed,committed,paid):raise ValueError('Ledger does not reconcile.')
        if (allocation,paid,committed)!=(s['allocation'],s['paid'],sim.committed()):raise ValueError('Balances differ from obligations.')
        if len(set(s['grant_attempts']))!=len(s['grant_attempts']) or any(t not in ('research','staging') for t in s['grant_attempts']) or any(t not in s['grant_attempts'] for t in s['grants']):raise ValueError('Invalid sponsor record.')
        if len(set(s['grants']))!=len(s['grants']) or allocation!=DATA['allocation']+sum({'research':500000,'staging':1000000}[t] for t in s['grants']):raise ValueError('Sponsor awards differ from authorised funding.')
        json.dumps(s,allow_nan=False)
    except (ValueError,KeyError,TypeError,OverflowError,AttributeError) as error:raise SaveError('Invalid 1945 prototype save: '+str(error)) from error


def save(state,path):
    validate(state);path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);temporary=None
    try:
        with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=path.parent,prefix=path.name+'.',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name);json.dump(state,stream,allow_nan=False);stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,path)
    finally:
        if temporary and temporary.exists():temporary.unlink()


def load(path):
    try:
        path=Path(path)
        if path.stat().st_size>16000000:raise SaveError('Save exceeds 16 MB.')
        state=json.loads(path.read_text(encoding='utf-8'));validate(state);return state
    except (OSError,ValueError) as error:raise SaveError('Could not load 1945 prototype: '+str(error)) from error
