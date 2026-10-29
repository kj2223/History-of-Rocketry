from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock
from per_aspera.control_room import ControlRoomDisplay


class RoomLayoutTests(TestCase):
    def display(self,width,height):
        display=SimpleNamespace(width=width,height=height,geometry=None)
        display.geometry=lambda:ControlRoomDisplay.geometry(display)
        return display

    def test_wide_and_tall_windows_preserve_aspect_ratio_and_bounds(self):
        for width,height in ((900,300),(2300,220),(1020,500),(3447,700),(300,900)):
            display=self.display(width,height)
            left,top=ControlRoomDisplay.point(display,0,0)
            right,bottom=ControlRoomDisplay.point(display,900,300)
            self.assertGreaterEqual(left,0);self.assertGreaterEqual(top,0)
            self.assertLessEqual(right,width);self.assertLessEqual(bottom,height)
            self.assertAlmostEqual((right-left)/(bottom-top),3)
            self.assertAlmostEqual((left+right)/2,width/2)
            self.assertAlmostEqual((top+bottom)/2,height/2)

    def test_telemetry_row_spacing_scales_with_fonts_on_wide_windows(self):
        display=self.display(2300,250)
        scale,_,_=display.geometry()
        first=ControlRoomDisplay.point(display,600,64)[1]
        second=ControlRoomDisplay.point(display,600,89)[1]
        # Point fonts are converted to pixels by Tk; reserve space for a full line.
        self.assertGreater(second-first,max(8,int(11*scale))*1.5)

    def test_paused_clock_remains_visible_outside_live_tab(self):
        from per_aspera.ui import AdministratorApp
        app=SimpleNamespace(interruptions=SimpleNamespace(current=None),running=False,view={'flight':{'second_clock':True,'launch':{'met_seconds':-11}}},clock=Mock())
        AdministratorApp._clock_label(app)
        self.assertIn('T−000:00:11',app.clock.set.call_args.args[0])

    def test_location_shell_hides_office_navigation_and_restores_it(self):
        from per_aspera.engine import Simulation
        from per_aspera.ui import AdministratorApp
        from per_aspera.observation import Observation
        frame=Mock()
        app=SimpleNamespace(sim=Simulation.new(11),observation=Observation('lcc'),page='Engineering dossier',frames={'lcc':frame,('office','Engineering dossier'):frame},active_frame=frame,date=Mock(),abort_rule=Mock(),_clock_label=Mock(),location_buttons={},nav_buttons={},nav=Mock(),header=Mock(),locations=Mock(),content=Mock())
        AdministratorApp.refresh(app)
        app.nav.pack_forget.assert_called_once();app.header.pack_forget.assert_called_once()
        app.nav.winfo_manager.return_value='';app.header.winfo_manager.return_value=''
        app.observation.location='office'
        AdministratorApp.refresh(app)
        app.nav.pack.assert_called_once();app.header.pack.assert_called_once()
