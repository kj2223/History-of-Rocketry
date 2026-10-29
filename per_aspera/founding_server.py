"""Presentation adapter for the independent NASA-formation chapter."""
from datetime import datetime
from pathlib import Path
import secrets
import threading
import time

from .campaign_server import ROOT,SAVES,campaign_lease,_run
from .founding import Founding,save,load,DAY
from .engine import RuleError
from .version import VERSION


def fresh_path():return SAVES/('nasa-1958-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')


class FoundingController:
    def __init__(self,sim,path):
        self.sim=sim;self.path=Path(path);self.lock=threading.RLock();self.token=secrets.token_urlsafe(32);self.running=False;self.speed=1;self.last=time.monotonic();self.fraction=0.;self.last_save=0.;self.error=''

    @property
    def pending(self):return self.sim.state['attention']
    @pending.setter
    def pending(self,value):self.sim.state['attention']=list(value)

    def persist(self):
        save(self.sim.state,self.path)
        if self.path.parent.resolve()==SAVES.resolve():(SAVES/'current-founding.txt').write_text(self.path.name,encoding='utf-8')
        self.last_save=time.monotonic()

    def public(self):
        return self.sim.public()|{'running':self.running,'speed':self.speed,'error':self.error,'save_name':self.path.name,'version_label':VERSION,
                                 'saves':[p.name for p in sorted(SAVES.glob('nasa-1958-*.json'),key=lambda p:p.stat().st_mtime,reverse=True)][:30]}

    def tick(self):
        now=time.monotonic();elapsed=min(1,max(0,now-self.last));self.last=now
        if not self.running or self.pending or self.sim.state['status']=='complete':return
        self.fraction+=elapsed*DAY*self.speed;seconds=int(self.fraction)
        if seconds:
            self.fraction-=seconds;before=len(self.sim.state['events']);self.sim.advance(seconds)
            if self.pending or self.sim.state['status']=='complete':self.running=False
            if len(self.sim.state['events'])!=before or now-self.last_save>=5:self.persist()

    def command(self,body):
        action=body.get('action')
        if action=='tick':self.tick();return
        if action=='pause':self.running=False;self.persist();return
        if action=='run':
            self.sim.active()
            if self.pending:raise RuleError('Read and acknowledge the current report before running time.')
            self.running=True;self.last=time.monotonic();return
        if action=='speed':
            speed=body.get('value')
            if type(speed) not in (int,float) or speed not in (.5,1,4,16):raise RuleError('Choose a supported presentation speed.')
            self.speed=speed;return
        if action=='save':self.persist();return
        if action=='fresh':
            candidate=Founding.new(body.get('seed',self.sim.state['seed']));self.persist();self.sim=candidate;self.path=fresh_path();self.running=False;self.fraction=0.;self.persist();return
        if action=='load':
            name=body.get('name')
            if not isinstance(name,str) or Path(name).name!=name or not name.startswith('nasa-1958-') or not name.endswith('.json'):raise RuleError('Choose a listed 1958 opening save. Apollo saves are separate.')
            candidate=Founding(load(SAVES/name));self.persist();self.sim=candidate;self.path=SAVES/name;self.running=False;self.fraction=0.;self.persist();return
        actions={'acknowledge':self.sim.acknowledge,'next':self.sim.next_report,'assess':lambda:self.sim.assess(body.get('person')),'appoint':lambda:self.sim.appoint(body.get('person')),
                 'expand':self.sim.expand,'charter':lambda:self.sim.authorise(body.get('domain'),body.get('amount')),'topup':lambda:self.sim.top_up(body.get('domain'),body.get('amount')),
                 'delegate':lambda:self.sim.delegate(body.get('domain'),body.get('mode')),'continue':lambda:self.sim.continue_research(body.get('domain')),
                 'defer':lambda:self.sim.defer(body.get('domain')),'reserve':lambda:self.sim.reserve(body.get('account'),body.get('amount'),body.get('reason')),
                 'theory':lambda:self.sim.interpretation(body.get('text'))}
        if action not in actions:raise RuleError('Unknown opening-chapter command.')
        actions[action]()
        if action=='acknowledge':self.sim.dispatch()
        if self.pending or self.sim.state['status']=='complete':self.running=False
        self.persist()


def run(sim,path,port=0,open_browser=True):
    with campaign_lease(SAVES/'founding-1958.lock'):
        _run(sim,path,port,open_browser,controller=FoundingController(sim,path),html_path=Path(__file__).with_name('web')/'founding.html',metadata_name='founding-server.json')
