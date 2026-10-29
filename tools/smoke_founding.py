"""Exercise the separate chapter's real HTTP/save lifecycle, including frozen entry."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parent.parent


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--exe');args=parser.parse_args()
    command=[str(Path(args.exe).resolve())] if args.exe else [sys.executable,'-m','per_aspera','--founding']
    (ROOT/'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as folder:
        data=Path(folder);saves=data/'saves';saves.mkdir()
        sentinel=saves/'apollo-1961-preserved.json';sentinel.write_text('{"untouched":"Apollo sentinel"}',encoding='utf-8')
        pointer=saves/'current-apollo-campaign.txt';pointer.write_text(sentinel.name)
        before=hashlib.sha256(sentinel.read_bytes()+pointer.read_bytes()).hexdigest()
        child=subprocess.Popen(command+['--fresh','--no-browser','--data-dir',str(data)],cwd=ROOT)
        try:
            deadline=time.monotonic()+60
            while not (data/'founding-server.json').exists():
                if child.poll() is not None:raise AssertionError('Opening application exited before serving the UI.')
                if time.monotonic()>deadline:raise AssertionError('Opening server did not start within 60 seconds.')
                time.sleep(.1)
            assert not (data/'server.json').exists()
            url='http://127.0.0.1:'+str(json.loads((data/'founding-server.json').read_text())['port'])
            with urllib.request.urlopen(url) as response:html=response.read().decode()
            assert 'People & organisation' in html and '__WORKSPACE_STYLES__' not in html
            token=re.search("const TOKEN='([^']+)'",html).group(1)
            def get(route):
                with urllib.request.urlopen(url+route) as response:return json.load(response)
            def call(action,**params):
                request=urllib.request.Request(url+'/api/command',data=json.dumps({'action':action,**params}).encode(),headers={'Content-Type':'application/json','Origin':url,'X-Per-Aspera':token})
                with urllib.request.urlopen(request) as response:return json.load(response)
            initial=get('/api/state');assert initial['campaign']=='nasa_1958' and initial['time']==0
            assert all('skills' not in p for p in initial['candidates'])
            try:urllib.request.urlopen(urllib.request.Request(url+'/api/command',data=b'{"action":"next"}'))
            except urllib.error.HTTPError as error:assert error.code==403
            else:raise AssertionError('Cross-origin command accepted.')
            call('appoint',person='bennett');call('appoint',person='hayes');current=call('next')
            assert current['appointments']['programme']=='bennett' and current['appointments']['spacecraft']=='hayes'
            call('charter',domain='spacecraft',amount=50000000);current=call('delegate',domain='spacecraft',mode='bounded')
            assert current['research'][1]['mode']=='bounded'
            before_command=current
            try:call('load',name=sentinel.name)
            except urllib.error.HTTPError as error:assert error.code==400
            else:raise AssertionError('Opening accepted an Apollo save.')
            after_command=get('/api/state')
            assert after_command['campaign']=='nasa_1958' and after_command['funds']==before_command['funds'] and after_command['jobs']==before_command['jobs']
            assert call('save')['save_name'].startswith('nasa-1958-')
            handoff=get('/api/handoff');assert handoff['merge_implemented'] is False and 'rng' not in handoff
            assert hashlib.sha256(sentinel.read_bytes()+pointer.read_bytes()).hexdigest()==before
            assert call('shutdown')['stopped'];child.wait(timeout=30);assert child.returncode==0
            assert (saves/'current-founding.txt').exists()
        finally:
            if child.poll() is None:child.terminate();child.wait(timeout=15)
    print('PASS: separate 1958 startup, assets, recruitment, research, delegation, handoff, save/shutdown and Apollo isolation')


if __name__=='__main__':main()
