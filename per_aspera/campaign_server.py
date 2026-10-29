"""Loopback-only modern UI adapter. Campaign rules remain in campaign.py."""
from copy import deepcopy
from datetime import datetime
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import secrets
from pathlib import Path
import threading
import time
import webbrowser
from contextlib import contextmanager
import os

from .campaign import Campaign,save,load,DAY
from .engine import RuleError
from .persistence import SaveError
from .pacing import LAUNCH_RATES
from .runtime import data_root
from .version import VERSION

ROOT=data_root()
SAVES=ROOT/'saves'


def fresh_path():
    return SAVES/('apollo-1961-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json')


@contextmanager
def campaign_lease(path):
    """One modern writer per project; OS releases the lease after a crash."""
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    stream=path.open('a+b')
    if stream.tell()==0:stream.write(b'0');stream.flush()
    stream.seek(0)
    try:
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
    except OSError as error:
        stream.close();raise RuleError('A modern campaign is already running. Use its Save & settings page for a fresh save, or close its server before starting another.') from error
    try:yield
    finally:stream.close()


class Controller:
    def __init__(self,sim,path):
        self.sim=sim;self.path=Path(path);self.lock=threading.RLock();self.running=False;self.speed=1.;self.location='lcc'
        self.last=time.monotonic();self.fraction=0.;self.last_save=0.;self.pending=list(sim.state['schedule_pauses']);self.seen=set(e['id'] for e in sim.state['events']);self.error=''
        self.token=secrets.token_urlsafe(32)
        if sim.state['flight'] and sim.state['flight']['aborted']:self.pending=[next((e['id'] for e in reversed(sim.state['events']) if e['kind'] in ('interruption','escalation')),sim.state['flight']['cause'])]

    def persist(self):
        save(self.sim.state,self.path)
        if self.path.parent.resolve()==SAVES.resolve():
            (SAVES/'current-apollo-campaign.txt').write_text(self.path.name,encoding='utf-8')
        self.last_save=time.monotonic()

    def public(self):
        public=self.sim.briefing()
        public.update(version_label=VERSION,running=self.running,speed=self.speed,location=self.location,pending=list(self.pending),save_name=self.path.name,error=self.error)
        public['saves']=[p.name for p in sorted(SAVES.glob('apollo-1961-*.json'),key=lambda p:p.stat().st_mtime,reverse=True) if not p.name.endswith(('.v1-backup.json','.v2-backup.json'))][:30]
        return public

    def rate(self):
        f=self.sim.state['flight']
        if not f:return 86400
        phase=self.sim.mission['phases'][f['phase']][0].lower();elapsed=self.sim.state['time']-f['start']
        if phase=='ascent' and elapsed<3600:return 3600/next((rate for end,rate in LAUNCH_RATES if elapsed<end),4)
        if 'coast' in phase:return 1800
        if 'checkout' in phase:return 120 if self.sim.state['time']-f['phase_start']<7200 else 1125
        return 120

    def ingest(self,before):
        events=self.sim.state['events'][before:]
        for e in events:
            if e['kind'] in ('interruption','escalation') and e['id'] not in self.pending:self.pending.append(e['id'])
        if self.pending or self.sim.state['status']=='complete' or self.sim.next_time() is None or any(e['kind'] in ('outcome','report') and not e.get('routine') for e in events):self.running=False
        if events:self.persist()

    def tick(self):
        now=time.monotonic();elapsed=min(1,max(0,now-self.last));self.last=now
        if not self.running or self.pending :return
        self.fraction+=elapsed*self.rate()*self.speed
        seconds=int(self.fraction)
        if seconds:
            self.fraction-=seconds;before=len(self.sim.state['events'])
            self.sim.advance(seconds,True);self.ingest(before)
            if now-self.last_save>=5:self.persist()

    def command(self,body):
        action=body.get('action');s=self.sim.state
        if action=='tick':self.tick();return
        if action=='pause':self.running=False;self.persist();return
        if action=='run':
            if self.pending:raise RuleError('Inspect and acknowledge the current operational report before resuming.')
            if not self.sim.next_time():raise RuleError('No work is scheduled. Authorise work or inspect mission dependencies before running time.')
            self.running=True;self.last=time.monotonic();return
        if action=='location':
            if body.get('location') not in ('office','lcc','mcc','recovery'):raise RuleError('Choose an observation location.')
            self.location=body['location'];return
        if action=='speed':
            value=body.get('value')
            if type(value) not in (float,int) or value not in (.5,1,2,4,8):raise RuleError('Choose a supported observation speed.')
            self.speed=float(value);return
        if action=='acknowledge':
            if self.pending:
                event=self.pending.pop(0)
                if event in s['schedule_pauses']:s['schedule_pauses'].remove(event)
                self.persist()
            self.running=False;return
        if action=='brief':
            self.running=False;self.sim.controller_briefing(body.get('question'));self.persist();return
        if action=='save':self.persist();return
        if action=='load':
            name=body.get('name','')
            if not isinstance(name,str) or Path(name).name!=name or not name.startswith('apollo-1961-') or not name.endswith('.json') or name.endswith(('.v1-backup.json','.v2-backup.json')):raise RuleError('Choose a listed campaign save; migration backups are kept read-only by the interface.')
            candidate=Campaign(load(SAVES/name));self.persist();self.sim=candidate;self.path=SAVES/name;self.running=False;self.pending=list(candidate.state['schedule_pauses']);self.fraction=0.;self.persist();return
        if action=='fresh':
            self.persist();candidate=Campaign.new(body.get('seed',s['seed']));self.sim=candidate;self.path=fresh_path();self.pending=[];self.running=False;self.fraction=0.;self.persist();return
        if self.pending:raise RuleError('A paused operational report needs acknowledgement before programme time or new commitments can proceed.')
        before=len(s['events'])
        actions={
            'commission':lambda:self.sim.commission(body.get('kind'),body.get('component'),body.get('design'),body.get('mission')),
            'assign':lambda:self.sim.assign(body.get('component'),body.get('lead')),
            'endorse':lambda:self.sim.endorse(body.get('architecture','lor')),
            'next':self.sim.next_report,
            'launch':lambda:self.sim.launch(body.get('mission')),
            'authorise_missions':lambda:self.sim.authorise_missions(body.get('missions'),body.get('manager','bennett')),
            'amend_mission':lambda:self.sim.amend_mission(body.get('mission')),
            'defer_mission':lambda:self.sim.defer_mission(body.get('mission')),
            'reserve':lambda:self.sim.release_reserve(body.get('account'),body.get('amount'),body.get('rationale')),
            'theory':lambda:self.sim.record_theory(body.get('text'))}
        if action not in actions:raise RuleError('Unknown campaign command.')
        actions[action]();self.ingest(before)
        if action=='launch' and not self.pending:self.running=True;self.last=time.monotonic();self.fraction=0.;self.location='lcc'
        self.persist()


