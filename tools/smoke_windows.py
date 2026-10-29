"""Exercise actual bundled resources, local API, autosave and installer lifecycle."""
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


def exercise(command,data):
    child=subprocess.Popen(command+['--fresh','--no-browser','--data-dir',str(data)],cwd=ROOT)
    try:
        deadline=time.monotonic()+60
        while not (data/'server.json').exists():
            if child.poll() is not None:raise AssertionError('Game exited before starting the local server.')
            if time.monotonic()>deadline:raise AssertionError('Local game did not start within 60 seconds.')
            time.sleep(.1)
        port=json.loads((data/'server.json').read_text())['port'];url='http://127.0.0.1:'+str(port)
        with urllib.request.urlopen(url) as response:html=response.read().decode()
        assert 'Mission portfolio' in html
        token=re.search("const TOKEN='([^']+)'",html).group(1)
        def state():
            with urllib.request.urlopen(url+'/api/state') as response:return json.load(response)
        def command_api(action,**params):
            request=urllib.request.Request(url+'/api/command',data=json.dumps({'action':action,**params}).encode(),headers={'Content-Type':'application/json','Origin':url,'X-Per-Aspera':token})
            with urllib.request.urlopen(request) as response:return json.load(response)
        first=state();assert first['time']==0 and len(first['mission_board'])==9
        try:
            urllib.request.urlopen(urllib.request.Request(url+'/api/command',data=b'{"action":"next"}'))
        except urllib.error.HTTPError as error:assert error.code==403
        else:raise AssertionError('Unauthorised command accepted.')
        command_api('commission',kind='study');paid=command_api('next')
        assert paid['study'] and paid['funds']['engineering']['paid']==12000000
        command_api('endorse');delegated=command_api('authorise_missions',missions=['apollo4','apollo5','apollo6'],manager='hayes')
        assert sum(bool(m['authority']) for m in delegated['mission_board'])==3
        assert delegated['funds']['operations']['committed']==480000000
        assert all('faults' not in p for p in delegated['projects'])
        command_api('save');assert list((data/'saves').glob('apollo-1961-*.json'))
        assert command_api('shutdown')['stopped'];child.wait(timeout=30)
        assert child.returncode==0
    finally:
        if child.poll() is None:child.terminate();child.wait(timeout=15)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--exe');parser.add_argument('--installer');args=parser.parse_args()
    (ROOT/'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as folder:
        base=Path(folder);command=[str(Path(args.exe).resolve())] if args.exe else [sys.executable,'-m','per_aspera']
        exercise(command,base/'portable-data')
        if args.installer:
            target=base/'installed'
            subprocess.run([str(Path(args.installer).resolve()),'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/DIR='+str(target)],check=True,timeout=120)
            assert (target/'PerAspera.exe').exists()
            exercise([str(target/'PerAspera.exe'),'--installed'],base/'installed-data')
            subprocess.run([str(target/'unins000.exe'),'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART'],check=True,timeout=120)
            assert list((base/'installed-data'/'saves').glob('apollo-1961-*.json'))
    print('PASS: startup, bundled UI/catalogues, command security, delegation, funding, autosave, shutdown'+(', install and uninstall with saves retained' if args.installer else ''))


if __name__=='__main__':main()
