"""Standalone 1958–61 institution-building prototype; no Apollo-state mutation."""
from copy import deepcopy
from datetime import datetime,timedelta
import hashlib
import json
import math
from pathlib import Path
import random

from .engine import RuleError,tuples
from .persistence import SaveError

DATA=json.loads((Path(__file__).with_name('campaign_data')/'founding.json').read_text(encoding='utf-8'))
CONTENT=hashlib.sha256(json.dumps(DATA,sort_keys=True).encode()).hexdigest()[:16]
DAY=86400
START=datetime.fromisoformat(DATA['start'])
END=int((datetime.fromisoformat(DATA['end'])-START).total_seconds())
CANDIDATES={p['id']:p for p in DATA['candidates']}
DOMAINS=DATA['research']
ACTING={'id':'acting','name':'Evelyn Price · acting NACA liaison','rigour':0.64,'optimism':0.01,'challenge':0.65,'skills':{k:0.45 for k in DOMAINS}}


class Founding:
    def __init__(self,state):
        self.state=state;self.rng=random.Random();state['rng']=tuples(state['rng']);self.rng.setstate(state['rng'])

    @classmethod
    def new(cls,seed=11):
        if type(seed) is not int or not 0<=seed<2**32:raise RuleError('Choose a whole-number seed from 0 to 4,294,967,295.')
        rng=random.Random(seed)
        state={'campaign':'nasa_1958','version':1,'content':CONTENT,'seed':seed,'time':0,'rng':rng.getstate(),'sequence':0,'status':'active','teams':2,
               'appointments':{role:None for role in DATA['roles']},'assessments':{},'memories':{p:[] for p in CANDIDATES},
               'funds':{a:{'allocation':v,'committed':0,'paid':0} for a,v in DATA['funding'].items()},'ledger':[],'events':[],'jobs':[],'attention':[],'contexts':[],'theory':'No interpretation recorded.',
               'research':{key:{'authority':None,'mode':'direct','stage':0,'status':'unfunded','balance':0,'authorised':0,'paid':0,'released':0,'reports':[],'revision':1,'correction':False,'reality':rng.uniform(.16,.27),'difficulty':rng.uniform(.35,.7)} for key in DOMAINS}}
        sim=cls(state);sim.event('context','NASA opens for business','1 October 1958. You inherit NACA laboratories, facilities, an aggregate workforce and ongoing aeronautical knowledge. Your task is to organise the new civilian agency, appoint its key leaders and decide which questions its teams should investigate. This is a separate prototype, not yet a merged Apollo campaign.','Agency briefing');return sim

    def date(self,at=None):return (START+timedelta(seconds=self.state['time'] if at is None else at)).strftime('%d %b %Y · %H:%M')

    def event(self,kind,title,detail,actor='Administrator',links=(),domain=None):
        s=self.state;s['sequence']+=1;e={'id':f"F{s['sequence']:05}",'time':s['time'],'date':self.date(),'kind':kind,'title':title,'detail':detail,'actor':actor,'links':list(links),'domain':domain}
        s['events'].append(e);s['rng']=self.rng.getstate()
        return e['id']

    def active(self):
        if self.state['status']!='active':raise RuleError('This opening chapter has ended. Review or export its record; the Apollo merge is not implemented.')

    def available(self,account):
        f=self.state['funds'][account];return f['allocation']-f['committed']-f['paid']

    def money(self,account,amount,purpose,operation,domain=None):
        f=self.state['funds'][account]
        if type(amount) is not int or amount<0:raise RuleError('Use a positive whole-dollar amount.')
        if operation=='commit':
            if self.available(account)<amount:raise RuleError('Insufficient uncommitted '+account+' authority. Defer new work or explicitly release remaining reserve.')
            f['committed']+=amount
        elif operation=='settle':
            if f['committed']<amount:raise RuleError('Payment exceeds recorded commitments.')
            f['committed']-=amount;f['paid']+=amount
        elif operation=='release':
            if f['committed']<amount:raise RuleError('Release exceeds recorded commitments.')
            f['committed']-=amount
        elif operation!='assign':raise RuleError('Unknown financial operation.')
        self.state['ledger'].append({'time':self.state['time'],'date':self.date(),'account':account,'amount':amount,'purpose':purpose,'operation':operation,'domain':domain,'available':self.available(account)})

    def reserve(self,account,amount,reason):
        self.active()
        if account not in ('research','organisation') or type(amount) is not int or amount<=0 or not isinstance(reason,str) or not reason.strip():raise RuleError('Specify an account, a positive whole-dollar amount and a reason.')
        if self.available('reserve')<amount:raise RuleError('The remaining Administrator reserve cannot cover this release.')
        self.state['funds']['reserve']['allocation']-=amount;self.state['funds'][account]['allocation']+=amount
        self.state['ledger'].append({'time':self.state['time'],'date':self.date(),'account':account,'amount':amount,'purpose':reason.strip(),'operation':'reserve release','domain':None,'available':self.available(account)})
        self.event('funding','Reserve authority released',reason.strip()+f' ${amount:,} moves to {account}; no money is created.')

    def person(self,person):return ACTING if person=='acting' else CANDIDATES[person]
    def lead(self,key):return self.state['appointments'][DOMAINS[key]['role']] or 'acting'
    def reviewer(self):return self.state['appointments']['assurance']
    def review_quote(self):return (4000000,45) if self.reviewer() else (6000000,70)
    def busy(self,key):return any(j.get('domain')==key for j in self.state['jobs'])

    def quote(self,key):
        if key not in DOMAINS:raise RuleError('Choose a listed research priority.')
        p=self.state['research'][key];remaining=DOMAINS[key]['stages'][p['stage']:]
        review_cost,review_days=self.review_quote()
        return {'cost':sum(t['cost'] for t in remaining)+review_cost+12000000,'days':sum(t['days'] for t in remaining)+review_days,'contingency':12000000,'review_cost':review_cost,'review_days':review_days}

    def assess(self,person):
        self.active()
        if person not in CANDIDATES:raise RuleError('Choose a candidate.')
        if person in self.state['assessments'] or any(j.get('person')==person for j in self.state['jobs']):raise RuleError('This candidate is already assessed or in a recruitment process.')
        self.staffing_job('assess',person,250000,21)

    def appoint(self,person):
        self.active()
        if person not in CANDIDATES:raise RuleError('Choose a candidate.')
        role=CANDIDATES[person]['role'];old=self.state['appointments'][role]
        if old==person or any(j.get('role')==role for j in self.state['jobs']):raise RuleError('This post is already filled by that person or has an appointment under way.')
        if old and any(j.get('lead')==old for j in self.state['jobs']):raise RuleError('The current post-holder remains accountable for an active package. Finish it before a handover.')
        self.staffing_job('appoint',person,1500000,30)

    def staffing_job(self,kind,person,cost,days):
        if sum(j['kind'] in ('assess','appoint') for j in self.state['jobs'])>=2:raise RuleError('Both staffing/onboarding teams are committed.')
        p=CANDIDATES[person];self.money('organisation',cost,p['name']+' / '+kind,'commit')
        e=self.event('appointment','Candidate assessment commissioned' if kind=='assess' else 'Appointment authorised',p['name']+f" / {DATA['roles'][p['role']]}. ${cost:,} committed; {days} days. Appointments include an aggregate team mobilisation package, not an individual salary.")
        self.state['jobs'].append({'id':e,'kind':kind,'person':person,'role':p['role'],'lead':None,'domain':None,'due':self.state['time']+days*DAY,'cost':cost,'account':'organisation','seed':self.rng.getrandbits(32)})
        self.state['rng']=self.rng.getstate()

    def expand(self):
        self.active()
        if self.state['teams']>=3 or any(j['kind']=='expand' for j in self.state['jobs']):raise RuleError('The third aggregate research team is already funded or available.')
        self.money('organisation',8000000,'Third aggregate research team','commit');e=self.event('organisation','Research capacity expansion authorised','A third aggregate team takes 90 days and $8m. Specialists still cannot lead two simultaneous packages.')
        self.state['jobs'].append({'id':e,'kind':'expand','person':None,'role':None,'lead':None,'domain':None,'due':self.state['time']+90*DAY,'cost':8000000,'account':'organisation','seed':0})

    def authorise(self,key,amount):
        self.active()
        if key not in DOMAINS or type(amount) is not int or amount<=0:raise RuleError('Choose a research priority and positive whole-dollar allowance.')
        p=self.state['research'][key]
        if p['authority']:raise RuleError('This programme is already authorised. Use an explicit budget extension.')
        self.money('research',amount,DOMAINS[key]['name']+' / research authority','commit',key);p['balance']=amount;p['authorised']=amount;p['status']='ready'
        p['authority']=self.event('charter',DOMAINS[key]['name']+' authorised',DOMAINS[key]['question']+f' ${amount:,} is reserved for its teams. Initial oversight is direct; the specialists choose the technical work.',domain=key)
        self.dispatch()

    def top_up(self,key,amount):
        self.active()
        if key not in DOMAINS or type(amount) is not int or amount<=0:raise RuleError('Specify a research programme and positive allowance.')
        p=self.state['research'][key]
        if not p['authority'] or p['status']=='demonstrated':raise RuleError('Choose an existing unfinished programme.')
        self.money('research',amount,DOMAINS[key]['name']+' / authority extension','commit',key);p['balance']+=amount;p['authorised']+=amount
        e=self.event('charter','Research authority extended',f"${amount:,} added to {DOMAINS[key]['name']}; the previous record and payments remain.",links=[p['authority']],domain=key);p['authority']=e
        if p['status']=='resource hold':p['status']='ready'
        self.dispatch()

    def delegate(self,key,mode):
        self.active()
        if key not in DOMAINS or mode not in ('direct','bounded','refer'):raise RuleError('Choose a programme and reporting boundary.')
        p=self.state['research'][key]
        if not p['authority'] or p['status']=='demonstrated':raise RuleError('Choose an authorised unfinished research programme.')
        if mode!='direct' and (not self.state['appointments']['programme'] or self.lead(key)=='acting'):raise RuleError('Appoint a programme director and this research area’s specialist before granting delegated authority.')
        if p['mode']==mode:raise RuleError('That reporting boundary is already in force.')
        p['mode']=mode
        e=self.event('delegation',DOMAINS[key]['name']+' / authority revised',{'direct':'Reports return for executive continuation decisions.','bounded':'Teams may commission the scoped stages and routine correction within the allowance. Resource and scope exceptions return to the Administrator.','refer':'Teams may advance routine stages but must refer adverse demonstration findings before corrective work.'}[mode],links=[p['authority']],domain=key)
        if p['status']=='awaiting continuation' or p['status']=='adverse finding' and mode=='bounded':p['status']='ready'
        if self.lead(key) in self.state['memories']:self.state['memories'][self.lead(key)].append(e)
        self.dispatch()

    def continue_research(self,key):
        self.active()
        if key not in DOMAINS:raise RuleError('Choose a research programme.')
        p=self.state['research'][key]
        if p['status'] not in ('awaiting continuation','adverse finding','deferred'):raise RuleError('This programme is not awaiting a continuation decision.')
        p['status']='ready';self.event('decision',DOMAINS[key]['name']+' / continuation approved','Continue the team’s scoped investigation within the existing account allowance. This neither changes observations nor waives independent review.',links=[p['authority']],domain=key);self.dispatch()

    def defer(self,key):
        self.active()
        if key not in DOMAINS or not self.state['research'][key]['authority'] or self.state['research'][key]['status']=='demonstrated':raise RuleError('Choose an unfinished funded programme.')
        p=self.state['research'][key];p['status']='deferred';amount=p['balance']
        if amount:self.money('research',amount,DOMAINS[key]['name']+' / unused authority released','release',key)
        p['released']+=amount;p['balance']=0
        self.event('decision','Research programme deferred','Unassigned authority returns to research. Already contracted work finishes and remains paid history; restarting needs a funded continuation.',links=[p['authority']],domain=key)

    def request(self,key,kind,detail):
        p=self.state['research'][key]
        if p['status']==kind:return
        p['status']=kind;e=self.event('attention',DOMAINS[key]['name']+' / '+kind,detail,self.person(self.lead(key))['name'],[p['authority']],key);self.state['attention'].append(e)

    def dispatch(self):
        if self.state['status']!='active' or self.state['attention']:return
        for key,p in self.state['research'].items():
            if not p['authority'] or p['status']!='ready' or self.busy(key):continue
            if sum(j['kind']=='research' for j in self.state['jobs'])>=self.state['teams']:break
            if p['correction']:name='Targeted investigation and corrective trial';cost=6000000;days=60;gain=.15;kind='correction';lead=self.lead(key)
            elif p['stage']<len(DOMAINS[key]['stages']):
                spec=DOMAINS[key]['stages'][p['stage']];name=spec['name'];cost=spec['cost'];days=spec['days'];gain=spec['gain'];kind='stage';lead=self.lead(key)
            else:
                lead=self.reviewer() or 'panel';cost,days=self.review_quote();gain=0.;name='Independent evidence review';kind='review'
            if any(j.get('lead')==lead for j in self.state['jobs']):continue
            if cost>p['balance']:self.request(key,'resource hold',f"The team proposes {name}, costing ${cost:,}. Only ${p['balance']:,} remains in its allowance. Extend the authority, defer work or revise priorities; no unapproved expense has been charged.");break
            person=self.person(lead) if lead!='panel' else {'name':'Inherited independent review panel','rigour':.75,'optimism':-.02,'challenge':.85,'skills':{k:.65 for k in DOMAINS}}
            duration=math.ceil(days*(1.2-.3*person['skills'][key]));p['balance']-=cost;self.money('research',cost,DOMAINS[key]['name']+' / '+name,'assign',key)
            e=self.event('work',name+' commissioned',f"{person['name']} commits ${cost:,} from the approved programme allowance; estimated {duration} days. The Administrator does not select the technical procedure.",person['name'],[p['authority']],key)
            self.state['jobs'].append({'id':e,'kind':'research','research_kind':kind,'person':None,'role':None,'lead':lead,'domain':key,'due':self.state['time']+duration*DAY,'cost':cost,'account':'research','gain':gain,'rigour':person['rigour'],'skill':person['skills'][key],'optimism':person['optimism'],'challenge':person['challenge'],'actor':person['name'],'seed':self.rng.getrandbits(32),'stage':p['stage'],'revision':p['revision']});p['status']='working'
            self.state['rng']=self.rng.getstate()

    def finish(self,job):
        s=self.state;key=job['domain'];self.money(job['account'],job['cost'],'Payment: '+next(e['title'] for e in s['events'] if e['id']==job['id']),'settle',key)
        if job['kind']=='assess':
            person=CANDIDATES[job['person']];r=random.Random(job['seed']);estimate=round(max(0,min(1,person['skills'].get(person['role'],.75)+r.gauss(0,.08))),2)
            text=('References describe strong relevant experience.' if estimate>.75 else 'References support relevant experience, with gaps that further work must expose.')+' '+person['view']+' References are professional interpretations, not verified measures of future performance.'
            e=self.event('recruitment',person['name']+' / reference report',text,'Appointments office',[job['id']]);s['assessments'][person['id']]={'event':e,'text':text};s['memories'][person['id']].append(e)
        elif job['kind']=='appoint':
            person=CANDIDATES[job['person']];previous=s['appointments'][job['role']];s['appointments'][job['role']]=person['id']
            e=self.event('appointment',person['name']+' takes office',DATA['roles'][job['role']]+'. Existing research packages retain their original lead and evidence. Future packages use the appointed specialist. '+person['view'],person['name'],[job['id']]);s['memories'][person['id']].append(e)
            if previous:s['memories'][previous].append(e)
        elif job['kind']=='expand':s['teams']=3;self.event('organisation','Third research team available','Aggregate capacity increased; individual specialist availability still applies.','Organisation office',[job['id']])
        else:self.finish_research(job)

    def finish_research(self,job):
        s=self.state;key=job['domain'];p=s['research'][key];p['paid']+=job['cost'];rng=random.Random(job['seed']);deferred=p['status']=='deferred'
        kind=job['research_kind']
        if kind!='review':p['reality']=min(.95,p['reality']+job['gain']*(.65+.6*job['skill']))
        if kind=='correction':p['revision']+=1;p['correction']=False
        observed=round(max(0,min(1,p['reality']-.2*p['difficulty']+rng.gauss(0,.075-.04*job['rigour']))),3)
        confidence=observed+job['optimism'];assessment='Supports further work within the reported conditions.' if confidence>=.5 else 'The evidence is provisional; the limits need explicit attention.'
        if job['challenge']>.8 and confidence<.55:assessment+=' I would challenge a broader readiness claim on this record.'
        report={'observation':observed,'source':job['actor'],'kind':kind,'revision':p['revision'],'assessment':assessment,'caveat':DOMAINS[key]['caveat'],'date':self.date()}
        e=self.event('report',DOMAINS[key]['name']+' / '+kind+' report',f"Instrument/model agreement index {observed:.3f} (synthetic research observation, not flight reliability). "+assessment+' '+report['caveat'],job['actor'],[job['id']],key);report['event']=e;p['reports'].append(report)
        if job['lead'] in s['memories']:s['memories'][job['lead']].append(e)
        if kind=='stage':p['stage']+=1
        if deferred:return
        if kind=='review' and observed>=.5:
            p['status']='demonstrated';amount=p['balance']
            if amount:self.money('research',amount,DOMAINS[key]['name']+' / unused authority returned','release',key)
            p['balance']=0;p['released']+=amount
            self.event('capability','Scoped evidence recorded',DOMAINS[key]['name']+' has an independent demonstration record. This does not qualify Apollo hardware or guarantee a future flight. No reputation or morale reward is awarded.','Independent review',[e],key);return
        if kind=='review':
            p['correction']=True
            if p['mode']!='bounded':self.request(key,'adverse finding','The independent observation does not support the proposed claim. The team recommends a targeted investigation and a new review, within the remaining allowance if funded.');return
        if p['mode']=='direct':self.request(key,'awaiting continuation','A scoped report is available. Read the evidence and team judgement, then approve continuation, change authority or defer the programme.');return
        p['status']='ready'

    def next_time(self):
        times=[j['due'] for j in self.state['jobs']]
        times += [int((datetime.fromisoformat(e['date'])-START).total_seconds()) for i,e in enumerate(DATA['events']) if i not in self.state['contexts']]
        return min(times+[END]) if self.state['status']=='active' else None

    def acknowledge(self):
        if self.state['attention']:self.state['attention'].pop(0)

    def advance(self,seconds):
        self.active()
        if type(seconds) is not int or not 0<seconds<=END:raise RuleError('Advance a positive whole number of seconds within this chapter.')
        if self.state['attention']:raise RuleError('Inspect and acknowledge the current report first.')
        self.dispatch()
        if self.state['attention']:return
        target=min(END,self.state['time']+seconds)
        while self.state['time']<target:
            self.state['time']=min(target,self.next_time())
            for job in sorted(self.state['jobs'][:],key=lambda j:(j['due'],j['id'])):
                if job['due']<=self.state['time']:self.state['jobs'].remove(job);self.finish(job)
            for i,event in enumerate(DATA['events']):
                if i not in self.state['contexts'] and datetime.fromisoformat(event['date'])<=START+timedelta(seconds=self.state['time']):self.state['contexts'].append(i);self.event('context',event['title'],event['detail'],'External briefing')
            if self.state['time']==END:
                self.state['status']='complete';self.event('context','The lunar commitment','25 May 1961. Kennedy asks for a lunar landing and safe return before the decade ends. Review the institution you have built: appointments, research evidence, unfinished work and committed funds. This prototype ends here; no Apollo campaign has been created or modified.','National briefing');break
            self.dispatch()
            if self.state['attention']:break
        self.state['rng']=self.rng.getstate()

    def next_report(self):
        self.active();self.advance(max(1,self.next_time()-self.state['time']))

    def interpretation(self,text):
        if not isinstance(text,str) or not 1<=len(text.strip())<=2000:raise RuleError('Record an interpretation of 1–2,000 characters.')
        self.state['theory']=text.strip();self.event('interpretation','Administrator interpretation recorded',text.strip())

    def public(self):
        s=self.state;research=[]
        for key,spec in DOMAINS.items():
            p=s['research'][key];lead=self.lead(key);appointed=lead!='acting';director=s['appointments']['programme']
            active=next((j for j in s['jobs'] if j['domain']==key),None)
            public_spec={k:deepcopy(v) for k,v in spec.items() if k!='stages'}|{'stages':[{k:v for k,v in stage.items() if k!='gain'} for stage in spec['stages']]}
            research.append({'id':key,**public_spec,'authority':p['authority'],'mode':p['mode'],'status':p['status'],'stage':p['stage'],'revision':p['revision'],'reports':deepcopy(p['reports']),
                             'lead':self.person(lead)['name'],'lead_id':lead,'can_delegate':bool(appointed and director),'delegation_reason':None if appointed and director else 'Appoint a programme director and the relevant specialist; inherited acting cover can support direct oversight.',
                             'budget':{'authorised':p['authorised'],'available':p['balance'],'paid':p['paid'],'released':p['released'],'contracted':sum(j['cost'] for j in s['jobs'] if j['domain']==key)},'quote':self.quote(key),'job':self.job_public(active) if active else None})
        return {'campaign':s['campaign'],'seed':s['seed'],'date':self.date(),'time':s['time'],'status':s['status'],'end_date':self.date(END),'teams':s['teams'],'appointments':deepcopy(s['appointments']),'roles':deepcopy(DATA['roles']),
                'candidates':[{k:deepcopy(v) for k,v in p.items() if k in ('id','name','role','profile','view')}|{'assessment':deepcopy(s['assessments'].get(p['id'])),'appointed':s['appointments'][p['role']]==p['id'],'memories':list(s['memories'][p['id']])} for p in DATA['candidates']],
                'research':research,'funds':{k:{**f,'available':self.available(k)} for k,f in s['funds'].items()},'ledger':deepcopy(s['ledger']),'jobs':[self.job_public(j) for j in s['jobs']],
                'events':deepcopy(s['events']),'attention':list(s['attention']),'theory':s['theory'],'next_report':self.date(self.next_time()) if self.next_time() is not None else None}

    def job_public(self,j):
        return {k:deepcopy(j[k]) for k in ('id','kind','person','role','lead','domain','cost','account','due')}|{'days_left':round(max(0,j['due']-self.state['time'])/DAY,1),'due_date':self.date(j['due'])}

    def handoff(self):
        p=self.public()
        return {'schema':'per_aspera.founding_handoff','version':1,'merge_implemented':False,'source_campaign':'nasa_1958','source_content':CONTENT,'date':p['date'],'chapter_complete':p['status']=='complete',
                'appointments':p['appointments'],'people':p['candidates'],'research':p['research'],'funds':p['funds'],'outstanding_work':p['jobs'],'event_history':p['events'],'administrator_interpretation':p['theory'],
                'boundary':'Public institutional record only. No automatic Apollo hardware, money, qualification or reliability mapping. A future merge must also use the validated private opening save to preserve underlying reality.'}

    def briefing(self):return self.public()


