"""Build the self-contained portable executable and per-user Windows installer."""
from pathlib import Path
import os
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
from per_aspera.version import VERSION


def main():
    if os.name!='nt':raise SystemExit('Build Windows releases on Windows.')
    for name,entry in (('PerAspera-Portable','desktop_entry.py'),('PerAspera-1958-Portable','desktop_founding_entry.py')):
        command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onefile','--windowed','--name',name]
        for folder in ('data','campaign_data','web'):
            command+=['--add-data',str(ROOT/'per_aspera'/folder)+';per_aspera/'+folder]
        subprocess.run(command+[str(ROOT/entry)],cwd=ROOT,check=True)
    compiler=shutil.which('ISCC.exe') or str(Path(os.environ.get('ProgramFiles(x86)','C:/Program Files (x86)'))/'Inno Setup 6'/'ISCC.exe')
    if not Path(compiler).exists():raise SystemExit('Install Inno Setup 6 before building the installer.')
    subprocess.run([compiler,'/DReleaseVersion='+VERSION,str(ROOT/'packaging'/'per-aspera.iss')],cwd=ROOT,check=True)


if __name__=='__main__':main()
