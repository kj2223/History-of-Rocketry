"""Run with python -m per_aspera; no installation or external services required."""
import argparse
import json
from pathlib import Path

from .engine import Simulation, RuleError
from .persistence import load, save, SaveError


def main():
    parser = argparse.ArgumentParser(description="Per Aspera — Apollo campaign and separate 1958–1961 NASA-formation prototype")
    parser.add_argument("--seed", type=int, default=11, help="Deterministic scenario seed (default: 11)")
    parser.add_argument("--load", metavar="FILE", help="Resume a validated JSON campaign")
    parser.add_argument("--demo", action="store_true", help="Run a headless example policy and print its public mission record")
    parser.add_argument("--save", metavar="FILE", help="Write the resulting campaign snapshot")
    parser.add_argument("--legacy",action="store_true",help="Open the preserved Apollo 9–11 Tkinter scenario")
    parser.add_argument("--fresh",action="store_true",help="Start a separate May 1961 campaign save")
    parser.add_argument("--campaign-demo",action="store_true",help="Run a complete headless 1961–1969 campaign")
    parser.add_argument("--founding",action="store_true",help="Open the separate NASA formation prototype, 1958–1961")
    parser.add_argument("--founding-demo",action="store_true",help="Run a headless example of the separate 1958–1961 chapter")
    parser.add_argument("--port",type=int,default=0,help="Local modern-UI port (default: an available port)")
    parser.add_argument("--no-browser",action="store_true",help="Print the modern game URL without opening the browser")
    parser.add_argument("--data-dir",metavar="DIRECTORY",help="Use a separate writable campaign directory")
    parser.add_argument("--installed",action="store_true",help="Store installed-game saves in LocalAppData/PerAspera")
    from .version import VERSION
    parser.add_argument("--version",action="version",version=VERSION)
    args = parser.parse_args()
    from .runtime import configure
    configure(args.data_dir,args.installed)
    if args.fresh and (args.load or args.legacy or args.demo):parser.error('--fresh starts a new modern campaign; do not combine it with --load, --legacy or --demo')
    if not 0<=args.port<=65535:parser.error('Choose a port from 0 to 65535')
    if (args.founding or args.founding_demo) and (args.legacy or args.demo or args.campaign_demo):parser.error('The 1958 prototype is separate from the Apollo and legacy scenarios.')
    try:
        loaded_kind=json.loads(Path(args.load).read_text(encoding='utf-8')).get('campaign') if args.load else None
        legacy_load=bool(args.load and loaded_kind not in ('apollo_1961','nasa_1958'))
        if args.founding or args.founding_demo or loaded_kind=='nasa_1958':
            if args.legacy or args.demo or args.campaign_demo:parser.error('Use the opening-chapter flags with a 1958 save.')
            if args.founding_demo and args.load:parser.error('--founding-demo starts a seeded example; omit --load.')
            if args.load and loaded_kind!='nasa_1958':parser.error('Select a 1958 opening save; Apollo saves use a different simulation.')
            from .founding import Founding,load as load_founding,save as save_founding,demonstrate as founding_demo
            if args.founding_demo:
                sim=founding_demo(args.seed)
                if args.save:save_founding(sim.state,args.save)
                print(json.dumps(sim.handoff(),indent=2));return
            if not (args.fresh or args.load or args.save or args.no_browser):
                from .runtime import open_existing
                if open_existing('nasa_1958','founding-server.json'):return
            from .founding_server import run as run_founding,fresh_path as fresh_founding,SAVES
            path=Path(args.save) if args.save else Path(args.load) if args.load else fresh_founding() if args.fresh else None
            pointer=SAVES/'current-founding.txt'
            if path is None and pointer.exists():
                name=pointer.read_text(encoding='utf-8').strip()
                if Path(name).name==name and name.startswith('nasa-1958-') and name.endswith('.json'):path=SAVES/name
            if path is None:path=fresh_founding()
            if args.fresh and path.exists():parser.error('A fresh opening chapter must use a new save path.')
            sim=Founding.new(args.seed) if args.fresh or not path.exists() else Founding(load_founding(path))
            if args.load and args.save and not args.fresh:sim=Founding(load_founding(args.load))
            run_founding(sim,path,port=args.port,open_browser=not args.no_browser)
        elif args.campaign_demo:
            from .campaign import demonstrate,save as save_campaign
            sim=demonstrate(args.seed)
            if args.save:save_campaign(sim.state,args.save)
            print(json.dumps({'date':sim.date(),'status':sim.state['status'],'results':sim.state['results'],'funds':sim.briefing()['funds']},indent=2))
        elif args.demo:
            if args.load:
                parser.error("--demo starts a fresh seeded example; omit --load")
            from .demo import demonstrate
            sim = demonstrate(args.seed)
            if args.save:
                save(sim.state, args.save)
            public = sim.briefing()
            print(json.dumps({key: public[key] for key in ("seed", "date", "stage", "budget", "results")}, indent=2))
        elif args.legacy or legacy_load:
            sim = Simulation(load(args.load)) if args.load else Simulation.new(args.seed)
            if args.save:
                save(sim.state, args.save)
            from .ui import run
            run(sim)
        else:
            if not (args.fresh or args.load or args.save or args.no_browser):
                from .runtime import open_existing
                if open_existing():return
            from .campaign import Campaign,load as load_campaign
            from .campaign_server import run,SAVES,fresh_path
            pointer=SAVES/'current-apollo-campaign.txt'
            path=Path(args.save) if args.save else Path(args.load) if args.load else fresh_path() if args.fresh else None
            if path is None and pointer.exists():
                name=pointer.read_text(encoding='utf-8').strip()
                if Path(name).name==name and name.startswith('apollo-1961-') and name.endswith('.json'):path=SAVES/name
            if path is None:path=fresh_path()
            if args.fresh and path.exists():parser.error('A fresh campaign must use a new save path; the existing file was not changed.')
            sim=Campaign.new(args.seed) if args.fresh or not path.exists() else Campaign(load_campaign(path))
            if args.load and args.save and not args.fresh:sim=Campaign(load_campaign(args.load))
            run(sim,path,port=args.port,open_browser=not args.no_browser)
    except (RuleError, SaveError, OSError, ValueError, AttributeError) as error:
        import sys
        if getattr(sys,'frozen',False):
            import ctypes
            ctypes.windll.user32.MessageBoxW(None,str(error),'Per Aspera',0x10)
        parser.exit(1, f"Per Aspera: {error}\n")


if __name__ == "__main__":
    main()