def validate(state):
    try:
        if state['campaign']!='nasa_1958' or state['version']!=1 or state['content']!=CONTENT:raise ValueError('Unsupported opening save or catalogue.')
        if type(state['time']) is not int or not 0<=state['time']<=END or state['status'] not in ('active','complete') or (state['status']=='complete')!=(state['time']==END):raise ValueError('Invalid chapter date or status.')
        if type(state['seed']) is not int or not 0<=state['seed']<2**32 or state['teams'] not in (2,3):raise ValueError('Invalid seed or aggregate capacity.')
        if set(state['appointments'])!=set(DATA['roles']) or set(state['research'])!=set(DOMAINS) or set(state['funds'])!=set(DATA['funding']) or set(state['memories'])!=set(CANDIDATES):raise ValueError('Invalid agency records.')
        for role,person in state['appointments'].items():
            if person is not None and (person not in CANDIDATES or CANDIDATES[person]['role']!=role):raise ValueError('Appointment does not match its post.')
        seen=set();previous=-1
        for i,e in enumerate(state['events'],1):
            if e['id']!=f'F{i:05}' or not previous<=e['time']<=state['time'] or any(link not in seen for link in e['links']):raise ValueError('Invalid event chronology or provenance.')
            seen.add(e['id']);previous=e['time']
        if state['sequence']!=len(seen) or any(e not in seen for e in state['attention']) or len(set(state['attention']))!=len(state['attention']):raise ValueError('Invalid event or attention cursor.')
        if any(type(i) is not int or not 0<=i<len(DATA['events']) for i in state['contexts']) or len(set(state['contexts']))!=len(state['contexts']):raise ValueError('Invalid historical-context cursor.')
        if set(state['contexts'])!={i for i,e in enumerate(DATA['events']) if datetime.fromisoformat(e['date'])<=START+timedelta(seconds=state['time'])}:raise ValueError('Historical-context cursor does not match the saved date.')
        for person,assessment in state['assessments'].items():
            if person not in CANDIDATES or assessment['event'] not in seen:raise ValueError('Invalid reference report.')
        if any(link not in seen for memories in state['memories'].values() for link in memories):raise ValueError('Invalid staff memory.')
        leads=set();domains=set();posts=set();staffing=0;research_jobs=0
        for job in state['jobs']:
            if job['id'] not in seen or job['kind'] not in ('assess','appoint','expand','research') or type(job['due']) is not int or not state['time']<job['due']<=END+3*366*DAY or type(job['cost']) is not int or job['cost']<=0:raise ValueError('Invalid work package.')
            if job['kind']=='research':
                research_jobs+=1;key=job['domain']
                if key not in DOMAINS or key in domains or job['lead'] in leads or job['lead'] not in (*CANDIDATES,'acting','panel') or job['research_kind'] not in ('stage','review','correction'):raise ValueError('Conflicting or invalid research package.')
                if not 0<=job['skill']<=1 or not 0<=job['rigour']<=1 or not 0<=job['gain']<=1:raise ValueError('Invalid frozen research conditions.')
                leads.add(job['lead']);domains.add(key)
            elif job['kind'] in ('assess','appoint'):
                staffing+=1
                if job['person'] not in CANDIDATES or job['role']!=CANDIDATES[job['person']]['role']:raise ValueError('Invalid staffing package.')
                if job['kind']=='appoint':
                    if job['role'] in posts:raise ValueError('Conflicting appointments.')
                    posts.add(job['role'])
        if research_jobs>state['teams'] or staffing>2:raise ValueError('Aggregate capacity exceeded.')
        for key,p in state['research'].items():
            if p['authority'] is not None and p['authority'] not in seen or p['mode'] not in ('direct','bounded','refer') or p['status'] not in ('unfunded','ready','working','awaiting continuation','adverse finding','resource hold','deferred','demonstrated'):raise ValueError('Invalid research remit.')
            if type(p['stage']) is not int or not 0<=p['stage']<=len(DOMAINS[key]['stages']) or not 0<=p['reality']<=1 or not 0<=p['difficulty']<=1 or type(p['revision']) is not int or p['revision']<1:raise ValueError('Invalid research state.')
            if any(type(p[v]) is not int or p[v]<0 for v in ('balance','authorised','paid','released')):raise ValueError('Invalid programme accounts.')
            contracted=sum(j['cost'] for j in state['jobs'] if j['domain']==key)
            if p['authorised']!=p['balance']+p['paid']+p['released']+contracted:raise ValueError('Research account does not reconcile.')
            entries=[e for e in state['ledger'] if e.get('domain')==key]
            if p['authorised']!=sum(e['amount'] for e in entries if e['operation']=='commit') or p['paid']!=sum(e['amount'] for e in entries if e['operation']=='settle') or p['released']!=sum(e['amount'] for e in entries if e['operation']=='release'):raise ValueError('Programme account differs from its transaction ledger.')
            for report in p['reports']:
                if report['event'] not in seen or not 0<=report['observation']<=1 or not 1<=report['revision']<=p['revision']:raise ValueError('Invalid research evidence.')
        replay={k:{'allocation':v,'paid':0,'committed':0} for k,v in DATA['funding'].items()};last=-1
        for e in state['ledger']:
            if type(e['amount']) is not int or e['amount']<0 or not last<=e['time']<=state['time']:raise ValueError('Invalid financial chronology.')
            last=e['time'];f=replay[e['account']];amount=e['amount']
            if e['operation']=='commit':f['committed']+=amount
            elif e['operation']=='settle':f['committed']-=amount;f['paid']+=amount
            elif e['operation']=='release':f['committed']-=amount
            elif e['operation']=='assign':pass
            elif e['operation']=='reserve release':replay['reserve']['allocation']-=amount;f['allocation']+=amount
            else:raise ValueError('Unknown financial transaction.')
            if any(v<0 for account in replay.values() for v in account.values()) or f['allocation']-f['paid']-f['committed']!=e['available']:raise ValueError('Financial transaction does not reconcile.')
        if replay!=state['funds']:raise ValueError('Agency balances differ from the ledger.')
        for account,f in state['funds'].items():
            obligation=sum(j['cost'] for j in state['jobs'] if j['account']==account)+(sum(p['balance'] for p in state['research'].values()) if account=='research' else 0)
            if f['committed']!=obligation or f['allocation']<f['committed']+f['paid']:raise ValueError('Outstanding work differs from commitments.')
        random.Random().setstate(tuples(state['rng']));json.dumps(state,allow_nan=False)
    except (ValueError,KeyError,TypeError,OverflowError) as error:raise SaveError('Invalid 1958 opening: '+str(error)) from error


