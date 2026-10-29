"""Optional local launch sound; presentation never advances the simulation."""
from .definitions import DATA

try:
    import winsound
except ImportError:
    winsound=None


class LaunchAudio:
    def __init__(self,backend=winsound):
        self.backend=backend
        self.current=None

    def sync(self,public,running,location,enabled):
        flight=public['flight']
        cue=None
        if enabled and running and location in ('lcc','mcc') and flight and flight.get('second_clock') and flight['operations']!='Return contingency active':
            t=flight['launch']['met_seconds']
            if -8<=t<0:cue='ignition'
            elif 0<=t<699:cue='staging' if 162<=t<177 or 549<=t<564 else 'ascent'
            elif 709<=t<740:cue='insertion'
        if cue==self.current:return
        self.current=cue
        if self.backend is None:return
        try:
            if cue is None:self.backend.PlaySound(None,0)
            else:
                flags=self.backend.SND_FILENAME|self.backend.SND_ASYNC|self.backend.SND_NODEFAULT
                if cue!='insertion':flags|=self.backend.SND_LOOP
                self.backend.PlaySound(str(DATA/'audio'/f'{cue}.wav'),flags)
        except (OSError,RuntimeError):
            self.current=None
            self.backend=None

    def stop(self):
        if self.backend and self.current:
            try:self.backend.PlaySound(None,0)
            except (OSError,RuntimeError):pass
        self.current=None
