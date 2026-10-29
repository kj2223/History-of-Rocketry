from copy import deepcopy
from dataclasses import asdict
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from per_aspera.continuity import launch_voices, launch_scene, EXPERIENCE
from per_aspera.engine import Simulation
from per_aspera.interruptions import Interruptions,step_seconds_observed
from per_aspera.launch_audio import LaunchAudio
from per_aspera.persistence import save,load,validate,SaveError
from per_aspera.pacing import nominal_duration,phase_seconds
from per_aspera.definitions import SCENARIO,DATA
from test_simulation import prepare_fixture


def ready():
    sim=Simulation.new(11)
    prepare_fixture(sim);sim.advance_to_next();sim.launch()
    return sim


class LaunchPayoffTests(TestCase):
    def test_voices_link_real_records_and_do_not_invent_a_commission(self):
        sim=ready()
        for voice in sim.state.flight['launch_voices']:
            self.assertTrue(voice['links'])
            self.assertTrue(all(any(event.id==link for event in sim.state.events) for link in voice['links']))
            self.assertNotIn('you delegated',voice['text'].lower())
        public=sim.briefing()
        public['history']=[]
        self.assertEqual(launch_voices(public,'apollo9'),[])

    def test_voices_use_public_interpretations_not_hidden_faults(self):
        sim=ready();public=sim.briefing();before=launch_voices(public,'apollo9')
        sim.state.faults=dict.fromkeys(sim.state.faults,.999)
        self.assertEqual(before,launch_voices(sim.briefing(),'apollo9'))

    def test_timed_voices_and_aftermath_do_not_pause_nominal_launch(self):
        sim=ready();tracker=Interruptions()
        voices=deepcopy(sim.state.flight['launch_voices'])
        self.assertFalse(any(event.title in {v['title'] for v in voices} for event in sim.state.events))
        step_seconds_observed(sim,855,tracker)
        self.assertIsNone(tracker.current)
        for voice in voices:
            events=[event for event in sim.state.events if event.title==voice['title']]
            self.assertEqual(len(events),1)
            self.assertEqual(events[0].second,voice['second'])
            self.assertIn(events[0].id,sim.state.staff[voice['person']].memories)
            self.assertTrue(set(voice['links']).issubset(events[0].links))
            self.assertTrue(any(events[0].id in entry['links'] for entry in sim.state.transcript))

    def test_save_after_insertion_does_not_repeat_reflections(self):
        sim=ready();sim.advance_mission_seconds(780)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent.parent/'tmp') as folder:
            path=Path(folder)/'payoff.json';save(sim.state,path)
            resumed=Simulation(load(path))
        sim.advance_mission_seconds(80);resumed.advance_mission_seconds(80)
        self.assertEqual(asdict(sim.state),asdict(resumed.state))
        self.assertEqual(len(resumed.state.flight['spoken_voices']),len(resumed.state.flight['launch_voices']))

    def test_discontinued_launch_does_not_generate_relief_or_orbit_calls(self):
        sim=ready();sim.advance_mission_seconds(40)
        sim.state.flight['aborted']=True
        sim.advance_mission_seconds(815)
        titles={event.title for event in sim.state.events}
        self.assertNotIn('Parking orbit insertion',titles)
        self.assertFalse(titles & {item['title'] for item in EXPERIENCE['aftermath']})
        sim.advance(1)
        self.assertFalse(any(event.title=='Ascent handover' for event in sim.state.events))

    def test_voice_schedule_does_not_change_engineering_outcomes(self):
        sim=ready();reference=Simulation(deepcopy(sim.state))
        reference.state.flight.pop('launch_voices');reference.state.flight.pop('spoken_voices')
        sim.advance(1000);reference.advance(1000)
        for key in ('budget','rng_state','faults','fatigue','crew_readiness','finance'):
            self.assertEqual(getattr(sim.state,key),getattr(reference.state,key))
        self.assertEqual(sim.state.results[-1]['outcome'],reference.state.results[-1]['outcome'])
        self.assertEqual(sim.state.results[-1]['hour'],reference.state.results[-1]['hour'])
        self.assertEqual([p.beliefs for p in sim.state.staff.values()],[p.beliefs for p in reference.state.staff.values()])

    def test_nominal_pacing_has_room_for_liftoff_and_aftermath(self):
        self.assertLessEqual(nominal_duration(SCENARIO['missions'][0]),960)
        def rate(t):return phase_seconds({'phase':'Ascent','elapsed':0,'second_clock':True,'mission_seconds':t})
        self.assertGreater(rate(60),rate(120))
        self.assertGreater(rate(780),rate(860))

    def test_scene_does_not_show_future_voices(self):
        sim=ready()
        self.assertEqual(launch_scene(sim.briefing(),'apollo9')['title'],'Terminal countdown')
        sim.advance_mission_seconds(24)
        self.assertEqual(launch_scene(sim.briefing(),'apollo9')['title'],'The ground work goes with them')
        sim.advance_mission_seconds(831)
        self.assertFalse(launch_scene(sim.briefing(),'apollo9')['active'])

    def test_save_rejects_unlinked_or_future_spoken_memories(self):
        sim=ready();sim.state.flight['spoken_voices']=[825]
        with self.assertRaises(SaveError):validate(sim.state)
        sim.state.flight['spoken_voices']=[]
        sim.state.flight['launch_voices'][0]['links']=['E99999']
        with self.assertRaises(SaveError):validate(sim.state)

    def test_focus_changes_chrome_without_replacing_widgets_or_selecting_tabs(self):
        from per_aspera.watch_ui import MissionWatch
        sim=ready()
        live=object()
        watch=SimpleNamespace(mission_id='apollo9',launch_focus=True,tabs=Mock(),live=live,app=SimpleNamespace(interruptions=SimpleNamespace(current=None)),focus_button=Mock(),skip_button=Mock(),moment=Mock(),moment_title=Mock(),moment_voice=Mock(),set_text=Mock())
        watch.tabs.select.return_value=str(live)
        MissionWatch.update_launch_scene(watch,sim.briefing())
        watch.tabs.configure.assert_called_with(style='Launch.TNotebook')
        watch.skip_button.pack_forget.assert_called_once()
        sim.advance_mission_seconds(855)
        MissionWatch.update_launch_scene(watch,sim.briefing())
        watch.tabs.configure.assert_called_with(style='TNotebook')
        self.assertTrue(all(call.args==() for call in watch.tabs.select.call_args_list))
        watch.moment.destroy.assert_not_called()


