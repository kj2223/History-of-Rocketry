"""Evidence-led engineering choices under explicitly funded delegated authority."""
import math
from .campaign_catalog import CATALOG,PROJECTS,PEOPLE,TECH_POLICY,DAY
from .engine import RuleError


class TechnicalDelegation:
    def technical_owner(self,key):
        candidates=[(mid,p) for mid,p in self.state['plans'].items() if p['authority'] and p['technical_enabled'] and key in p['technical_claims'] and mid not in self.completed()]
        return min(candidates,key=lambda item:item[1]['authority'])[0] if candidates else None

    def technical_estimate(self,key):
        h=self.state['hardware'][key]
        option=next(d for d in PROJECTS[key]['designs'] if d['id']==TECH_POLICY['proposals'][key])
        methods={e['method'] for e in self._evidence(key)}
        pending=next((j for j in self.state['jobs'] if j['component']==key),None)
        if pending and pending['kind']=='rework':methods=set()
        finding=bool(self.findings(key));uncertain=h['status']=='concept' or len(methods)<len(CATALOG['tests'])
        corrective=240000000 if key=='booster' else 160000000
        retry=sum(t['cost'] for t in CATALOG['tests'].values())
        if pending and pending['kind'] in CATALOG['tests']:methods.add(pending['kind'])
        correcting=bool(pending and pending['kind']=='rework')
        factor=1.18-.28*PEOPLE[h['lead']]['skills'][key]
        work_days=math.ceil((pending['due']-self.state['time'])/DAY) if pending else 0
        if h['status']=='concept' and not pending:work_days+=math.ceil(option['days']*factor)
        work_days+=sum(math.ceil(t['days']*factor) for method,t in CATALOG['tests'].items() if method not in methods)
        if (uncertain or finding) and not correcting:work_days+=math.ceil(150*factor)+sum(math.ceil(t['days']*factor) for t in CATALOG['tests'].values())
        return {'engineering':(option['cost'] if h['status']=='concept' and not (pending and pending['kind']=='develop') else 0)+(corrective*TECH_POLICY['corrective_cycles'] if (uncertain or finding) and not correcting else 0),
                'readiness':(retry if finding and not correcting else sum(t['cost'] for method,t in CATALOG['tests'].items() if method not in methods))+(retry*TECH_POLICY['corrective_cycles'] if uncertain and not correcting else 0),
                'proposal':option['id'],'proposal_name':option['name'],'work_days':work_days}

    def quote_technical(self,mission,claimed=None):
        claimed=set() if claimed is None else claimed
        plan=self.state['plans'][mission];projects={}
        for key in self.definition(mission)['requires']:
            owner=self.technical_owner(key)
            if key in claimed or owner and owner!=mission:continue
            estimate=self.technical_estimate(key)
            if estimate['engineering'] or estimate['readiness']:projects[key]=estimate
        total={account:max(0,sum(q[account] for q in projects.values())-plan['technical'][account]) for account in ('engineering','readiness')}
        return {'projects':projects,**total}

    def reserve_technical(self,mission,quote):
        p=self.state['plans'][mission]
        for account in ('engineering','readiness'):
            amount=quote[account]
            if amount:self._money(account,amount,self.definition(mission)['name']+' / delegated technical allowance','commit',mission=mission)
            p['technical'][account]+=amount;p['technical_authorised'][account]+=amount
        p['technical_enabled']=True
        for key in quote['projects']:
            if key not in p['technical_claims']:p['technical_claims'].append(key)

    def plan_technical(self,mission):
        """Choose the next question/correction from reports, never latent condition."""
        p=self.state['plans'][mission]
        if not p['technical_enabled']:return False
        ready=True
        for key in self.definition(mission)['requires']:
            h=self.state['hardware'][key];methods={e['method'] for e in self._evidence(key)}
            if h['status']=='developed' and not self.findings(key) and len(methods)==len(CATALOG['tests']):continue
            ready=False
            owner=self.technical_owner(key)
            if not owner:
                self.hold_plan(mission,'Current evidence requires technical work that is not covered by any active technical allowance.');return False
            sponsor=self.state['plans'][owner]
            if sponsor['held'] or any(j['component']==key for j in self.state['jobs']):continue
            if sum(not j.get('mission') for j in self.state['jobs'])>=self.state['capacity'] or any(j['lead']==h['lead'] and not j.get('mission') for j in self.state['jobs']):continue
            if h['status']=='concept':kind='develop';design=TECH_POLICY['proposals'][key];account='engineering';cost=next(d['cost'] for d in PROJECTS[key]['designs'] if d['id']==design)
            elif self.findings(key):kind='rework';design=None;account='engineering';cost=240000000 if key=='booster' else 160000000
            else:kind=next(method for method in CATALOG['tests'] if method not in methods);design=None;account='readiness';cost=CATALOG['tests'][kind]['cost']
            if sponsor['technical'][account]<cost:
                self.hold_plan(owner,'The team needs '+kind+' on '+PROJECTS[key]['name']+' but its remaining '+account+' allowance cannot cover the package. No new work was charged.');return False
            self.commission(kind,key,design,sponsor=owner)
        return ready

    def release_technical(self,mission):
        p=self.state['plans'][mission]
        for account,amount in p['technical'].items():
            if amount:self._money(account,amount,self.definition(mission)['name']+' / unused technical allowance released','release',mission=mission)
            p['technical_released'][account]+=amount
            p['technical'][account]=0

    def technical_accounts(self,mission):
        p=self.state['plans'][mission]
        return {account:{'authorised':p['technical_authorised'][account],'available':remaining,
                         'contracted':sum(j['cost'] for j in self.state['jobs'] if j.get('sponsor')==mission and j['account']==account),
                         'released':p['technical_released'][account],
                         'paid':p['technical_authorised'][account]-remaining-p['technical_released'][account]-sum(j['cost'] for j in self.state['jobs'] if j.get('sponsor')==mission and j['account']==account)} for account,remaining in p['technical'].items()}

    def technical_projection(self,key):
        owner=self.technical_owner(key)
        return {'owner':owner,'estimate':self.technical_estimate(key),'policy':TECH_POLICY['description']}
