"""Local browser adapter; presentation speed never samples flight outcomes."""
from datetime import datetime
from pathlib import Path
import time

from .campaign_server import SAVES,campaign_lease,_run
from .founding_server import FoundingController
from .pioneers import Pioneers,save,load,DAY
from .engine import RuleError
from .version import VERSION


def fresh_path():return SAVES/('pioneers-1945-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')


class PioneersController(FoundingController):
    def persist(self):
        save(self.sim.state,self.path)
        if self.path.parent.resolve()==SAVES.resolve():(SAVES/'current-pioneers.txt').write_text(self.path.name,encoding='utf-8')
        self.last_save=time.monotonic()

    def public(self):
        return self.sim.public()|{'running':self.running,'speed':self.speed,'error':self.error,'save_name':self.path.name,'version_label':VERSION,
                                 'display_rate':((1 if self.sim.state['time']-self.sim.state['flight']['start']<20 else 6)*self.speed if self.sim.state['flight'] and self.running and not self.pending else 0),
                                 'saves':[p.name for p in sorted(SAVES.glob('pioneers-1945-*.json'),key=lambda p:p.stat().st_mtime,reverse=True)][:30]}

    def tick(self):
        now=time.monotonic();elapsed=min(1,max(0,now-self.last));self.last=now
        if not self.running or self.pending or self.sim.state['status']=='complete':return
        f=self.sim.state['flight'];rate=(1 if f and self.sim.state['time']-f['start']<20 else 6) if f else DAY
        self.fraction+=elapsed*rate*self.speed;seconds=int(self.fraction)
        if seconds:
            self.fraction-=seconds;before=len(self.sim.state['events'])
            # Stop at a preparation boundary so accelerated shop time cannot skip a launch.
            if not f:seconds=min(seconds,max(0,self.sim.next_time()-self.sim.state['time']))
            self.sim.advance(seconds)
            if self.pending or self.sim.state['status']=='complete':self.running=False;self.fraction=0
            if len(self.sim.state['events'])!=before or now-self.last_save>=5:self.persist()

    def command(self,body):
        action=body.get('action')
        if action=='tick':self.tick();return
        if action=='pause':self.running=False;self.persist();return
        if action=='run':
            self.sim.active()
            if self.pending:raise RuleError('Acknowledge the current report before resuming.')
            if not self.sim.state['flight'] and not self.sim.state['jobs']:raise RuleError('Authorise a flight remit, recruit staff, or choose the next opportunity first.')
            self.running=True;self.last=time.monotonic();return
        if action=='speed':
            value=body.get('value')
            if type(value) not in (int,float) or value not in (.5,1,4,16):raise RuleError('Choose a supported speed.')
            self.speed=value;return
        if action=='save':self.persist();return
        if action=='fresh':
            candidate=Pioneers.new(body.get('seed',self.sim.state['seed']));self.persist();self.sim=candidate;self.path=fresh_path();self.running=False;self.fraction=0;self.persist();return
        if action=='load':
            name=body.get('name')
            if not isinstance(name,str) or Path(name).name!=name or not name.startswith('pioneers-1945-') or not name.endswith('.json'):raise RuleError('Choose a listed 1945 save. Other prototypes are separate.')
            candidate=Pioneers(load(SAVES/name));self.persist();self.sim=candidate;self.path=SAVES/name;self.running=False;self.fraction=0;self.persist();return
        if self.pending and action not in ('acknowledge','theory','brief'):raise RuleError('Read and acknowledge the current report first.')
        actions={'acknowledge':self.sim.acknowledge,'next':self.sim.next_report,'opportunity':self.sim.opportunity,
                 'authorise':lambda:self.sim.authorise(body.get('profile'),body.get('focus','balanced'),body.get('count',1),body.get('delegated',True)),
                 'recruit':lambda:self.sim.recruit(body.get('person')),'launch':self.sim.launch,'release':self.sim.release,
                 'proposal':self.sim.proposal,'close':self.sim.close,'theory':lambda:self.sim.interpretation(body.get('text')),'brief':lambda:self.sim.brief(body.get('question'))}
        if action not in actions:raise RuleError('Unknown 1945 prototype command.')
        actions[action]()
        if self.pending or self.sim.state['status']=='complete':self.running=False
        if action=='launch' or (action=='next' and self.sim.state['flight'] and not self.pending):self.running=True;self.last=time.monotonic();self.fraction=0
        self.persist()


def run(sim,path,port=0,open_browser=True):
    with campaign_lease(SAVES/'pioneers-1945.lock'):
        _run(sim,path,port,open_browser,controller=PioneersController(sim,path),html_path=Path(__file__).with_name('web')/'pioneers.html',metadata_name='pioneers-server.json')
