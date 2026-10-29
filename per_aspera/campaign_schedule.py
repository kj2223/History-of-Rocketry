"""Delegated mandates, preparation capacity and evidence-based flight gates."""
from copy import deepcopy

from .campaign_catalog import MISSIONS,SCHEDULE,PEOPLE,DAY,new_plan
from .engine import RuleError
from .campaign_technical import TechnicalDelegation


class MissionSchedule(TechnicalDelegation):
    def definition(self,mission=None):
        if mission is None:return self.mission
        if mission not in MISSIONS:raise RuleError('Choose a listed mission.')
        return MISSIONS[mission]

    def completed(self):return {r['mission'] for r in self.state['results'] if r['outcome']=='objective_complete'}

    def sync_focus(self):
        done=self.completed();s=self.state
        s['mission_index']=next((i for i,m in enumerate(MISSIONS.values()) if m['id'] not in done),len(MISSIONS)-1)
        p=s['plans'][self.mission['id']]
        s['prepared']=deepcopy(p['prepared']);s['clearance']=deepcopy(p['clearance'])

    def costs(self,mission):
        m=self.definition(mission)
        return {'prepare':35000000 if m.get('ground') else 90000000,'review':20000000,'execute':35000000 if m.get('ground') else 70000000}

    def quote_mandate(self,mission):
        p=self.state['plans'][mission];costs=self.costs(mission);fingerprint=self.fingerprint(mission)
        required={'prepare':p['prepared']!=fingerprint,'review':p['clearance']!=fingerprint,'execute':True}
        return {stage:cost if required[stage] and not p['obligations'][stage] else 0 for stage,cost in costs.items()}

    def authorise_missions(self,missions,manager='bennett'):
        self._active();s=self.state
        if s['architecture']!='lor':raise RuleError('Endorse the development architecture before delegating missions.')
        if not isinstance(missions,list) or not missions or len(missions)!=len(set(missions)) or any(m not in MISSIONS for m in missions):raise RuleError('Select one or more different mission dossiers.')
        if manager not in PEOPLE or manager=='ortiz':raise RuleError('Choose a programme manager; independent assurance stays separate.')
        for mid in missions:
            if mid in self.completed() or s['plans'][mid]['authority'] or any(j.get('mission')==mid for j in s['jobs']) or s['flight'] and s['flight']['mission']==mid:raise RuleError('A selected mission is already completed, authorised or in work. Amend its existing mandate instead.')
        quotes={mid:self.quote_mandate(mid) for mid in missions}
        claimed=set();technical={}
        for mid in missions:
            technical[mid]=self.quote_technical(mid,claimed);claimed.update(technical[mid]['projects'])
        if sum(q['prepare']+q['execute'] for q in quotes.values())>self.available('operations') or sum(q['review'] for q in quotes.values())+sum(q['readiness'] for q in technical.values())>self.available('readiness') or sum(q['engineering'] for q in technical.values())>self.available('engineering'):raise RuleError('The selected campaign exceeds uncommitted programme funds. Select fewer missions, defer commitments or explicitly release available reserve. No funding has been committed.')
        for mid in missions:
            p=s['plans'][mid];p['manager']=manager
            self.reserve_technical(mid,technical[mid])
            for stage,cost in quotes[mid].items():
                if cost:self._money('readiness' if stage=='review' else 'operations',cost,MISSIONS[mid]['name']+' / delegated '+stage,'commit');p['obligations'][stage]=cost
            p['authority']=self.event('mandate',MISSIONS[mid]['name']+' delegated',PEOPLE[manager]['name']+' is authorised to arrange scoped procurement, engineering investigation, component and integration testing, corrective work, preparation, independent review and execution within the recorded account allowances. Shared work is funded once; the teams choose technical packages from observed evidence. Flight permission still requires evidence and dependencies; changes and overruns return to the Administrator.',mission=mid)
            self.remember(manager,p['authority'])
        self.dispatch()

    def amend_mission(self,mission):
        self._active();m=self.definition(mission);p=self.state['plans'][m['id']]
        if not p['authority'] or (not p['held'] and p['technical_enabled']) or mission in self.completed():raise RuleError('Only an existing held mandate needs amendment.')
        if self.state['standdown']:raise RuleError('Complete the accident investigation before renewing mission authority.')
        extension=not p['technical_enabled'] and not p['held']
        if not extension and any(j.get('mission')==mission or j.get('sponsor')==mission for j in self.state['jobs']) or self.state['flight'] and self.state['flight']['mission']==mission:raise RuleError('Let the already committed mission work finish before amending its scope.')
        quote=self.quote_mandate(mission);technical=self.quote_technical(mission)
        if quote['prepare']+quote['execute']>self.available('operations') or quote['review']+technical['readiness']>self.available('readiness') or technical['engineering']>self.available('engineering'):raise RuleError('There are insufficient uncommitted funds for this amendment. Retained execution and review commitments are not charged again.')
        self.reserve_technical(mission,technical)
        for stage,cost in quote.items():
            if cost:self._money('readiness' if stage=='review' else 'operations',cost,m['name']+' / mandate amendment '+stage,'commit');p['obligations'][stage]=cost
        if p['prepared']!=self.fingerprint(mission):p['prepared']=None;p['clearance']=None
        p['authority']=self.event('mandate',m['name']+' mandate amended','Renewed authority uses the current configuration. Completed preparation is paid history; remaining commitments are retained. Additional work is explicitly funded.',links=[p['authority']],mission=mission)
        p['held']=False;p['issue']='';self.dispatch();self.sync_focus()

    def defer_mission(self,mission):
        self._active();m=self.definition(mission);p=self.state['plans'][mission]
        if not p['authority'] or p['held'] or mission in self.completed() or self.state['flight'] and self.state['flight']['mission']==mission:raise RuleError('Choose an active, unflown mandate to defer.')
        p['held']=True;p['issue']='Deferred by the Administrator. Already contracted work finishes; remaining obligations stay reserved.'
        self.event('decision',m['name']+' deferred',p['issue'],links=[p['authority']],mission=mission)

    def hold_plan(self,mission,reason,cause=None):
        p=self.state['plans'][mission]
        if not p['authority'] or p['held'] or mission in self.completed():return
        p['held']=True;p['issue']=reason
        e=self.event('escalation',MISSIONS[mission]['name']+' / authority exception',reason+' The manager has held further execution. Review the resource or scope exception and explicitly amend the mandate; the technical team selects the work.',PEOPLE[p['manager']]['name'],[p['authority']]+([cause] if cause else []),mission=mission)
        self.state['schedule_pauses'].append(e)

    def invalidate_plans(self,component,cause):
        for mid,m in MISSIONS.items():
            if component not in m['requires'] or mid in self.completed():continue
            p=self.state['plans'][mid]
            if p['prepared'] and p['prepared']!=self.fingerprint(mid):
                if p['authority']:self.hold_plan(mid,'A shared hardware revision changed after preparation. Re-preparation and independent disposition may need additional funds.',cause)
                else:p['prepared']=None;p['clearance']=None
        self.sync_focus()

    def preparation_blocks(self,mission):
        m=self.definition(mission);s=self.state;blocks=[]
        if s['standdown']:blocks.append('Accident standdown: investigation required.')
        for key in m['requires']:
            if s['hardware'][key]['status']!='developed':blocks.append('Await delivery: '+self.project_name(key)+'.')
            elif any(j['component']==key and j['kind'] in ('develop','redesign','rework') for j in s['jobs']):blocks.append('Await current configuration work: '+self.project_name(key)+'.')
        return blocks

    def dispatch(self):
        s=self.state
        if s['status']!='active' or s['standdown'] or s['schedule_pauses']:return
        for mid,m in sorted(MISSIONS.items(),key=lambda item:s['plans'][item[0]]['authority'] or 'Z'):
            if s['schedule_pauses']:break
            p=s['plans'][mid]
            if not p['authority'] or p['held'] or mid in self.completed() or s['flight'] and s['flight']['mission']==mid or any(j.get('mission')==mid for j in s['jobs']):continue
            if p['technical_enabled']:
                if not self.plan_technical(mid):continue
            finding=next((key for key in m['requires'] if self.findings(key)),None)
            if finding:
                self.hold_plan(mid,'An observed qualification excursion on '+self.project_name(finding)+' is outside the delegated readiness boundary.',self.findings(finding)[0]['event']);continue
            if p['prepared'] is not None and p['prepared']!=self.fingerprint(mid):self.hold_plan(mid,'The prepared configuration no longer matches current hardware.');continue
            if not p['prepared']:
                if not self.preparation_blocks(mid) and sum(j['kind']=='prepare' for j in s['jobs'])<SCHEDULE['preparation_teams']:
                    self.start_mission_job('prepare',mid,delegated=True)
            elif not p['clearance']:
                if not self.blocks(False,False,mid,ignore_active=True) and not any(j['lead']=='ortiz' for j in s['jobs']):self.start_mission_job('review',mid,delegated=True)
            elif not s['flight'] and not self.blocks(mission=mid):self.launch(mid)
        self.sync_focus()

    def start_mission_job(self,kind,mission,delegated=False):
        m=self.definition(mission);s=self.state;p=s['plans'][mission]
        if mission in self.completed():raise RuleError('This milestone is already complete.')
        if any(j.get('mission')==mission for j in s['jobs']):raise RuleError('This dossier already has a mission work package in progress.')
        if s['flight'] and s['flight']['mission']==mission:raise RuleError('This mission is already operating.')
        if p['held']:raise RuleError('Amend the held mandate before new mission work.')
        if kind=='prepare':
            if p['prepared']==self.fingerprint(mission):raise RuleError('This configuration is already prepared.')
            blocks=self.preparation_blocks(mission)
            if sum(j['kind']=='prepare' for j in s['jobs'])>=SCHEDULE['preparation_teams']:blocks.append('All mission preparation teams are occupied.')
            lead=p['manager'];days=m['prepare_days'];account='operations';title=m['name']+' / vehicle assembly and crew/test preparation'
        else:
            blocks=self.blocks(include_clearance=False,mission=mission,ignore_active=True)
            if p['clearance']==self.fingerprint(mission):blocks.append('Independent review is already complete.')
            if any(j['lead']=='ortiz' for j in s['jobs']):blocks.append('Independent assurance is already committed to a review or investigation.')
            lead='ortiz';days=14;account='readiness';title=m['name']+' / independent readiness review'
        if blocks:raise RuleError(' '.join(blocks))
        cost=self.costs(mission)[kind]
        if p['authority']:
            if p['obligations'][kind]!=cost:raise RuleError('The existing mandate does not fund this work; amend it first.')
        else:self._money(account,cost,title,'commit')
        e=self.event('mission_work',title+' started','The responsible team is executing '+str(days)+' days of authorised work. '+('This draws on the existing mandate, not a second charge.' if p['authority'] else 'The fixed-price package is committed.'),PEOPLE[lead]['name'],[p['authority']] if p['authority'] else [],mission=mission)
        s['jobs'].append({'id':e,'kind':kind,'component':None,'design':None,'lead':lead,'due':s['time']+days*DAY,'cost':cost,'account':account,'title':title,'seed':0,'revision':None,'fingerprint':self.fingerprint(mission),'mission':mission,'delegated':bool(p['authority'])})
        self.remember(lead,e);self.sync_focus()

    def project_name(self,key):
        from .campaign_catalog import PROJECTS
        return PROJECTS[key]['name']

    def mission_board(self):
        done=self.completed();s=self.state;board=[]
        for mid,m in MISSIONS.items():
            p=s['plans'][mid];active=next((j for j in s['jobs'] if j.get('mission')==mid),None)
            blockers=self.blocks(mission=mid,ignore_active=True)
            if mid in done:status='Completed'
            elif s['flight'] and s['flight']['mission']==mid:status='In operations'
            elif p['held']:status='Executive hold'
            elif active:status='Preparing' if active['kind']=='prepare' else 'Independent review'
            elif any(j.get('sponsor')==mid for j in s['jobs']):status='Engineering team at work'
            elif not p['authority']:status='Not delegated'
            elif p['prepared'] and p['clearance']:status='Awaiting shared operations slot'
            elif p['prepared']:status='Awaiting readiness evidence'
            elif self.preparation_blocks(mid):status='Awaiting hardware'
            else:status='Awaiting preparation team'
            board.append({'id':mid,'name':m['name'],'vehicle':m['vehicle'],'crew':m['crew'],'ground':m.get('ground',False),'objective':m['objective'],'reference':m['reference'],'requires':m['requires'],'prepare_days':m['prepare_days'],
                          'dependencies':SCHEDULE['dependencies'][mid],'status':status,'manager':p['manager'],'authority':p['authority'],'held':p['held'],'issue':p['issue'],'prepared':p['prepared']==self.fingerprint(mid),'clearance':p['clearance']==self.fingerprint(mid),
                          'technical_enabled':p['technical_enabled'],'technical':deepcopy(p['technical']),'technical_accounts':self.technical_accounts(mid),'technical_authorised':deepcopy(p['technical_authorised']),'technical_claims':list(p['technical_claims']),'technical_quote':self.quote_technical(mid),'obligations':deepcopy(p['obligations']),'quote':self.quote_mandate(mid),'blocks':blockers,'preparation_blocks':self.preparation_blocks(mid),'mass':self.mass(mid),'job':deepcopy(active)})
        return board
