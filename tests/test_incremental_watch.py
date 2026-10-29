from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock
from per_aspera.engine import Simulation
from per_aspera.observation import Observation, EventCursor, instrument_report
from test_simulation import prepare_fixture


class Label:
    def __init__(self):self.text='';self.changes=0
    def cget(self,key):return self.text
    def configure(self,**kw):self.text=kw['text'];self.changes+=1

class Tree:
    def __init__(self):self.rows={};self.selection='p0'
    def exists(self,key):return key in self.rows
    def insert(self,parent,index,iid,values):self.rows[iid]=tuple(map(str,values))
    def item(self,key,option=None,values=None):
        if values is not None:self.rows[key]=tuple(map(str,values))
        return self.rows[key]
    def get_children(self):return tuple(self.rows)
    def delete(self,key):del self.rows[key]

class Log:
    def __init__(self):self.text='';self.position=(.2,.5);self.selection='retained text';self.focus='log';self.appends=0
    def yview(self):return self.position
    def configure(self,**kwargs):pass
    def delete(self,*args):self.text=''
    def insert(self,index,text,*tags):self.text+=text;self.appends+=1
    def see(self,*args):self.position=(.8,1.)
    def after_idle(self,callback):callback()
    def yview_moveto(self,value):self.position=(value,self.position[1])


class IncrementalWatchTests(TestCase):
    def watch(self):
        try:
            from per_aspera.watch_ui import MissionWatch
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        watch=SimpleNamespace(cursor=EventCursor(),board_key=None,room=None,app=SimpleNamespace(_draw_observation_board=Mock(),interruptions=SimpleNamespace(current=None)),board=Mock(),phases=Tree(),log=Log(),progress={'value':0},set_text=MissionWatch.set_text)
        watch.tabs=Mock()
        watch.notice=Mock()
        watch.notice.winfo_manager.return_value=''
        watch.notice_title=Label();watch.notice_detail=Label();watch.action_button=Mock();watch.alt_abort=Mock()
        for key in ('title','subtitle','heading','detail','met','status','measurements','launch_digest'):
            setattr(watch,key,Label())
        return watch,MissionWatch.update_report

    def test_repeated_updates_append_once_and_preserve_selection_focus_scroll(self):
        sim=Simulation.new(11)
        prepare_fixture(sim)
        sim.advance_to_next()
        sim.launch()
        desk=Observation('mcc')
        watch,update=self.watch()
        public=sim.briefing();report=desk.project(public)
        update(watch,public,report,.1)
        watch.log.position=(.2,.5)
        text=watch.log.text;appends=watch.log.appends;heading_changes=watch.heading.changes
        update(watch,public,report,.15)
        self.assertEqual(watch.log.text,text)
        self.assertEqual(watch.log.appends,appends)
        self.assertEqual(watch.heading.changes,heading_changes)
        self.assertEqual(watch.log.selection,'retained text')
        self.assertEqual(watch.log.focus,'log')
        self.assertEqual(watch.log.position,(.2,.5))
        self.assertEqual(watch.phases.selection,'p0')
        watch.tabs.select.assert_not_called()
        self.assertEqual(watch.board.delete.call_count,1)
        sim.advance(1)
        public=sim.briefing();report=desk.project(public)
        update(watch,public,report,0)
        self.assertEqual(watch.log.appends,len(public["transcript"]))
        self.assertEqual(watch.log.position,(.2,.5))
        self.assertEqual(watch.phases.selection,'p0')
        self.assertIn('Earth-orbit systems checkout',watch.log.text)

    def test_event_cursor_deduplicates_and_only_resets_on_mission_change(self):
        sim=Simulation.new(11)
        desk=Observation('mcc')
        report=desk.project(sim.briefing())
        cursor=EventCursor()
        changed,new=cursor.update(report)
        self.assertTrue(changed)
        self.assertEqual(cursor.update(report),(False,[]))
        self.assertEqual(instrument_report(sim.briefing(),'apollo9').count('No in-flight instrument'),1)

    def test_cached_refresh_keeps_document_widget_identity(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        sim=Simulation.new(11)
        frame=Mock()
        app=SimpleNamespace(sim=sim,observation=Observation('office'),page='Engineering dossier',frames={('office','Engineering dossier'):frame},active_frame=frame,date=Mock(),abort_rule=Mock(),_clock_label=Mock(),location_buttons={},nav_buttons={})
        AdministratorApp.refresh(app)
        AdministratorApp.refresh(app)
        self.assertIs(app.frames[('office','Engineering dossier')],frame)
        frame.destroy.assert_not_called()
        frame.pack_forget.assert_not_called()

    def test_wheel_over_schematic_scrolls_document_not_static_canvas(self):
        try:
            from per_aspera.ui import AdministratorApp
        except ImportError:
            self.skipTest('Tkinter adapter unavailable')
        from unittest.mock import patch
        class Canvas:
            def __init__(self,master,scrollable):
                self.master=master
                self.scrollable=scrollable
                self.yview_scroll=Mock()
            def cget(self,key):return 'scrollbar' if self.scrollable else ''
        document=Canvas(None,True)
        schematic=Canvas(document,False)
        with patch('per_aspera.ui.tk.Canvas',Canvas):
            result=AdministratorApp._scroll_document(None,SimpleNamespace(widget=schematic,delta=-120))
        schematic.yview_scroll.assert_not_called()
        document.yview_scroll.assert_called_once_with(1,'units')
        self.assertEqual(result,'break')

    def test_launch_display_uses_engine_seconds_without_replaying_future_events(self):
        from dataclasses import asdict
        sim=Simulation.new(11)
        prepare_fixture(sim);sim.advance_to_next();sim.launch()
        watch,update=self.watch()
        for seconds in (0,52,60,143,222,769):
            if seconds:sim.advance_mission_seconds(seconds-sim.state.flight['mission_seconds'])
            before=asdict(sim.state)
            public=sim.briefing();report=Observation('lcc').project(public)
            update(watch,public,report,.9)
            self.assertEqual(watch.heading.text,'LAUNCH WATCH / '+public['flight']['launch']['status'])
            count=watch.log.appends
            update(watch,public,report,.1)
            self.assertEqual(watch.log.appends,count)
            self.assertEqual(before,asdict(sim.state))
            self.assertIn('1-second resolution',watch.met.text)

    def test_primary_contact_opens_context_panel_without_simulation_command(self):
        from per_aspera.watch_ui import MissionWatch
        watch=SimpleNamespace(contact=Mock(),tabs=Mock(),controller=object(),app=Mock())
        MissionWatch.open_contact(watch)
        watch.contact.set.assert_called_once_with('Flight Director')
        watch.tabs.select.assert_called_once_with(watch.controller)
        watch.app.assert_not_called()
