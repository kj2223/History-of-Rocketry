"""Writable campaign storage is separate from bundled application resources."""
from pathlib import Path
import os
import sys

_root=None


def configure(path=None,installed=False):
    global _root
    if path:_root=Path(path).resolve()
    elif installed:_root=Path(os.environ.get('LOCALAPPDATA',Path.home()))/'PerAspera'
    elif getattr(sys,'frozen',False):_root=Path(sys.executable).resolve().parent/'PerAsperaData'
    else:_root=Path(__file__).resolve().parent.parent
    _root.mkdir(parents=True,exist_ok=True)
    if sys.stdout is None or sys.stderr is None:
        logs=_root/'logs';logs.mkdir(exist_ok=True)
        stream=(logs/'latest.log').open('a',encoding='utf-8',buffering=1)
        if sys.stdout is None:sys.stdout=stream
        if sys.stderr is None:sys.stderr=stream
    return _root


def data_root():return _root or Path(__file__).resolve().parent.parent


def open_existing():
    """A second ordinary launch reopens the existing local instance."""
    import json
    import urllib.request
    import webbrowser
    try:
        info=json.loads((data_root()/'server.json').read_text(encoding='utf-8'))
        port=info['port']
        if type(port) is not int or not 0<port<65536:return False
        url='http://127.0.0.1:'+str(port)+'/'
        with urllib.request.urlopen(url+'api/state',timeout=1) as response:state=json.load(response)
        if state.get('campaign')!='apollo_1961':return False
        webbrowser.open(url);return True
    except (OSError,ValueError,KeyError):return False
