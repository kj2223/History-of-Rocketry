"""Persistent Tk widgets for a read-only mission watch."""
import tkinter as tk
from tkinter import ttk
from .observation import EventCursor, instrument_report
from .interruptions import classification, interruption_text
from .mission_contact import DIALOGUE
from .continuity import launch_context, launch_scene
from .control_room import ControlRoomDisplay


class MissionWatch(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self.cursor = EventCursor()
        self.board_key = None
        self.title = app.label(self, '', 'RoomTitle.TLabel', 0)
        self.subtitle = app.label(self, '', 'Muted.TLabel')
        self.subtitle.pack_forget()
        self.notice=ttk.Frame(self,style='Card.TFrame',padding=10)
        self.notice_title=app.label(self.notice,'','CardTitle.TLabel')
        self.notice_detail=app.label(self.notice,'','CardMuted.TLabel')
        ttk.Button(self.notice,text='Acknowledge / resume',command=app.resume_interruption).pack(side='left',padx=4)
        self.action_button=ttk.Button(self.notice,text='Open executive issue',command=app.executive_mission_action)
        self.action_button.pack(side='left',padx=4)
        self.controls=ttk.Frame(self)
        self.controls.pack(fill='x',pady=4)
        ttk.Button(self.controls,text='Run / pause',command=app.toggle_clock,style='Compact.TButton').pack(side='left')
        self.skip_button=ttk.Button(self.controls,text='Skip to next phase',command=lambda:app.act(app.sim.advance_to_next),style='Compact.TButton')
        self.skip_button.pack(side='left',padx=5)
        self.focus_button=ttk.Button(self.controls,text='Show files',command=self.toggle_launch_focus,style='Compact.TButton')
        self.focus_button.pack(side='left',padx=5)
        self.launch_focus=True
        ttk.Button(self.controls,text='Speak to Flight Director',command=self.open_contact,style='Compact.TButton').pack(side='right')
        self.panes=tk.PanedWindow(self,orient='vertical',sashwidth=8,bg='#bdb6a7',borderwidth=0,opaqueresize=True)
        self.panes.pack(fill='both',expand=True,pady=(4,0))
        self.tabs=ttk.Notebook(self.panes)
        self.panes.add(self.tabs,minsize=260,stretch='always')
        live=ttk.Frame(self.tabs)
        self.live=live
        self.tabs.add(live,text='Live observation')
        self.moment=ttk.Frame(live,style='Card.TFrame',padding=(10,6))
        self.moment_title=app.label(self.moment,'','CardTitle.TLabel',0)
        self.moment_voice=app.label(self.moment,'','LaunchVoice.TLabel',2)
        self.moment.pack(fill='x')
        self.room=ControlRoomDisplay(live,app.observation.location) if app.observation.location in ('lcc','mcc') else None
        self.board=tk.Canvas(live,height=150,bg='#fffaf0',highlightthickness=0)
        if self.room:
            self.room.pack(fill='both',expand=True)
        else:
            self.board.pack(fill='both',expand=True)
        app.label(live,'Observer / Flight Control retains operational authority. Model estimates are separate from instrument reports.','Muted.TLabel',2)
        records=ttk.Frame(self.tabs)
        self.tabs.add(records,text='Situation & readiness')
        body=app.scroll_area(records)
        paper=app.card(body,'MISSION FILE')
        self.heading=app.label(paper,'','CardTitle.TLabel')
        self.met=app.label(paper,'','CardMuted.TLabel')
        self.detail=app.label(paper,'','Card.TLabel')
        self.progress=ttk.Progressbar(paper,maximum=100)
        self.progress.pack(fill='x',pady=5)
        self.status=app.label(paper,'','CardMuted.TLabel')
        self.launch_digest=app.label(paper,'','CardMuted.TLabel')
        self.measurements=app.label(body,'','Muted.TLabel')
        plan=ttk.Frame(self.tabs,padding=10)
        self.tabs.add(plan,text='Flight plan')
        self.phases=ttk.Treeview(plan,columns=('phase','hours','status'),show='headings',height=6,selectmode='browse')
        for key,title,width in (('phase','FLIGHT PLAN',360),('hours','Planned h',90),('status','Recorded status',140)):
            self.phases.heading(key,text=title)
            self.phases.column(key,width=width)
        plan_scroll=ttk.Scrollbar(plan,command=self.phases.yview)
        plan_scroll.pack(side='right',fill='y')
        self.phases.configure(yscrollcommand=plan_scroll.set)
        self.phases.pack(fill='both',expand=True)
        self.controller=ttk.Frame(self.tabs)
        self.tabs.add(self.controller,text='Flight Director')
        contact_body=app.scroll_area(self.controller)
        app.label(contact_body,'Flight Director / Administrator’s primary mission contact','CardTitle.TLabel')
        app.label(contact_body,'Request observations, assessments and recommendations. Flight decisions remain with Flight Control and the crew.','Muted.TLabel')
        self.contact=tk.StringVar(value='Flight Director')
        self.question=tk.StringVar(value=next(iter(DIALOGUE['questions'].values()))['label'])
        self.mission_id=None
        app.label(contact_body,'Briefing contact','Muted.TLabel')
        ttk.Combobox(contact_body,textvariable=self.contact,values=tuple(item['name'] for item in DIALOGUE['contacts'].values()),state='readonly',width=24).pack(anchor='w',pady=4)
        app.label(contact_body,'Question','Muted.TLabel')
        ttk.Combobox(contact_body,textvariable=self.question,values=tuple(item['label'] for item in DIALOGUE['questions'].values()),state='readonly',width=48).pack(anchor='w',pady=4)
        ttk.Button(contact_body,text='Request briefing',command=self.ask).pack(anchor='w',pady=6)
        self.alt_abort=ttk.Button(contact_body,text='Alternate-history abort…',command=app.alternate_abort)
        if app.sim.state.rules['administrator_abort']:
            self.alt_abort.pack(anchor='w',pady=6)
        self.transcript_dock=ttk.Frame(self.panes,padding=(8,4))
        self.panes.add(self.transcript_dock,minsize=110,height=170,stretch='never')
        app.label(self.transcript_dock,'MISSION TRANSCRIPT / controller communications','Muted.TLabel',2)
        log_frame=ttk.Frame(self.transcript_dock)
        log_frame.pack(fill='both',expand=True)
        self.log=tk.Text(log_frame,height=5,wrap='word',bg='#fffaf0',fg='#252b2b',font=('Courier New',11),padx=12,pady=8,relief='flat',state='disabled')
        self.log.tag_configure('important',background='#f2dfb3',foreground='#252b2b')
        scrollbar=ttk.Scrollbar(log_frame,command=self.log.yview)
        scrollbar.pack(side='right',fill='y')
        self.log.configure(yscrollcommand=scrollbar.set)
        self.log.pack(fill='both',expand=True)

    def toggle_launch_focus(self):
        self.launch_focus=not self.launch_focus
        if self.launch_focus:self.tabs.select(self.live)
        self.app.refresh()

    def update_launch_scene(self,public):
        scene=launch_scene(public,self.mission_id)
        focused=scene['active'] and self.launch_focus and self.tabs.select()==str(self.live) and not self.app.interruptions.current and not scene['contingency']
        self.tabs.configure(style='Launch.TNotebook' if focused else 'TNotebook')
        self.focus_button.configure(text='Show files' if focused else 'Watch launch',state='normal' if scene['active'] else 'disabled')
        if scene['active']:
            if not self.focus_button.winfo_manager():self.focus_button.pack(side='left',padx=5)
        else:self.focus_button.pack_forget()
        if focused:self.skip_button.pack_forget()
        elif not self.skip_button.winfo_manager():self.skip_button.pack(side='left',padx=5)
        if scene['active']:
            self.set_text(self.moment_title,scene['title'])
            self.set_text(self.moment_voice,scene['speaker']+' / '+scene['text'])
            if not self.moment.winfo_manager():self.moment.pack(fill='x',before=self.room or self.board)
        elif self.moment.winfo_manager():self.moment.pack_forget()

    def open_contact(self):
        self.contact.set('Flight Director')
        self.tabs.select(self.controller)

    def ask(self):
        contact=next(key for key,item in DIALOGUE['contacts'].items() if item['name']==self.contact.get())
        question=next(key for key,item in DIALOGUE['questions'].items() if item['label']==self.question.get())
        self.app.ask_controller(question,contact,self.mission_id)

    @staticmethod
    def set_text(widget, text):
        if widget.cget('text') != text:
            widget.configure(text=text)

    def update_report(self, public, report, fraction):
        self.mission_id=report['mission']['id']
        if hasattr(self,'update_launch_scene'):self.update_launch_scene(public)
        notice=self.app.interruptions.current
        if notice:
            self.set_text(self.notice_title,notice['interruption'].replace('_',' ').upper()+' / '+notice['title'])
            self.set_text(self.notice_detail,interruption_text(notice,public))
            if not self.notice.winfo_manager():
                self.notice.pack(fill='x',pady=6,before=self.controls)
            self.action_button.configure(state='normal' if notice['interruption']=='action_required' else 'disabled')
        elif self.notice.winfo_manager():
            self.notice.pack_forget()
        self.alt_abort.configure(state='normal' if public['rules']['administrator_abort'] and report['flight'] and not notice else 'disabled')
        if public['rules']['administrator_abort']:
            if not self.alt_abort.winfo_manager():self.alt_abort.pack(anchor='w',pady=6)
        else:self.alt_abort.pack_forget()
        self.set_text(self.title,report['location']+' / '+report['mission']['name'])
        self.set_text(self.subtitle,report['mission']['name'] + " / Observer’s situation report")
        heading,detail=report['heading'],report['detail']
        flight=report['flight']
        launch_active=bool(flight and flight['phase']=='Ascent')
        precise=bool(flight and flight.get('second_clock'))
        if self.room:
            self.room.update_display(public,report,fraction)
        if launch_active and precise:
            heading='LAUNCH WATCH / '+flight['launch']['status']
            detail='Flight Control retains operational authority. The camera is a model reconstruction, not archival footage.'
        elif launch_active:
            cue=next(cue for cue in reversed(DIALOGUE['launch_sequence']) if fraction>=cue['at'])
            heading='LAUNCH SEQUENCE / '+cue['title']
            detail=cue['text']+' Presentation replay within the engine’s coarse ascent hour.'
        self.set_text(self.heading,heading)
        self.set_text(self.detail,detail)
        references=launch_context(public,report['mission']['id']) if (launch_active or not flight and not report['result']) else []
        self.set_text(self.launch_digest,'\n'.join('READINESS FILE / '+item['summary'] for item in references))
        if flight:
            seconds=flight['launch']['met_seconds'] if precise else int((report['elapsed']+fraction)*3600)
            sign='−' if seconds<0 else '+'
            h,rest=divmod(abs(seconds),3600)
            m,s=divmod(rest,60)
            self.set_text(self.met,(f'MET {sign}{h:03}:{m:02}:{s:02} / Engine clock, 1-second resolution\nPhase boundary in {flight["remaining_seconds"]//60} min' if precise else f'MET estimate {h:03}:{m:02}:{s:02}  /  Engine-confirmed elapsed {report["elapsed"]} h\nPhase: {flight["elapsed"]} h confirmed; {flight["remaining"]} h to its scheduled boundary'))
            value=100*(flight['phase_seconds']/3600 if precise else flight['elapsed']+fraction)/(flight['elapsed']+flight['remaining'])
            self.set_text(self.status,'CONTROLLER INTERPRETATION / ' + flight['operations'] + f" · Configuration {public['revision']}\nObjective: {'achievement recorded' if report['objective_recorded'] else 'not yet confirmed'} · Crew return: not yet confirmed · Operations envelope already committed")
        else:
            self.set_text(self.met,'Mission clock inactive / consult the recorded outcome or await office authorisation.')
            self.set_text(self.status,'\n'.join(report['blocks']))
            value=100 if report['result'] else 0
        if abs(float(self.progress['value'])-value)>.001:
            self.progress['value']=value
        self.set_text(self.measurements,instrument_report(public,report['mission']['id']))
        board_key=(report['mission']['id'],report['heading'],report['outcome'])
        if not self.room and board_key!=self.board_key:
            self.board.delete('all')
            self.app._draw_observation_board(self.board,report)
            self.board_key=board_key
        for index,phase in enumerate(report['phases']):
            iid=f'p{index}'
            values=(phase['name'],phase['hours'],phase['status'])
            if not self.phases.exists(iid):
                self.phases.insert('','end',iid=iid,values=values)
            elif tuple(map(str,self.phases.item(iid,'values'))) != tuple(map(str,values)):
                self.phases.item(iid,values=values)
        for iid in self.phases.get_children()[len(report['phases']):]:
            self.phases.delete(iid)
        entries=[entry for entry in public['transcript'] if entry['mission']==report['mission']['id'] and (precise or not launch_active or entry.get('launch_cue') is None or entry['launch_cue']<=fraction)]
        changed,events=self.cursor.update({'mission':report['mission'],'events':entries})
        if changed or events:
            position=self.log.yview()
            follow=changed or position[1]>=.99
            self.log.configure(state='normal')
            if changed:
                self.log.delete('1.0','end')
            important_ids={event['id'] for event in public['history'] if classification(event)}
            for entry in events:
                important=any(link in important_ids for link in entry['links'])
                self.log.insert('end',('!! ' if important else '')+f"{entry['date']} / {entry['speaker']}\n{entry['text']}\n\n",'important' if important else ())
            self.log.configure(state='disabled')
            if follow:
                self.log.see('end')
                if changed:
                    self.log.after_idle(lambda:self.log.see('end'))
            else:
                self.log.yview_moveto(position[0])