class LaunchAudioTests(TestCase):
    def test_audio_is_optional_deduplicated_and_stops_on_pause_or_location_change(self):
        backend=SimpleNamespace(PlaySound=Mock(),SND_FILENAME=1,SND_ASYNC=2,SND_NODEFAULT=4,SND_LOOP=8)
        audio=LaunchAudio(backend)
        sim=ready();sim.advance_mission_seconds(60)
        before=asdict(sim.state);public=sim.briefing()
        audio.sync(public,True,'lcc',False);backend.PlaySound.assert_not_called()
        audio.sync(public,True,'lcc',True)
        self.assertTrue(backend.PlaySound.call_args.args[0].endswith('ascent.wav'))
        audio.sync(public,True,'mcc',True)
        self.assertEqual(backend.PlaySound.call_count,1)
        audio.sync(public,False,'mcc',True);backend.PlaySound.assert_called_with(None,0)
        audio.sync(public,True,'office',True)
        self.assertEqual(backend.PlaySound.call_count,2)
        self.assertEqual(before,asdict(sim.state))

    def test_packaged_sounds_are_valid_waves_and_backend_failure_is_harmless(self):
        import wave
        for name in ('ignition','ascent','staging','insertion'):
            with wave.open(str(DATA/'audio'/f'{name}.wav')) as sound:
                self.assertGreater(sound.getnframes(),0)
                self.assertEqual(sound.getnchannels(),1)
        backend=SimpleNamespace(PlaySound=Mock(side_effect=RuntimeError('no device')),SND_FILENAME=1,SND_ASYNC=2,SND_NODEFAULT=4,SND_LOOP=8)
        sim=ready();sim.advance_mission_seconds(60)
        LaunchAudio(backend).sync(sim.briefing(),True,'lcc',True)
