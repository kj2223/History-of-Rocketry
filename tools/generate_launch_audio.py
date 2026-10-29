"""Recreate the small synthesized launch cues; no historical recordings."""
from pathlib import Path
import math
import random
import struct
import wave


def generate(destination):
    destination.mkdir(parents=True,exist_ok=True)
    rate=22050
    for name in ('ignition','ascent','staging','insertion'):
        rng=random.Random(1969)
        samples=[]
        low=0.0
        duration=2 if name!='insertion' else 1.5
        count=int(duration*rate)
        for i in range(count):
            t=i/rate
            low=.96*low+.04*rng.uniform(-1,1)
            if name=='insertion':
                value=.13*math.sin(2*math.pi*(440 if t<.4 else 660)*t)*max(0,1-t/duration)
            else:
                value=(.7*low+.06*math.sin(2*math.pi*48*t))*(.7 if name=='ignition' else 1)
                if name=='staging':value*=.55+.4*math.sin(2*math.pi*2*t)
                value*=min(1,t/.04,(duration-t)/.04)
            samples.append(struct.pack('<h',int(max(-1,min(1,value))*32767)))
        with wave.open(str(destination/(name+'.wav')),'wb') as output:
            output.setnchannels(1);output.setsampwidth(2);output.setframerate(rate)
            output.writeframes(b''.join(samples))


if __name__=='__main__':
    generate(Path(__file__).resolve().parents[1]/'per_aspera'/'data'/'audio')