def save(state,path):
    import os
    import tempfile
    validate(state);path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);temporary=None
    try:
        with tempfile.NamedTemporaryFile('w',encoding='utf-8',dir=path.parent,prefix=path.name+'.',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name);json.dump(state,stream,indent=2,allow_nan=False);stream.flush();os.fsync(stream.fileno())
        os.replace(temporary,path)
    finally:
        if temporary and temporary.exists():temporary.unlink()


def load(path):
    try:
        path=Path(path)
        if path.stat().st_size>16000000:raise SaveError('Opening save exceeds 16 MB.')
        state=json.loads(path.read_text(encoding='utf-8'));validate(state);return state
    except (OSError,ValueError) as error:raise SaveError('Could not load opening save: '+str(error)) from error


def demonstrate(seed=11):
    """Example public-evidence policy, with explicit hiring and delegation choices."""
    sim=Founding.new(seed);sim.authorise('spacecraft',sim.quote('spacecraft')['cost']);sim.expand()
    people=['bennett','hayes','mercer','ortiz','chen','reed']
    for _ in range(150):
        if sim.state['status']=='complete':break
        while sim.state['attention']:sim.acknowledge()
        for person in people:
            role=CANDIDATES[person]['role']
            if not sim.state['appointments'][role] and not any(j.get('role')==role for j in sim.state['jobs']) and sum(j['kind'] in ('assess','appoint') for j in sim.state['jobs'])<2:sim.appoint(person)
        for key in ('spacecraft','propulsion','operations','human'):
            p=sim.state['research'][key]
            if not p['authority'] and sim.quote(key)['cost']<=sim.available('research'):sim.authorise(key,sim.quote(key)['cost'])
            if p['authority'] and p['status']!='demonstrated':
                if p['mode']=='direct' and sim.state['appointments']['programme'] and sim.lead(key)!='acting' and (key!='spacecraft' or p['reports']):sim.delegate(key,'bounded')
                if p['status'] in ('awaiting continuation','adverse finding'):sim.continue_research(key)
                if p['status']=='resource hold' and sim.available('research')>=10000000:sim.top_up(key,10000000)
        sim.next_report()
    validate(sim.state);return sim
