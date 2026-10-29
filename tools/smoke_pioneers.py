"""Exercise the real 1945 HTTP lifecycle, also against the frozen executable."""
import argparse
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
    command=[str(Path(args.exe).resolve())] if args.exe else [sys.executable,'-m','per_aspera','--pioneers']
    with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as folder:
        data=Path(folder);saves=data/'saves';saves.mkdir()
        sentinel=saves/'current-founding.txt';sentinel.write_text('unchanged-1958-save.json')
        child=subprocess.Popen(command+['--fresh','--no-browser','--data-dir',str(data)],cwd=ROOT)
        try:
            deadline=time.monotonic()+60
            while not (data/'pioneers-server.json').exists():
                if child.poll() is not None:raise AssertionError('1945 application exited before serving.')
                if time.monotonic()>deadline:raise AssertionError('1945 application did not start.')
                time.sleep(.1)
            url='http://127.0.0.1:'+str(json.loads((data/'pioneers-server.json').read_text())['port'])
            with urllib.request.urlopen(url) as response:html=response.read().decode()
            assert '__WORKSPACE_STYLES__' not in html and 'Range observation' in html
            with urllib.request.urlopen(url+'/pioneers-observation.js') as response:assert b'PioneerObservation' in response.read()
            token=re.search("const TOKEN='([^']+)'",html).group(1)
            def call(action,**params):
                request=urllib.request.Request(url+'/api/command',data=json.dumps({'action':action,**params}).encode(),headers={'Content-Type':'application/json','Origin':url,'X-Per-Aspera':token})
                with urllib.request.urlopen(request) as response:return json.load(response)
            try:urllib.request.urlopen(urllib.request.Request(url+'/api/command',data=b'{"action":"next"}'))
            except urllib.error.HTTPError as error:assert error.code==403
            else:raise AssertionError('Untrusted command accepted.')
            s=call('authorise',profile='booster',focus='measurement',count=1,delegated=True)
            paid=s['funds']['committed'];s=call('next');assert s['flight'] and s['running']
            s=call('pause');assert not s['running']
            for _ in range(15):
                if s['attention']:s=call('acknowledge')
                elif s['flight']:s=call('next')
                else:break
            assert len(s['flights'])==1 and s['funds']['paid']==paid
            assert 'reality' not in json.dumps(s) and 'rng' not in json.dumps(s)
            s=call('brief',question='observations');assert s['events'][-1]['kind']=='briefing'
            try:call('load',name='nasa-1958-foreign.json')
            except urllib.error.HTTPError as error:assert error.code==400
            else:raise AssertionError('1945 accepted a different scenario.')
            old=s['save_name'];s=call('fresh',seed=7);assert s['seed']==7 and (saves/old).exists()
            assert sentinel.read_text()=='unchanged-1958-save.json'
            assert call('shutdown')['stopped'];child.wait(timeout=30);assert child.returncode==0
            assert (saves/'current-pioneers.txt').exists()
        finally:
            if child.poll() is None:child.terminate();child.wait(timeout=15)
    print('PASS: 1945 HTTP security, preparation, flight, pause, report, briefing, fresh save and scenario isolation')


if __name__=='__main__':main()