def _run(sim,path,port=0,open_browser=True,controller=None,html_path=None,metadata_name='server.json'):
    controller=controller or Controller(sim,path);controller.persist()
    web=Path(__file__).with_name('web')
    html=(Path(html_path) if html_path else web/'index.html').read_text(encoding='utf-8').replace('__CAMPAIGN_TOKEN__',controller.token)
    if '__WORKSPACE_STYLES__' in html:
        import re
        styles='\n'.join(re.findall(r'<style>(.*?)</style>',(web/'index.html').read_text(encoding='utf-8'),re.S))
        html=html.replace('__WORKSPACE_STYLES__',styles)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def send(self,status,payload,kind='application/json; charset=utf-8'):
            content=payload.encode('utf-8') if isinstance(payload,str) else json.dumps(payload,allow_nan=False).encode('utf-8')
            self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Frame-Options','DENY');self.end_headers();self.wfile.write(content)
        def do_GET(self):
            if self.headers.get('Host')!='127.0.0.1:'+str(self.server.server_port):self.send(403,{'error':'Use the local game address.'});return
            if self.path=='/':self.send(200,html,'text/html; charset=utf-8')
            elif self.path=='/pioneers-observation.js':self.send(200,(web/'pioneers-observation.js').read_text(encoding='utf-8'),'text/javascript; charset=utf-8')
            elif self.path=='/api/state':
                with controller.lock:self.send(200,controller.public())
            elif self.path=='/api/export':
                with controller.lock:self.send(200,controller.sim.briefing())
            elif self.path=='/api/handoff' and hasattr(controller.sim,'handoff'):
                with controller.lock:self.send(200,controller.sim.handoff())
            else:self.send(404,{'error':'Not found.'})
        def do_POST(self):
            origin='http://127.0.0.1:'+str(self.server.server_port)
            if self.path!='/api/command' or self.headers.get('Origin')!=origin or self.headers.get('X-Per-Aspera')!=controller.token:
                self.send(403,{'error':'Local campaign commands require the game’s own page.'});return
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=65536:raise RuleError('Invalid command size.')
                body=json.loads(self.rfile.read(length))
                if not isinstance(body,dict):raise RuleError('Invalid campaign command.')
                with controller.lock:
                    if body.get('action')=='shutdown':
                        controller.running=False;controller.persist()
                        self.send(200,{**controller.public(),'stopped':True})
                        threading.Thread(target=self.server.shutdown,daemon=True).start();return
                    snapshot=deepcopy(controller.sim.state)
                    presentation=(controller.path,list(controller.pending),controller.fraction)
                    try:controller.command(body);controller.error=''
                    except (RuleError,SaveError,OSError,ValueError,TypeError,KeyError) as error:
                        controller.sim=type(controller.sim)(snapshot);controller.running=False;controller.error=str(error)
                        controller.path,controller.pending,controller.fraction=presentation
                        self.send(400,controller.public());return
                    self.send(200,controller.public())
            except (ValueError,RuleError) as error:self.send(400,{'error':str(error)})
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    url='http://127.0.0.1:'+str(server.server_port)+'/'
    (ROOT/metadata_name).write_text(json.dumps({'port':server.server_port,'pid':os.getpid()}),encoding='utf-8')
    print('Per Aspera: '+url,flush=True)
    print('Campaign: '+str(path),flush=True)
    if open_browser:webbrowser.open(url)
    try:server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt:pass
    finally:
        with controller.lock:controller.running=False;controller.persist()
        server.server_close()
        (ROOT/metadata_name).unlink(missing_ok=True)


def run(sim,path,port=0,open_browser=True):
    with campaign_lease(SAVES/'modern-campaign.lock'):
        _run(sim,path,port,open_browser)
