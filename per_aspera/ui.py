"""A decision-first Administrator desktop; engineering detail is progressively disclosed."""
import json
import time
from pathlib import Path
from .runtime import data_root
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog

from .observation import Observation, LOCATIONS
from .pacing import MissionPacing
from .interruptions import Interruptions, step_observed, step_seconds_observed
from .mission_contact import DIALOGUE
from .watch_ui import MissionWatch
from .launch_audio import LaunchAudio
from .continuity import EXPERIENCE
from . import finance
from .definitions import SCENARIO, STAFF, DOMAINS
from .engine import Simulation, RuleError
from .persistence import load, save, SaveError
from .presentation import next_step, TEST_NAMES, QUESTIONS, HYPOTHESES, CHANNELS, minimum_remaining_cost

BG, PANEL, INK, MUTED, ACCENT, GOLD = "#e7e0d2", "#fffaf0", "#252b2b", "#555d59", "#294e49", "#745626"
PEOPLE = {item["id"]: item["name"] for item in STAFF}


class AdministratorApp:
    PAGES = ("Daily briefing", "Engineering dossier", "Briefing room", "Personnel", "Commission work", "Budget papers", "Mission archive", "Registry")

    def __init__(self, root, sim):
        self.root, self.sim = root, sim
        self.running = sim.state.stage == "flight"
        self.last_autosave=0.0
        self.launch_audio=LaunchAudio()
        self.audio_enabled=tk.BooleanVar(value=False)
        self.pacing = MissionPacing(time.monotonic())
        self.interruptions = Interruptions.for_campaign(sim.briefing())
        if self.interruptions.current:
            self.running=False
        self.frames = {}
        self.active_frame = None
        self.observation = Observation()
        self.page = "Daily briefing"
        self.investigation_tab = "Choose a test"
        self.method = "flow"
        self.selected_evidence = None
        self.selected_person = "bennett"
        self.save_path = data_root() / "saves" / "autosave.json"
        self.status = tk.StringVar(value="Mission in progress. Adaptive clock: critical activities slow down; routine operations accelerate." if self.running else "Start with the daily briefing. Nothing advances until you choose to wait or run the clock.")
        self.date = tk.StringVar()
        self.clock = tk.StringVar()
        self.theory = tk.StringVar(value=HYPOTHESES[sim.state.player_hypothesis])
        self.rationale = tk.StringVar(value=sim.state.player_rationale)
        self.lead = tk.StringVar(value=PEOPLE["hayes"])
        self.manager = tk.StringVar(value=PEOPLE["bennett"])
        self.component = tk.StringVar(value=SCENARIO["components"]["feed"]["name"])
        self.limit = tk.StringVar(value="250000")
        self.hours = tk.StringVar(value="72")
        self.query = tk.StringVar()
        self.fund_source = tk.StringVar(value="Administrator reserve")
        self.fund_destination = tk.StringVar(value=finance.LINES["engineering"][0])
        self.fund_amount = tk.StringVar(value="50000")
        self.fund_reason = tk.StringVar()
        self.speed = tk.StringVar(value="Auto")
        self.abort_rule = tk.BooleanVar(value=sim.state.rules["administrator_abort"])
        self._style()
        root.title("Per Aspera | Administrator's briefing")
        root.geometry("1240x820")
        root.minsize(1020, 680)
        root.configure(bg=BG)
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.bind("<MouseWheel>", self._scroll_document)
        menu = tk.Menu(root)
        file_menu = tk.Menu(menu, tearoff=False)
        for title, command in (("Save campaign…", self.save_as), ("Load campaign…", self.load_campaign), ("New campaign…", self.new_campaign), ("Export public record…", self.export_record)):
            file_menu.add_command(label=title, command=command)
        file_menu.add_separator()
        file_menu.add_command(label="Restart save…", command=self.restart_save)
        file_menu.add_command(label="Exit", command=self.close)
        menu.add_cascade(label="Campaign", menu=file_menu)
        file_menu.add_checkbutton(label="Alternate history: Administrator abort authority",variable=self.abort_rule,command=lambda: self.act(self.sim.set_administrator_abort_rule,self.abort_rule.get()))
        root.configure(menu=menu)
        header = ttk.Frame(root, padding=(24, 16))
        self.header=header
        header.pack(fill="x")
        ttk.Label(header, text="PER ASPERA", style="Brand.TLabel").pack(side="left")
        ttk.Label(header, text="ADMINISTRATOR’S OFFICE", style="Muted.TLabel").pack(side="left", padx=18)
        ttk.Label(header, textvariable=self.date, style="Gold.TLabel").pack(side="right")
        clock_menu = tk.Menu(menu, tearoff=False)
        clock_menu.add_command(label="Advance six hours", command=lambda: self.act(self.sim.advance, 6))
        clock_menu.add_command(label="Run / pause clock", command=self.toggle_clock)
        clock_menu.add_command(label="Inspect paused mission report",command=lambda: self.switch_location("mcc"))
        clock_menu.add_checkbutton(label="Synthesized launch audio",variable=self.audio_enabled,command=self.refresh)
        menu.add_cascade(label="Time", menu=clock_menu)
        file_menu.add_command(label="End programme…", command=self.end_programme)
        locations = ttk.Frame(root, padding=(24, 0, 24, 10))
        self.locations=locations
        locations.pack(fill="x")

        self.location_buttons = {}
        for key, title in LOCATIONS.items():
            button = ttk.Button(locations, text=title, style="Compact.TButton", command=lambda value=key: self.switch_location(value))
            button.pack(side="left", padx=(0, 7))
            self.location_buttons[key] = button
        ttk.Combobox(locations,textvariable=self.speed,values=("Auto","0.5×","2×","4×","8×"),state="readonly",width=6).pack(side="right",padx=8)
        ttk.Label(root, textvariable=self.clock, style="Muted.TLabel", padding=(24, 0, 24, 10)).pack(fill="x")
        ttk.Label(root, textvariable=self.status, style="Status.TLabel", padding=(24, 10), wraplength=1120).pack(side="bottom", fill="x")
        main = ttk.Frame(root, padding=(18, 4, 24, 16))
        main.pack(fill="both", expand=True)
        nav = ttk.Frame(main)
        self.nav=nav
        nav.pack(side="left", fill="y", padx=(0, 22))
        self.nav_buttons = {}
        for page in self.PAGES:
            button = ttk.Button(nav, text=page, width=23, command=lambda value=page: self.navigate(value))
            button.pack(fill="x", pady=(0, 7))
            self.nav_buttons[page] = button
        ttk.Label(nav, text="Apollo 9 → 10 → 11\nOne lunar programme", style="Muted.TLabel", justify="left").pack(side="bottom", anchor="w", pady=10)
        self.content = ttk.Frame(main)
        self.content.pack(side="left", fill="both", expand=True)
        self.refresh()
        root.after(50, self._clock_tick)

    def _style(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")
        style.configure(".", background=BG, foreground=INK, font=("Segoe UI", 12))
        style.configure("Compact.TButton",font=("Segoe UI",11),padding=(8,5))
        style.configure("Selected.Compact.TButton",background="#d3cbb9",font=("Segoe UI",11),padding=(8,5))
        style.layout("Launch.TNotebook.Tab",[])
        style.configure("LaunchVoice.TLabel",background=PANEL,foreground=INK,font=("Georgia",13))
        style.configure("RoomTitle.TLabel",font=("Georgia",18))
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=PANEL)
        style.configure("TLabel", background=BG, foreground=INK)
        style.configure("Card.TLabel", background=PANEL, foreground=INK, font=("Courier New", 12))
        style.configure("CardMuted.TLabel", background=PANEL, foreground=MUTED)
        style.configure("CardTitle.TLabel", background=PANEL, foreground=INK, font=("Georgia", 18))
        style.configure("Title.TLabel", font=("Georgia", 24))
        style.configure("Brand.TLabel", font=("Georgia", 20))
        style.configure("Muted.TLabel", foreground=MUTED)
        style.configure("Gold.TLabel", foreground=GOLD)
        style.configure("Status.TLabel", background=PANEL, foreground=MUTED)
        style.configure("TButton", background=PANEL, foreground=INK, padding=(12, 9), borderwidth=0)
        style.map("TButton", background=[("active", "#d3cbb9")], foreground=[("disabled", "#788b9b")])
        style.configure("Primary.TButton", background=ACCENT, foreground="#fffaf0", font=("Segoe UI Semibold", 11), padding=(16, 11))
        style.map("Primary.TButton", background=[("active", "#426c63")], foreground=[("disabled", "#526c75")])
        style.configure("Selected.TButton", background="#d3cbb9", foreground=INK)
        style.configure("TEntry", fieldbackground=PANEL, foreground=INK, insertcolor=INK, padding=6)
        style.configure("TCombobox", fieldbackground=PANEL, foreground=INK, background=PANEL, arrowcolor=ACCENT, padding=5)
        style.map("TCombobox", fieldbackground=[("readonly", PANEL)], foreground=[("readonly", INK)])
        style.configure("TNotebook", background=BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=PANEL, foreground=MUTED, padding=(12, 9))
        style.map("TNotebook.Tab", background=[("selected", "#d3cbb9")], foreground=[("selected", INK)])
        style.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=INK, rowheight=32, borderwidth=0)
        style.configure("Treeview.Heading", background=BG, foreground=MUTED, padding=6)
        style.map("Treeview", background=[("selected", "#d3cbb9")], foreground=[("selected", INK)])

    def label(self, parent, text, style="TLabel", pady=5):
        widget = ttk.Label(parent, text=text, style=style, justify="left", anchor="w", wraplength=650)
        widget.pack(fill="x", pady=pady)
        widget.bind("<Configure>", lambda event: widget.configure(wraplength=max(160, event.width - 8)))
        return widget

    def card(self, parent, title, detail=""):
        frame = ttk.Frame(parent, style="Card.TFrame", padding=18)
        frame.pack(fill="x", pady=(0, 12))
        self.label(frame, title, "CardTitle.TLabel", 0)
        if detail:
            self.label(frame, detail, "Card.TLabel", 9)
        return frame

    def button(self, parent, title, command, primary=False, enabled=True):
        button = ttk.Button(parent, text=title, command=command, style="Primary.TButton" if primary else "TButton", state="normal" if enabled else "disabled")
        button.pack(anchor="w", pady=(8, 2))
        return button

    def _scroll_document(self, event):
        if isinstance(event.widget, (tk.Text, ttk.Treeview)):
            return
        widget = event.widget
        while widget is not None:
            if isinstance(widget, tk.Canvas) and widget.cget("yscrollcommand"):
                widget.yview_scroll(-int(event.delta / 120), "units")
                return "break"
            widget = getattr(widget, "master", None)

    def scroll_area(self, parent):
        outer = ttk.Frame(parent)
        outer.pack(fill="both", expand=True)
        canvas = tk.Canvas(outer, bg=BG, highlightthickness=0)
        bar = ttk.Scrollbar(outer, command=canvas.yview)
        bar.pack(side="right", fill="y")
        canvas.configure(yscrollcommand=bar.set)
        canvas.pack(fill="both", expand=True, side="left")
        inner = ttk.Frame(canvas)
        window = canvas.create_window((0, 0), window=inner, anchor="nw")
        inner.bind("<Configure>", lambda event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window, width=event.width))
        return inner

    def detail_text(self, parent, text, height=12):
        frame = ttk.Frame(parent)
        frame.pack(fill="both", expand=True, pady=(8, 0))
        field = tk.Text(frame, bg=PANEL, fg=INK, wrap="word", relief="flat", height=height, padx=14, pady=12, font=("Segoe UI", 12), spacing3=8)
        bar = ttk.Scrollbar(frame, command=field.yview)
        bar.pack(side="right", fill="y")
        field.configure(yscrollcommand=bar.set)
        field.pack(fill="both", expand=True)
        field.insert("1.0", text)
        field.configure(state="disabled")

    def switch_location(self, location):
        self.observation.switch(location, self.sim.briefing())
        self.refresh()

    def navigate(self, page):
        self.observation.location = "office"
        if self.sim.state.stage != "flight":
            self.running = False
        self.page = page
        self.refresh(rebuild_office=True)

    def investigate(self, tab="Choose a test", method=None):
        self.investigation_tab = tab
        if method:
            self.method = method
        self.navigate("Engineering dossier")

    def act(self, command, *args):
        was_running = self.running
        stage = self.sim.state.stage
        self.running = False
        before = self.sim.state.sequence
        try:
            advancing=getattr(command,'__self__',None) is self.sim and getattr(command,'__name__','') in ('advance','advance_to_next')
            if advancing and self.interruptions.current:
                self.status.set('Inspect the paused report and explicitly resume before advancing.')
                self.inspect_interruption()
                return
            if advancing:
                hours=args[0] if command.__name__=='advance' else self.sim.hours_to_next_report()
                if command.__name__=='advance_to_next' and self.sim.state.flight and self.sim.state.flight.get('second_clock'):
                    step_seconds_observed(self.sim,hours*3600-self.sim.state.second,self.interruptions)
                else:
                    step_observed(self.sim,hours,self.interruptions)
            else:
                command(*args)
            self.running = self.sim.state.stage == "flight" and (was_running or stage != "flight")
            self.pacing.reset(time.monotonic())
            if stage!='flight' and self.sim.state.stage=='flight':
                self.observation.switch('lcc',self.sim.briefing())
            save(self.sim.state, self.save_path)
            events = [event for event in self.sim.state.events if int(event.id[1:]) > before]
            self.pacing.notify([vars(event) for event in events],time.monotonic())
            self.interruptions.ingest([{**vars(event),"date":self.sim.date(event.hour,event.second)} for event in events])
            if self.interruptions.current:
                self.running=False
            self.status.set("Launch authorised. Launch Control is conducting the terminal sequence." if stage!='flight' and self.sim.state.stage=='flight' else events[-1].title + ". Campaign saved." if events else "Time advanced. Campaign saved.")
            if any(event.kind == "evidence" for event in events):
                self.selected_evidence = self.sim.state.evidence[-1].id
        except (RuleError, SaveError, OSError, ValueError) as error:
            self.status.set(str(error))
            messagebox.showinfo("Action needs attention", str(error), parent=self.root)
        self.refresh(rebuild_office=True)

    def refresh(self, rebuild_office=False):
        self.view = self.sim.briefing()
        self.abort_rule.set(self.view["rules"]["administrator_abort"])
        self.date.set(f"{self.view['date']}  ·  Programme ${self.view['finances']['programme_available']:,}  /  Reserve ${self.view['finances']['reserve']:,}")
        self._clock_label()
        if hasattr(self,'nav'):
            observing=self.observation.location!='office'
            if observing:
                self.nav.pack_forget()
                self.header.pack_forget()
            else:
                if not self.header.winfo_manager():
                    self.header.pack(fill='x',before=self.locations)
                if not self.nav.winfo_manager():
                    self.nav.pack(side='left',fill='y',padx=(0,22),before=self.content)
        for key, button in self.location_buttons.items():
            button.configure(style="Selected.Compact.TButton" if key == self.observation.location else "Compact.TButton")
        for page, button in self.nav_buttons.items():
            button.configure(style="Selected.TButton" if self.page == page else "TButton")
        key = self.observation.location if self.observation.location != "office" else ("office",self.page)
        if self.active_frame is not None:
            if self.active_frame is not self.frames.get(key):
                self.active_frame.pack_forget()
        if rebuild_office and key in self.frames and self.observation.location == "office":
            self.frames.pop(key).destroy()
        if key not in self.frames:
            if self.observation.location != "office" or self.page == "Daily briefing" and self.view["flight"]:
                frame = MissionWatch(self.content,self)
            else:
                frame = ttk.Frame(self.content)
                self.label(frame,self.page,"Title.TLabel",0)
                self.label(frame,f"{self.view['mission']['name']} · {self.view['mission']['subtitle']}","Muted.TLabel",8)
                body=ttk.Frame(frame)
                body.pack(fill="both",expand=True,pady=(8,0))
                {"Daily briefing":self._briefing,"Engineering dossier":self._investigation,"Briefing room":self._review,"Personnel":self._team,"Commission work":self._delegation,"Registry":self._record,"Budget papers":self._budget,"Mission archive":self._mission_archive}[self.page](body)
            self.frames[key]=frame
        frame=self.frames[key]
        frame.pack(fill="both",expand=True)
        self.active_frame=frame
        if isinstance(frame,MissionWatch):
            report=self.observation.project(self.view)
            frame.update_report(self.view,report,self.pacing.progress if report['flight'] else 0)
        if hasattr(self,'launch_audio'):self._sync_launch_audio()

    def _draw_observation_board(self, canvas, report):
        location = self.observation.location
        if location == "lcc":
            canvas.create_line(40, 95, 600, 95, fill=MUTED, width=2)
            canvas.create_rectangle(95, 35, 113, 94, outline=INK, width=2)
            canvas.create_polygon(95, 35, 104, 16, 113, 35, outline=INK, fill=BG)
            canvas.create_line(70, 20, 70, 95, fill=MUTED, width=3)
            canvas.create_text(155, 45, anchor="w", text="LAUNCH STATUS BOARD", fill=INK, font=("Courier New", 12))
            canvas.create_text(155, 72, anchor="w", text="Awaiting authority" if not report["events"] else "Ascent" if report["flight"] and report["flight"]["phase"] == "Ascent" else "Launch in mission record", fill=ACCENT)
        elif location in ("mcc", "office"):
            labels = ("EARTH", "EARTH ORBIT", "RETURN") if report["mission"]["id"] == "apollo9" else ("EARTH", "LUNAR OPERATIONS", "RETURN")
            canvas.create_line(70, 50, 510, 50, fill=MUTED, width=2)
            for x, title in zip((70, 290, 510), labels):
                canvas.create_oval(x-10, 40, x+10, 60, outline=ACCENT, width=2)
                canvas.create_text(x, 85, text=title, fill=INK, font=("Courier New", 10))
            canvas.create_text(290, 18, text="SCHEMATIC / NO LIVE POSITION TELEMETRY", fill=MUTED)
        else:
            for y in (65, 80, 95):
                canvas.create_line(30, y, 600, y, fill=MUTED)
            result = report["result"]
            safe = report["outcome"] in ("objective_complete", "safe_return_objective_incomplete")
            canvas.create_text(300, 22, text="Recovery report received" if result else "Awaiting recovery report", fill=INK, font=("Courier New", 12))
            if safe:
                canvas.create_polygon(260, 55, 280, 35, 300, 55, outline=INK, fill=BG)
                canvas.create_text(445, 48, text="Return / retrieval recorded", fill=ACCENT)
            elif result:
                canvas.create_text(300, 46, text="Safe crew retrieval not confirmed", fill=INK)

    def _next_action(self, target):
        routes = {"interruption": self.inspect_interruption, "funding": lambda: self.navigate("Budget papers"), "tests": lambda: self.investigate(), "findings": lambda: self.investigate("Read findings"), "crew": lambda: self.investigate(method="crew"), "record": lambda: self.navigate("Registry"), "advance": lambda: self.act(self.sim.advance_to_next), "clearance": lambda: self.act(self.sim.request_clearance), "launch": lambda: self.act(self.sim.launch)}
        routes[target]()

    def _briefing(self, parent):
        body = self.scroll_area(parent)
        notice=self.interruptions.current
        if notice:
            report=self.card(body,'PAUSED REPORT / '+notice['title'],notice['actor']+': '+notice['detail'])
            self.label(report,'Read and acknowledge this report before waiting. Acknowledgement does not resolve a delegation issue, waive a safety finding or authorise additional work.','CardMuted.TLabel')
            self.button(report,'Acknowledge report',self.resume_interruption,primary=True)
            if notice['interruption']=='action_required':
                self.button(report,'Review the executive issue',self.executive_mission_action)
        title, detail, action, target = next_step(self.view)
        if notice:
            title,detail,action,target=('A report is holding the clock','Your authorised work remains queued. Acknowledge the report above, then wait for the next result.','Read paused report','interruption')
        if target in ("clearance", "launch"):
            cost, account = (30000, "readiness") if target == "clearance" else (100000, "operations")
            block = self.sim.funding_block(cost, account)
            if block:
                title, detail, action, target = "Funding decision required", block, "Open budget papers", "funding"
        if target == "advance" and not self.view["jobs"] and any("uncommitted; this action needs" in block for block in self.view["launch_blocks"]):
            title, detail, action, target = "Flight operations need funding", next(block for block in self.view["launch_blocks"] if "uncommitted; this action needs" in block), "Open budget papers", "funding"
        focus = self.card(body, "IN-TRAY  /  FOR YOUR ATTENTION\n" + title, detail)
        director = next(person for person in self.view["staff"] if person["id"] == "bennett")
        self.label(focus, "RESPONSIBLE / " + director["name"] + " · " + director["role"], "CardMuted.TLabel")
        self.button(focus, action, lambda: self._next_action(target), primary=True)
        if target == "tests":
            self.button(focus, "Or ask a manager to plan the tests", lambda: self.navigate("Commission work"))
        if self.view["jobs"]:
            work = self.card(body, "Assignments in progress")
            for job in self.view["jobs"]:
                name = TEST_NAMES.get(job["target"], "Readiness review" if job["kind"] == "clearance" else SCENARIO["components"].get(job["target"], {}).get("name", job["target"]))
                self.label(work, f"{name} — {job['hours_left']} h remaining\nResponsible: {job['lead']}", "Card.TLabel")
        for decision in self.view["decisions"]:
            if not decision["resolved"]:
                memo = self.card(body, "MEMORANDUM / Decision requested", decision["text"])
                self.button(memo, "Review the commission", lambda: self.navigate("Commission work"))
        reflections=[event for event in self.view['history'] if event['kind']=='continuity' and event['title'] in {item['title'] for item in EXPERIENCE['aftermath']}]
        if reflections and not (self.view['results'] and self.view['results'][-1]['outcome']=='crew_loss'):
            recent_mission=reflections[-1]['mission']
            memory=self.card(body,'FROM THE LAUNCH-DAY CONVERSATION / '+recent_mission.upper())
            event=next((item for item in reversed(reflections) if item['mission']==recent_mission and item['actor']=='Nora Bennett'),reflections[-1])
            self.label(memory,event['actor']+' / '+event['date']+'\n'+event['detail'],'Card.TLabel')
            self.button(memory,'Read the launch conversations',lambda:self.navigate('Mission archive'))
        recent = next((event for event in reversed(self.view["history"]) if event["kind"] in ("evidence", "outcome", "safety_finding", "clearance", "programme", "funding")), None)
        if recent:
            latest = self.card(body, "Latest memorandum", recent["title"])
            report = self.view["evidence"][-1] if recent["kind"] == "evidence" and self.view["evidence"] else None
            self.label(latest, (TEST_NAMES.get(report["method"], "Engineering report") + " · " + report["source"] + "\n" + report["caveat"]) if report else recent["detail"], "CardMuted.TLabel")
            self.button(latest, "Read findings", lambda: self.investigate("Read findings"))
        checklist = self.card(body, "Before this mission can fly")
        current = [item for item in self.view["evidence"] if item["revision"] == self.view["revision"] and item["mission"] == self.view["mission"]["id"]]
        for complete, title in ((any(item["method"] == "integration" for item in current), "Mission systems rehearsal"), (self.view["crew"] == "Contingency preparation documented", "Crew contingency preparation"), (bool(self.view["clearance"]), "Independent readiness clearance")):
            self.label(checklist, f"{'✓' if complete else '○'}  {title}", "Card.TLabel")
        self.label(checklist, "These are readiness requirements, not a score or a guarantee of safety.", "CardMuted.TLabel")
        trail = self.card(body, "Programme schedule")
        for item in SCENARIO["missions"]:
            done = any(result["mission"] == item["id"] and result["outcome"] == "objective_complete" for result in self.view["results"])
            self.label(trail, f"{'✓' if done else '→' if item['id'] == self.view['mission']['id'] else '·'}  {item['name']} — {item['subtitle']}", "Card.TLabel")

    def _investigation(self, parent):
        notebook = ttk.Notebook(parent)
        notebook.pack(fill="both", expand=True)
        tabs = {}
        for title in ("Choose a test", "Read findings", "Your assessment", "Hardware changes"):
            frame = ttk.Frame(notebook, padding=(12, 14))
            notebook.add(frame, text=title)
            tabs[title] = frame
        self._tests(tabs["Choose a test"])
        self._findings(tabs["Read findings"])
        self._assessment(tabs["Your assessment"])
        self._changes(tabs["Hardware changes"])
        notebook.select(tabs[self.investigation_tab])
        notebook.bind("<<NotebookTabChanged>>", lambda event: setattr(self, "investigation_tab", notebook.tab(notebook.select(), "text")))

    def _tests(self, parent):
        choices = ttk.Frame(parent)
        choices.pack(side="left", fill="y", padx=(0, 18))
        for key in SCENARIO["tests"]:
            self.button(choices, TEST_NAMES[key], lambda value=key: self.investigate(method=value), primary=key == self.method)
        detail = self.scroll_area(parent)
        definition = SCENARIO["tests"][self.method]
        card = self.card(detail, TEST_NAMES[self.method], QUESTIONS[self.method])
        self.label(card, f"${definition['cost']:,}    ·    {definition['hours']} hours    ·    One engineering team", "Card.TLabel")
        self.label(card, definition["description"], "CardMuted.TLabel")
        account = finance.line_for("test", self.method)
        current = [item for item in self.view["evidence"] if item["mission"] == self.view["mission"]["id"] and item["revision"] == self.view["revision"]]
        if self.method == "crew":
            classification = "OPTIONAL extra crew practice — readiness is already documented" if self.view["crew"] == "Contingency preparation documented" else "READINESS REQUIREMENT — crew contingency preparation"
        elif self.method == "integration":
            classification = "OPTIONAL repeat — current integration evidence is already recorded" if any(item["method"] == "integration" for item in current) else "READINESS REQUIREMENT — current mission/configuration integration"
        else:
            classification = "OPTIONAL diagnostic comparison — answer a specific question; repeats cost the full amount"
        self.funding_preview(detail, definition["cost"], account, classification)
        self.label(detail, "Who will be accountable for this test?", "Muted.TLabel")
        ttk.Combobox(detail, textvariable=self.lead, values=tuple(PEOPLE.values()), state="readonly").pack(fill="x", pady=(4, 12))
        lead_id = lambda: next(key for key, value in PEOPLE.items() if value == self.lead.get())
        self.button(detail, f"Authorise test · ${definition['cost']:,}", lambda: self.act(self.sim.order_test, self.method, lead_id()), primary=True, enabled=self.view["stage"] == "preparation" and not self.sim.funding_block(definition["cost"], account))
        self.label(detail, "After authorising, return to Daily briefing and choose Wait for next report. Authorising work does not advance the clock.", "Muted.TLabel", 16)

    def _findings(self, parent):
        parent = self.scroll_area(parent)
        for finding in self.view["findings"]:
            if finding["open"] and finding["revision"] == self.view["revision"]:
                memo = self.card(parent, "MISSION ASSURANCE / Clearance withheld", SCENARIO["components"][finding["component"]]["name"] + " exceeds the assessed operating envelope. Responsible: Dr Lila Ortiz. Evidence: " + ", ".join(finding["evidence"]))
                self.button(memo, "Consider a hardware change", lambda: self.investigate("Hardware changes"))
        evidence = list(reversed(self.view["evidence"]))
        tree = ttk.Treeview(parent, columns=("test", "scope"), show="headings", height=5, selectmode="browse")
        tree.heading("test", text="Report")
        tree.heading("scope", text="Applies to")
        tree.column("test", width=360)
        tree.column("scope", width=200)
        tree.pack(fill="x", pady=(0, 12))
        for item in evidence:
            current = item["revision"] == self.view["revision"] and item["mission"] == self.view["mission"]["id"]
            tree.insert("", "end", iid=item["id"], values=(TEST_NAMES.get(item["method"], item["method"]), "Current mission / hardware" if current else "Earlier mission / hardware"))
        details = ttk.Frame(parent)
        details.pack(fill="both", expand=True)

        def show(event=None):
            if not tree.selection():
                return
            self.selected_evidence = tree.selection()[0]
            item = next(item for item in evidence if item["id"] == self.selected_evidence)
            for child in details.winfo_children():
                child.destroy()
            self.label(details, TEST_NAMES.get(item["method"], item["method"]), "Title.TLabel")
            self.label(details, f"{item['date']} · {item['source']}", "Muted.TLabel")
            self.label(details, "What this report can tell you")
            self.label(details, item["caveat"], "Muted.TLabel")
            self.label(details, "OBSERVATIONS / Recorded evidence", "Gold.TLabel")
            self.label(details, " · ".join(f"{CHANNELS.get(channel, channel)}: {value:.3f}" for channel, value in item["observations"].items()), "Muted.TLabel")
            self.label(details, "Normalised instrument indices; these are not failure probabilities.", "Muted.TLabel")
            adviser = next(person for person in self.view["staff"] if person["id"] == "hayes")
            self.label(details, "STAFF ASSESSMENT / " + adviser["name"], "Gold.TLabel")
            self.label(details, adviser["interpretation"] + "\nRecommendation: " + adviser["recommendation"], "Muted.TLabel")
            self.button(details, "Discuss this report in the briefing room", lambda: self.navigate("Briefing room"))
            self.button(details, "Record my working assessment", lambda: self.investigate("Your assessment"))
            raw = "\n".join(f"{CHANNELS.get(channel, channel)}: {value:.3f}" for channel, value in item["observations"].items())
            more = ttk.Frame(details)
            def expand():
                if more.winfo_children():
                    for child in more.winfo_children():
                        child.destroy()
                else:
                    self.detail_text(more, f"Measured values (normalised indices, not failure probabilities)\n\n{raw}\n\nConditions: {item['conditions']}\nConfiguration: {item['revision']}\nRecord links: {item['id']} / {item['event']}", 6)
            self.button(details, "Show / hide measurements and provenance", expand)
            more.pack(fill="both", expand=True)
        tree.bind("<<TreeviewSelect>>", show)
        if evidence:
            selected = self.selected_evidence if self.selected_evidence in {item["id"] for item in evidence} else evidence[0]["id"]
            tree.selection_set(selected)
            show()

    def _assessment(self, parent):
        body = self.scroll_area(parent)
        self.card(body, "What do you think is happening?", "Keep a working explanation without treating it as a confirmed diagnosis. Staff may interpret the same report differently.")
        ttk.Combobox(body, textvariable=self.theory, values=tuple(HYPOTHESES.values()), state="readonly").pack(fill="x", pady=8)
        self.label(body, "Why? Optional note for the programme record.", "Muted.TLabel")
        ttk.Entry(body, textvariable=self.rationale).pack(fill="x", pady=(0, 10))
        self.button(body, "Record my assessment", lambda: self.act(self.sim.set_hypothesis, next(key for key, value in HYPOTHESES.items() if value == self.theory.get()), self.rationale.get()), primary=True, enabled=self.view["stage"] == "preparation")
        self.label(body, "Recording a theory does not alter the hardware or prove a cause. Use a comparison to test it.", "Muted.TLabel", 16)
        self.button(body, "Hear the team's interpretations", lambda: self.navigate("Personnel"))

    def _changes(self, parent):
        body = self.scroll_area(parent)
        self.card(body, "Change hardware only when you have a reason", "A modification costs money and time. It targets one mechanism; it does not resolve every concern. Integration evidence and readiness clearance must be renewed afterwards.")
        selected = ttk.Combobox(body, textvariable=self.component, values=tuple(item["name"] for item in SCENARIO["components"].values()), state="readonly")
        selected.pack(fill="x", pady=8)
        panel = ttk.Frame(body)
        panel.pack(fill="x")
        def show(event=None):
            for child in panel.winfo_children():
                child.destroy()
            key = next(key for key, value in SCENARIO["components"].items() if value["name"] == self.component.get())
            item = SCENARIO["components"][key]
            self.label(panel, f"${item['repair_cost']:,} · {item['repair_hours']} hours", "Gold.TLabel", 12)
            self.funding_preview(panel, item["repair_cost"], "engineering", "Additional work; may be needed to address an assurance finding. Allow at least another $120,000 for integration and independent review, plus crew preparation if required.")
            def confirm():
                if messagebox.askyesno("Authorise hardware change", f"Modify {item['name']} for ${item['repair_cost']:,}?\n\nThis takes {item['repair_hours']} hours and requires new integration evidence and clearance.", parent=self.root):
                    self.act(self.sim.repair, key)
            self.button(panel, "Authorise this change…", confirm, enabled=self.view["stage"] == "preparation" and not self.sim.funding_block(item["repair_cost"], "engineering"))
        selected.bind("<<ComboboxSelected>>", show)
        show()

    def _review(self, parent):
        body = self.scroll_area(parent)
        self.label(body, "This discussion has no financial fee and does not issue independent readiness clearance.", "Muted.TLabel")
        meeting = self.view["meeting"]
        if not meeting:
            card = self.card(body, "No review is in progress", "Bring the team together to discuss uncertainty and the next useful comparison.")
            self.button(card, "Convene engineering review", lambda: self.act(self.sim.open_review), primary=True, enabled=self.view["stage"] == "preparation")
            return
        card = self.card(body, "In the room", meeting["last"])
        self.label(card, meeting["cue"], "CardMuted.TLabel")
        for title, detail, action in (("Let the debate continue", "Give the engineers time to compare their claims.", "continue"), ("Take a short break", "Pause the discussion if fatigue may be getting in the way.", "break"), ("Invite a fresh perspective", "Ask an available outsider to listen and offer a question.", "outsider")):
            row = self.card(body, title, detail)
            self.button(row, title, lambda choice=action: self.act(self.sim.intervene, choice))
        more = ttk.Frame(body)
        def expand():
            if more.winfo_children():
                for child in more.winfo_children(): child.destroy()
                return
            for title, action in (("Ask what evidence would change minds", "evidence"), ("Step aside; ask the team to report back", "step_aside"), ("Insist on my interpretation", "insist")):
                self.button(more, title, lambda choice=action: self.act(self.sim.intervene, choice))
        self.button(body, "More ways to respond…", expand)
        more.pack(fill="x")
        self.button(body, "Hear each team member's view", lambda: self.navigate("Personnel"))

    def _team(self, parent):
        people = ttk.Frame(parent)
        people.pack(side="left", fill="y", padx=(0, 18))
        for person in self.view["staff"]:
            self.button(people, person["name"], lambda value=person["id"]: self._select_person(value))
        body = self.scroll_area(parent)
        person = next(person for person in self.view["staff"] if person["id"] == self.selected_person)
        self.card(body, person["name"], person["role"])
        self.card(body, "STAFF ASSESSMENT / Not a verified cause", person["interpretation"])
        self.card(body, "What they recommend", person["recommendation"])
        self.label(body, person["record"], "Muted.TLabel")
        if person["memories"]:
            records = {event["id"]: event for event in self.view["history"]}
            self.label(body, "Recent shared experience", "Gold.TLabel", 12)
            for key in person["memories"][-3:]: self.label(body, records[key]["title"], "Muted.TLabel")

    def _select_person(self, value):
        self.selected_person = value
        self.refresh(rebuild_office=True)

    def _delegation(self, parent):
        body = self.scroll_area(parent)
        self.card(body, "Let a manager plan the comparisons", "Set a spending limit and a time limit. The manager can order tests inside those limits and must ask you about exceptions. This does not delegate hardware changes or mission authorisation. The envelope is a spending ceiling, not another charge: each chosen test is obligated once from its own engineering or readiness account. Test durations and prices are in the engineering dossier; reserve is not released automatically.")
        contract = self.view["delegation"]
        if contract:
            self.card(body, f"Engineering dossier: {contract['status']}", f"{PEOPLE[contract['manager']]} · ${contract['remaining']:,} authority remaining\nDeadline: {self.sim.date(contract['deadline'])}")
        for decision in self.view["decisions"]:
            if not decision["resolved"]: self.card(body, "Your decision is needed", decision["text"])
        for title, variable, values in (("Responsible manager", self.manager, tuple(value for key, value in PEOPLE.items() if key != "ortiz")), ("Maximum test spend ($)", self.limit, None), ("Maximum elapsed hours", self.hours, None)):
            self.label(body, title, "Muted.TLabel")
            if values: ttk.Combobox(body, textvariable=variable, values=values, state="readonly").pack(fill="x", pady=(0, 8))
            else: ttk.Entry(body, textvariable=variable).pack(fill="x", pady=(0, 8))
        self.button(body, "Authorise investigation within these limits", self.authorise_delegation, primary=True, enabled=self.view["stage"] == "preparation")

    def authorise_delegation(self):
        try:
            budget, hours = int(self.limit.get()), int(self.hours.get())
        except ValueError:
            messagebox.showinfo("Check the limits", "Enter whole numbers for dollars and hours.", parent=self.root)
            return
        manager = next(key for key, value in PEOPLE.items() if value == self.manager.get())
        self.act(self.sim.delegate, manager, budget, hours)

    def _mission_archive(self,parent):
        self.label(parent,'MISSION TRANSCRIPTS / Controller communications and structured exchanges','Title.TLabel')
        self.detail_text(parent,'\n\n'.join(f"{entry['date']} / {entry['mission']} / {entry['speaker']}\n{entry['text']}\nSources: {', '.join(entry['links']) or 'No recorded source available'}" for entry in self.view['transcript']) or 'No mission transcript entries yet.',18)

    def _record(self, parent):
        search = ttk.Frame(parent)
        search.pack(fill="x", pady=(0, 12))
        ttk.Entry(search, textvariable=self.query).pack(side="left", fill="x", expand=True)
        ttk.Button(search, text="Search record", command=lambda: self.refresh(rebuild_office=True)).pack(side="left", padx=8)
        events = [event for event in reversed(self.view["history"]) if self.query.get().lower() in (event["title"] + event["detail"] + event["id"] + event["actor"]).lower()]
        tree = ttk.Treeview(parent, columns=("date", "title"), show="headings", height=7, selectmode="browse")
        tree.heading("date", text="Date")
        tree.heading("title", text="Recorded event")
        tree.column("date", width=170, stretch=False)
        tree.column("title", width=480)
        tree.pack(fill="x")
        for event in events: tree.insert("", "end", iid=event["id"], values=(event["date"], event["title"]))
        detail = ttk.Frame(parent)
        detail.pack(fill="both", expand=True)
        def show(event=None):
            if not tree.selection(): return
            item = next(item for item in events if item["id"] == tree.selection()[0])
            for child in detail.winfo_children(): child.destroy()
            self.detail_text(detail, f"{item['title']}\n{item['actor']} · {item['mission']}\n\n{item['detail']}\n\nRecord: {item['id']} · Configuration {item['revision']}\nLinked records: {', '.join(item['links']) or 'none'}", 8)
        tree.bind("<<TreeviewSelect>>", show)
        if events:
            tree.selection_set(events[0]["id"])
            show()

    def funding_preview(self, parent, cost, account, classification):
        line = self.view["finances"]["lines"][account]
        self.label(parent, classification, "Muted.TLabel")
        self.label(parent, f"Funding: {line['name']} · ${line['available']:,} uncommitted before this action. The Administrator reserve is not charged automatically.", "Muted.TLabel")
        block = self.sim.funding_block(cost, account)
        if block:
            self.label(parent, block, "Gold.TLabel")
            self.button(parent, "Review funding alternatives", lambda: self.navigate("Budget papers"))

    def _budget(self, parent):
        body = self.scroll_area(parent)
        f = self.view["finances"]
        self.card(body, f"BUDGET OFFICE / Fiscal year {f['fiscal_year']}", f"Scenario R&D appropriation: ${f['appropriated']:,}. Lunar programme allocated: ${f['programme_allocation']:,}. Administrator reserve: ${f['reserve']:,}. This is a small illustrative envelope, not NASA's whole budget.")
        self.label(body, "Authorised work is fully committed at approval and settles on completion without another deduction. Zero reserve does not stop funded programme work. No payroll or passive drain is charged.", "Muted.TLabel")
        minimum = minimum_remaining_cost(self.view)
        self.label(body, f"Remaining Apollo 9–11 readiness and flight floor: at least ${minimum:,} still to authorise. Total uncommitted programme + reserve: ${self.view['budget']:,}. This excludes additional diagnosis, rework, repeats and failed missions; account limits still apply.", "Gold.TLabel")
        for line in f["lines"].values():
            self.card(body, line["name"], f"Allocated ${line['allocation']:,}  ·  Committed ${line['committed']:,}\nExpended ${line['expended']:,}  ·  Uncommitted ${line['available']:,}")
        if f["migrated"]:
            self.label(body, "Existing campaign migrated without restoring spent funds. Historic charges are reconstructed from authorisation records; historical account totals use the current purpose categories; past allocation decisions were not recorded. The cash balance is preserved exactly.", "Muted.TLabel")
        paper = self.card(body, "REALLOCATION MEMORANDUM", "Reassign only uncommitted R&D funds. Deferring unstarted work frees its planned allocation, not money already obligated. Moving readiness or operations funds may prevent a later mission; no contract cancellation refund is assumed.")
        names = {key: value[0] for key, value in finance.LINES.items()}
        self.label(paper, "From", "CardMuted.TLabel")
        ttk.Combobox(paper, textvariable=self.fund_source, values=("Administrator reserve", *names.values()), state="readonly").pack(fill="x", pady=5)
        self.label(paper, "To programme account", "CardMuted.TLabel")
        ttk.Combobox(paper, textvariable=self.fund_destination, values=tuple(names.values()), state="readonly").pack(fill="x", pady=5)
        self.label(paper, "Amount ($)", "CardMuted.TLabel")
        ttk.Entry(paper, textvariable=self.fund_amount).pack(fill="x", pady=5)
        self.label(paper, "Reason / work deferred or revised", "CardMuted.TLabel")
        ttk.Entry(paper, textvariable=self.fund_reason).pack(fill="x", pady=5)
        self.button(paper, "Authorise this reallocation", self.reallocate_funds, enabled=self.view["stage"] == "preparation")
        self.label(paper, "If no affordable scope or lawful reallocation remains, defer the work or end the programme. Safety clearance is never waived. Supplemental requests can be recorded but are not adjudicated in this prototype and provide no spendable funds.", "CardMuted.TLabel", 12)
        self.button(paper, "Record supplemental funding request", self.funding_request, enabled=self.view["stage"] == "preparation")
        for request in f["requests"]:
            self.label(body, f"REQUEST / ${request['amount']:,} for {names[request['line']]} · {request['status']} · No new authority granted", "Muted.TLabel")
        self.label(body, "TRANSACTION REGISTER", "Title.TLabel", 12)
        self.label(body, "An obligation reduces available funds once. Reallocations move existing authority and do not change the total balance. Full commitment settlement is shown in the account totals above.", "Muted.TLabel")
        for item in reversed(f["transactions"]):
            heading = ("OBLIGATED" if item["kind"] == "obligation" else "REALLOCATED") + f" ${item['amount']:,} · {item['date']}"
            self.card(body, heading, f"{item['purpose']}\n{item['programme']} / {names[item['account']]}\nTotal uncommitted after entry: ${item['remaining']:,}" + (f" · Account available: ${item['account_remaining']:,}" if item['account_remaining'] is not None else ""))
        if not f["transactions"]:
            self.label(body, "No expenditure has been authorised.", "Muted.TLabel")

    def _funding_form(self):
        try:
            amount = int(self.fund_amount.get())
        except ValueError:
            messagebox.showinfo("Check the amount", "Enter a whole-dollar amount.", parent=self.root)
            return None
        names = {key: value[0] for key, value in finance.LINES.items()}
        destination = next(key for key, name in names.items() if name == self.fund_destination.get())
        source = next((key for key, name in names.items() if name == self.fund_source.get()), "reserve")
        return source, destination, amount, self.fund_reason.get()

    def reallocate_funds(self):
        values = self._funding_form()
        if values:
            self.act(self.sim.reallocate, *values)

    def funding_request(self):
        values = self._funding_form()
        if values:
            _, destination, amount, reason = values
            self.act(self.sim.request_funding, destination, amount, reason)

    def end_programme(self):
        reason = simpledialog.askstring("End programme", "Record your reason for ending the programme. This closes the campaign.", parent=self.root)
        if reason:
            self.act(self.sim.cancel, reason)

    def export_record(self):
        path = filedialog.asksaveasfilename(parent=self.root, title="Export public agency record", defaultextension=".json", filetypes=[("JSON record", "*.json")])
        if path:
            try:
                Path(path).write_text(json.dumps(self.sim.briefing(), ensure_ascii=False, indent=2), encoding="utf-8")
                self.status.set("Public programme record exported.")
            except OSError as error: messagebox.showerror("Export failed", str(error), parent=self.root)

    def _speed_value(self):
        return 1.0 if self.speed.get()=="Auto" else float(self.speed.get().replace("×",""))

    def _clock_label(self):
        if self.interruptions.current:
            event=self.interruptions.current
            text=f"PAUSED / {event['interruption'].replace('_',' ').upper()} / {event['title']} · Time → Inspect paused mission report"
        elif self.running and self.sim.state.stage == "flight":
            flight=self.view['flight']
            now=time.monotonic()
            rate=self.pacing.rate(flight,now,self._speed_value())
            alert=(" · ATTENTION: "+self.pacing.alert) if now<self.pacing.alert_until else ""
            text=f"{flight['phase']} · {rate:g} real s / mission h · {self.speed.get()}{alert}"
        else:
            text="Time running · 6 h/s; pauses at ground reports" if self.running else "Clock paused · saved mission clock retained"
        flight=self.view.get('flight')
        if flight and flight.get('second_clock'):
            elapsed=flight['launch']['met_seconds']
            h,rest=divmod(abs(elapsed),3600);m,second=divmod(rest,60)
            text=f"T{'−' if elapsed<0 else '+'}{h:03}:{m:02}:{second:02} · "+text
        if self.clock.get()!=text:
            self.clock.set(text)

    def toggle_clock(self):
        if self.interruptions.current:
            self.resume_interruption()
            return
        self.running = not self.running and self.sim.state.stage != "closed"
        self.pacing.last=time.monotonic()
        self.refresh()

    def _sync_launch_audio(self):
        self.launch_audio.sync(self.view,self.running,self.observation.location,self.audio_enabled.get())

    def _clock_tick(self):
        if hasattr(self,'launch_audio'):self._sync_launch_audio()
        stage=self.sim.state.stage
        now=time.monotonic()
        hours=self.pacing.tick(now,self.running,self.view['flight'],self._speed_value())
        if hours:
            before=self.sim.state.sequence
            try:
                precise=bool(self.view['flight'] and self.view['flight'].get('second_clock'))
                events=step_seconds_observed(self.sim,hours,self.interruptions) if precise else step_observed(self.sim,hours,self.interruptions)
                self.pacing.notify(events,now)
                reports=[event for event in events if event['kind'] in ('evidence','training','configuration','clearance','safety_finding','outcome','escalation')]
                if self.interruptions.current or self.sim.state.stage!=stage or stage!='flight' and reports:
                    self.running=False
                    self.status.set('New report received. Time paused so you can consider it.')
                elif events:
                    self.status.set(events[-1]['title']+'. Shared clock continues.')
                if not precise or events or now-self.last_autosave>=5:
                    save(self.sim.state,self.save_path)
                    self.last_autosave=now
                if stage=='flight' and self.sim.state.stage!='flight':
                    old=self.frames.pop(('office','Daily briefing'),None)
                    if old:
                        if old is self.active_frame:
                            self.active_frame=None
                        old.destroy()
                self.refresh(rebuild_office=stage!='flight')
            except (RuleError,SaveError,OSError) as error:
                self.running=False
                self.status.set(str(error))
                self.refresh()
        else:
            self._clock_label()
            if isinstance(self.active_frame,MissionWatch):
                report=self.observation.project(self.view)
                self.active_frame.update_report(self.view,report,self.pacing.progress if report['flight'] else 0)
        self.root.after(50,self._clock_tick)

    def inspect_interruption(self):
        if self.sim.state.stage=='flight':
            self.switch_location('mcc')
        else:
            self.navigate('Daily briefing')

    def resume_interruption(self):
        self.interruptions.acknowledge()
        self.running=not self.interruptions.current and self.sim.state.stage=='flight'
        self.pacing.last=time.monotonic()
        self.refresh(rebuild_office=self.observation.location=='office' and self.sim.state.stage!='flight')

    def ask_controller(self,question,contact,mission_id):
        self.running=False
        self.pacing.last=time.monotonic()
        try:
            text=self.sim.request_mission_briefing(question,contact,mission_id)
            save(self.sim.state,self.save_path)
            self.status.set('Controller briefing added to the persistent mission transcript. Resume when ready.')
            self.show_controller_briefing(DIALOGUE['contacts'][contact]['name'],text)
        except (RuleError,SaveError,OSError) as error:
            messagebox.showinfo('Briefing unavailable',str(error),parent=self.root)
        self.refresh()

    def show_controller_briefing(self,speaker,text):
        if not hasattr(self,'briefing_window') or not self.briefing_window.winfo_exists():
            self.briefing_window=tk.Toplevel(self.root)
            self.briefing_window.geometry('820x540')
            self.briefing_window.configure(bg=BG)
            self.briefing_window.protocol('WM_DELETE_WINDOW',self.briefing_window.withdraw)
            frame=ttk.Frame(self.briefing_window,padding=20)
            frame.pack(fill='both',expand=True)
            self.briefing_heading=self.label(frame,'','Title.TLabel')
            self.briefing_text=tk.Text(frame,wrap='word',font=('Courier New',12),bg=PANEL,fg=INK,padx=14,pady=12,relief='flat')
            ttk.Button(frame,text='Return to mission watch',command=self.briefing_window.withdraw).pack(side='bottom',pady=8)
            bar=ttk.Scrollbar(frame,command=self.briefing_text.yview)
            bar.pack(side='right',fill='y')
            self.briefing_text.configure(yscrollcommand=bar.set)
            self.briefing_text.pack(fill='both',expand=True)
        self.briefing_window.title('Mission briefing / '+speaker)
        self.briefing_heading.configure(text=speaker+' / Requested briefing')
        self.briefing_text.configure(state='normal')
        self.briefing_text.delete('1.0','end')
        self.briefing_text.insert('end',text+'\n\n'+DIALOGUE['pause'])
        self.briefing_text.configure(state='disabled')
        self.briefing_window.deiconify()
        self.briefing_window.lift()

    def executive_mission_action(self):
        self.navigate('Commission work' if self.interruptions.current and self.interruptions.current['kind']=='escalation' else 'Engineering dossier')

    def alternate_abort(self):
        self.running=False
        if messagebox.askyesno('Alternate-history authority','Discontinue the objective under the optional Administrator abort rule? Flight Control retains return manoeuvres; safe recovery is not guaranteed.',parent=self.root):
            self.act(self.sim.administrator_abort)

    def restart_save(self):
        self.running = False
        self.pacing.reset(time.monotonic())
        backup = self.save_path.with_name("before-restart.json")
        self.refresh()
        if not messagebox.askyesno("Restart save", f"Start again from the beginning with seed {self.sim.state.seed}?\n\nThe current run will be backed up to {backup}. A previous restart backup at this path will be replaced. Use Save campaign first to keep additional branches.", parent=self.root):
            return
        try:
            candidate = Simulation.new(self.sim.state.seed)
            save(self.sim.state, backup)
            save(candidate.state, self.save_path)
            self._replace_sim(candidate)
            self.status.set("Campaign restarted with the same seed. Previous run saved in before-restart.json.")
        except (RuleError, SaveError, OSError) as error:
            messagebox.showerror("Campaign not restarted", str(error), parent=self.root)

    def save_as(self):
        self.running = False
        path = filedialog.asksaveasfilename(parent=self.root, title="Save campaign", defaultextension=".json", initialfile="apollo-campaign.json", filetypes=[("Campaign JSON", "*.json")])
        if path:
            self.act(save, self.sim.state, path)
            self.status.set(f"Campaign saved: {path}")

    def load_campaign(self):
        self.running = False
        path = filedialog.askopenfilename(parent=self.root, title="Load campaign", filetypes=[("Campaign JSON", "*.json")])
        if path:
            try: self._replace_sim(Simulation(load(path)))
            except (SaveError, OSError) as error: messagebox.showerror("Campaign not loaded", str(error), parent=self.root)

    def _replace_sim(self, sim):
        self.running = False
        self.pacing.reset(time.monotonic())
        if hasattr(self,'briefing_window') and self.briefing_window.winfo_exists():
            self.briefing_window.destroy()
        self.sim = sim
        self.interruptions=Interruptions.for_campaign(sim.briefing())
        for frame in self.frames.values():
            frame.destroy()
        self.frames.clear()
        self.active_frame=None
        self.observation = Observation()
        self.theory.set(HYPOTHESES[sim.state.player_hypothesis])
        self.rationale.set(sim.state.player_rationale)
        self.selected_evidence = None
        self.page = "Daily briefing"
        self.status.set("Campaign loaded. Time is paused.")
        self.refresh()

    def new_campaign(self):
        self.running = False
        seed = simpledialog.askinteger("New campaign", "Scenario seed (11 is the default):", initialvalue=11, minvalue=0, maxvalue=2**32-1, parent=self.root)
        if seed is None: return
        try:
            candidate = Simulation.new(seed)
            save(self.sim.state, self.save_path.with_name("before-new-campaign.json"))
            self._replace_sim(candidate)
        except (RuleError, SaveError, OSError) as error: messagebox.showerror("Could not start campaign", str(error), parent=self.root)

    def close(self):
        try: save(self.sim.state, self.save_path)
        except (SaveError, OSError) as error:
            if not messagebox.askyesno("Save failed", f"{error}\nClose without saving?", parent=self.root): return
        if hasattr(self,'launch_audio'):self.launch_audio.stop()
        self.root.destroy()


def run(sim):
    root = tk.Tk()
    AdministratorApp(root, sim)
    root.mainloop()
