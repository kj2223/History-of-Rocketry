// What the player sees on top of the picture, at full resolution: the top bar, the talk on the net, speech over people,
// markers on the stage, the clipboard for the current step, the strip chart, the decay needle, the count clock and the
// range plot. Readings are plain: no bands or automatic warnings (Aaron, 22 November 2026); the red-line card is the
// reference.
using System;
using System.Collections.Generic;
using System.Linq;
using AdAstra.Truth;
using AdAstra.UI;
using UnityEngine;

namespace AdAstra
{
    public sealed partial class Game
    {
        Vector2 scroll;
        static int Px(float v) => Ui.Px(v);

        void OnGUI()
        {
            Ui.Build();
            view.Draw();
            if (beat == Beat.Title) { TitleScreen(); return; }
            TopBar();
            Markers();
            Bubbles();
            LogBox();
            if (beat == Beat.Flight || (beat == Beat.Review && flight != null)) RangePlot(new Rect(Px(24), Screen.height - Px(360), Px(560), Px(330)));
            if (beat != Beat.Flight) Clipboard();
        }

        // ---------------- Frame ----------------
        void TitleScreen()
        {
            float w = Screen.width, h = Screen.height;
            Ui.Box(new Rect(0, h * 0.30f, w, Px(300)), new Color(0.07f, 0.07f, 0.05f, 0.72f));
            GUI.Label(new Rect(0, h * 0.30f + Px(20), w, Px(80)), "AD ASTRA", Ui.Title);
            Ui.Label(new Rect(0, h * 0.30f + Px(100), w, Px(40)), "The WAC Corporal programme · White Sands Proving Ground, 1945–1946", Ui.Head, Ui.Cream);
            Ui.Label(new Rect(0, h * 0.30f + Px(142), w, Px(40)), "An HD-2D prototype: a 3D world, pixel people, light and film over it", Ui.Note, Ui.Accent);
            var b = new Rect(w / 2 - Px(200), h * 0.30f + Px(205), Px(400), Px(56));
            if (GUI.Button(b, "Begin the season", Ui.Button)) Later(() => { NewSeason(gameSeed); });
            Ui.Label(new Rect(0, h - Px(60), w, Px(30)), "Right-drag turns the camera a little; the wheel moves it in and out.", Ui.Note, Ui.Cream);
        }

        void TopBar()
        {
            float h = Px(54);
            GUI.Box(new Rect(0, 0, Screen.width, h), GUIContent.none, Ui.Bar);
            GUI.Label(new Rect(Px(14), Px(8), Px(430), h - Px(16)), $"{DateText()} · {ClockText()}", Ui.Date);
            Ui.Label(new Rect(Px(460), Px(6), Screen.width - Px(1240), h - Px(12)), objective, Ui.Small, Ui.Cream);
            float x = Screen.width - Px(770);
            if (slot != null && beat != Beat.RoundEnd && beat != Beat.SeasonEnd)
            {
                var col = slot.Left <= 0 ? Ui.Hex("#ff8a6a") : Ui.Accent;
                Ui.Label(new Rect(x, Px(14), Px(460), Px(30)), $"Crew hours left: {Slot.HoursText(slot.Left)} of {Slot.HoursText(slot.Budget)}", Ui.Small, col);
            }
            x = Screen.width - Px(290);
            foreach (var s in new[] { 1f, 4f, 16f })
            {
                if (GUI.Button(new Rect(x, Px(9), Px(84), Px(36)), $"{s}×", Mathf.Approximately(speed, s) ? Ui.ButtonOn : Ui.Button)) Later(() => { speed = s; });
                x += Px(92);
            }
        }

        void LogBox()
        {
            var lines = Log.Skip(Math.Max(0, Log.Count - 5)).ToList();
            float y = Px(66), w = Mathf.Min(Px(760), Screen.width * 0.42f);
            foreach (var l in lines)
            {
                string who = l.Who == "" ? "" : $"<b>{l.Who}:</b> ";
                var content = new GUIContent($"{l.Time} {who}{l.Text}");
                float h = Ui.Log.CalcHeight(content, w);
                var old = Ui.Log.normal.textColor;
                Ui.Log.normal.textColor = l.Tone == "note" ? Ui.Hex("#c9c0a4") : Ui.ToneColor(l.Tone);
                GUI.Label(new Rect(Px(14), y, w, h), content, Ui.Log);
                Ui.Log.normal.textColor = old;
                y += h + Px(3);
            }
        }

        void Bubbles()
        {
            foreach (var kv in bubbles.ToList())
            {
                if (Time.time > kv.Value.until) { bubbles.Remove(kv.Key); continue; }
                if (!site.People.TryGetValue(kv.Key, out var p) || !p.Shown) continue;
                if (!view.ToScreen(p.Head, out var at)) continue;
                var c = new GUIContent(kv.Value.text);
                float w = Mathf.Min(Px(420), Ui.Bubble.CalcSize(c).x + Px(4));
                float h = Ui.Bubble.CalcHeight(c, w);
                var r = new Rect(at.x - w / 2, at.y - h - Px(10), w, h);
                r.x = Mathf.Clamp(r.x, Px(8), Screen.width - w - Px(8));
                r.y = Mathf.Max(Px(60), r.y);
                Ui.Box(new Rect(r.x - Px(2), r.y - Px(2), r.width + Px(4), r.height + Px(4)), kv.Value.tone == "go" ? Ui.Green : kv.Value.tone == "bad" ? Ui.Red : Ui.Olive);
                GUI.Label(r, c, Ui.Bubble);
            }
        }

        void Markers()
        {
            if (beat != Beat.Hangar) return;
            int n = 1;
            foreach (var s in Wac.Spots)
            {
                if (!site.SpotAnchors.TryGetValue(s.Id, out var a) || !view.ToScreen(a.position, out var at)) { n++; continue; }
                var r = new Rect(at.x - Px(20), at.y - Px(20), Px(40), Px(40));
                var style = selectedSpot == s.Id ? Ui.MarkerOn : Ui.Marker;
                string mark = flagged.Contains(s.Id) ? "!" : n.ToString();
                if (GUI.Button(r, new GUIContent(mark, s.Name), style)) Later(() => { selectedSpot = s.Id; });
                if (r.Contains(Event.current.mousePosition) || selectedSpot == s.Id)
                {
                    var c = new GUIContent(s.Name);
                    float w = Ui.Bubble.CalcSize(c).x + Px(4);
                    GUI.Label(new Rect(at.x - w / 2, r.y - Px(40), w, Px(34)), c, Ui.Bubble);
                }
                n++;
            }
        }

        void CountClock()
        {
            if (beat != Beat.Count || count == null || site.BlockhouseClock == null) return;
            if (!view.ToScreen(site.BlockhouseClock.position, out var at)) return;
            string t = count.AwaitFire ? "T-0:00" : $"T-{TText(count.T)}";
            var r = new Rect(at.x - Px(140), at.y - Px(38), Px(280), Px(76));
            GUI.Label(r, t, Ui.Clock);
            if (count.Held) Ui.Label(new Rect(r.x, r.yMax + Px(4), r.width, Px(30)), count.Busy > 0 ? "HOLD · CREW OUT" : "HOLD", Ui.Small, Ui.Amber);
        }

        // ---------------- The clipboard ----------------
        void Clipboard()
        {
            float w = Mathf.Min(Px(600), Screen.width * 0.36f);
            var rect = new Rect(Screen.width - w - Px(20), Px(70), w, Screen.height - Px(90));
            Ui.Box(new Rect(rect.x + Px(6), rect.y + Px(6), rect.width, rect.height), new Color(0, 0, 0, 0.35f));
            GUILayout.BeginArea(rect, Ui.Paper);
            scroll = GUILayout.BeginScrollView(scroll, false, false, GUIStyle.none, GUI.skin.verticalScrollbar, GUIStyle.none);
            switch (beat)
            {
                case Beat.Arrive: ArrivePanel(); break;
                case Beat.Brief: BriefPanel(); break;
                case Beat.CrewInspect: CrewPanel(); break;
                case Beat.Hangar: HangarPanel(); break;
                case Beat.Stand: StandPanel(); break;
                case Beat.Morning: MorningPanel(); break;
                case Beat.Count: CountPanel(); break;
                case Beat.Review: ReviewPanel(); break;
                case Beat.RoundEnd: RoundEndPanel(); break;
                case Beat.SeasonEnd: SeasonPanel(); break;
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        static void H(string t) { GUILayout.Label(t, Ui.Head); GUILayout.Space(Px(6)); }
        static void P(string t) { GUILayout.Label(t, Ui.Text); GUILayout.Space(Px(6)); }
        static void S(string t) { GUILayout.Label(t, Ui.Small); }
        static void N(string t) { GUILayout.Label(t, Ui.Note); }
        static bool B(string t, bool on = false) => GUILayout.Button(t, on ? Ui.ButtonOn : Ui.Button);
        static void Gap(float v = 12) => GUILayout.Space(Px(v));
        static void Rule() { var r = GUILayoutUtility.GetRect(1, Px(2), GUILayout.ExpandWidth(true)); Ui.Box(r, Ui.Faint); Gap(8); }

        void ArrivePanel()
        {
            H($"Round {roundIndex + 1} of {Campaign.Season.Length}");
            P($"{def.Name[0].ToString().ToUpper()}{def.Name.Substring(1)}.");
            Rule();
            foreach (var l in def.Between) P(l);
            var fixes = prog.Adopted.Select(c => Programme.FixText[c]).ToList();
            if (fixes.Count > 0) { Rule(); S("Standing fixes:"); foreach (var f in fixes) S("· " + f); Gap(); }
            Rule();
            P($"The crew has {Slot.HoursText(slot.Budget)} of work before the range slot.{(lastLost ? " Two hours short: they spent them building the replacement for the round you lost." : "")}");
            N("Everything you ask for before rollout comes out of those hours. Run past them and the range gives the slot away.");
            Gap(18);
            if (B("To the range office")) Later(() => { SetBeat(Beat.Brief); });
        }

        void BriefPanel()
        {
            H("The plan");
            S("Who looks her over in the hangar?");
            Gap(4);
            foreach (var id in new[] { "you", "kowalski", "delgado" })
            {
                var ins = Inspectors[id];
                string desc = id == "you" ? "You, yourself. Counted as you go: 15 min a look, 30-45 min a test." :
                    id == "kowalski" ? "Sgt. Kowalski. Thorough and slow: 5 h." : "Pvt. Delgado. Quick and cheerful: 2 h. Misses things, sees trouble that isn't there.";
                if (B(desc, inspector == id)) Later(() => { inspector = id; });
            }
            N("A real fault opened up costs 2 h to fix; a false alarm costs 3 h.");
            Gap(14);
            S($"Propellant load: {load * 100:0}% of full");
            load = Math.Round(GUILayout.HorizontalSlider((float)load, 0.85f, 1f) * 100) / 100;
            var est = prog.Estimate(load);
            N($"The drawing office: {est.low}-{est.high} km at this load ({(est.flights == 0 ? "on paper" : $"from {est.flights} flight{(est.flights > 1 ? "s" : "")}")}).");
            if (prog.RangeRecord > 0) N($"Range record so far: {prog.RangeRecord:0.0} km.");
            Gap(18);
            if (B("Go with this plan")) Later(() => { FinishPlan(inspector, load); });
        }

        void CrewPanel()
        {
            var ins = Inspectors[inspector];
            H($"{ins.name} looked her over");
            if (crewFlags == null || crewFlags.Count == 0) P("Nothing flagged.");
            else foreach (var id in crewFlags) P("· Flagged the " + Wac.SpotById(id).Name.ToLower() + ".");
            Rule();
            S($"Crew hours used: {Slot.HoursText(slot.Spent)} of {Slot.HoursText(slot.Budget)}.");
            Gap(18);
            if (B("Next morning: the stand")) Later(() => { ToStand(); });
        }

        void HangarPanel()
        {
            H("The WAC upper stage");
            N("Click a marker on the stage, or work down the list.");
            Gap(6);
            int n = 1;
            foreach (var s in Wac.Spots)
            {
                bool sel = selectedSpot == s.Id;
                GUILayout.BeginHorizontal();
                if (GUILayout.Button($"{n}. {s.Name}", sel ? Ui.Head : Ui.Text)) Later(() => { selectedSpot = s.Id; });
                GUILayout.EndHorizontal();
                if (looked.TryGetValue(s.Id, out var cue)) S("  " + (cue ? s.Cue : s.Sound));
                var m = Wac.MeterFor(s);
                if (m != null && metered.TryGetValue(s.Id, out var rd)) S($"  {m.Name}: {rd.Value} {m.Unit} (limit {(m.Low ? "all " : "")}{m.Limit})");
                if (sel)
                {
                    GUILayout.BeginHorizontal();
                    if (!looked.ContainsKey(s.Id) && B("Look · 15 min")) Later(() => { LookAt(s.Id); });
                    if (m != null && !metered.ContainsKey(s.Id) && B($"{m.Name} · {m.Minutes} min")) Later(() => { MeterSpot(s.Id); });
                    GUILayout.EndHorizontal();
                    if (B(flagged.Contains(s.Id) ? "Flagged for the crew (click to unflag)" : "Flag it for the crew", flagged.Contains(s.Id))) Later(() => { ToggleFlag(s.Id); });
                }
                Gap(6);
                n++;
            }
            Rule();
            S($"Flagged: {flagged.Count}. Each costs 2 h if real, 3 h if not.");
            Gap(10);
            if (B(flagged.Count > 0 ? $"Button her up: work the {flagged.Count} flag{(flagged.Count > 1 ? "s" : "")}" : "Button her up")) Later(() => { FinishInspection(); });
        }

        void StandPanel()
        {
            H("The static stand");
            GUILayout.Label("RED-LINE CARD  ·  chamber 17-23 bar  ·  tank 22-24 bar", Ui.Small);
            Gap(6);
            if (decay != null) { DecayDial(); return; }
            if (!fired)
            {
                P($"Tank pressurised: {round.TankGauge(0):0.0} bar.");
                if (B("Decay test: lock up the tank and watch")) Later(() => { DecayStart("stand"); });
                if (B("Fire the stage: 8-second start-up firing")) Later(() => { Fire(); });
                return;
            }
            var chart = GUILayoutUtility.GetRect(Px(500), Px(300), GUILayout.ExpandWidth(true));
            TraceChart(chart, Mathf.Clamp(fireT - 0.1f, 0, 8));
            if (fireT < 8.4f) return;
            Gap(8);
            if (!reworked && B("Rework the igniter (the launch slips a day)")) Later(() => { ReworkIgniter(); });
            if (B("Decay test on the tank")) Later(() => { DecayStart("stand"); });
            if (B("Roll her out to the tower")) Later(() => { RollOut(); });
        }

        void TraceChart(Rect r, float upTo)
        {
            Ui.Box(r, Ui.Cream);
            Ui.Frame(r, Ui.Ink);
            float x0 = r.x + Px(46), x1 = r.xMax - Px(10), y0 = r.yMax - Px(30), y1 = r.y + Px(12);
            Vector2 At(float t, float v) => new Vector2(Mathf.Lerp(x0, x1, t / 8f), Mathf.Lerp(y0, y1, v / 30f));
            for (int v = 0; v <= 30; v += 5)
            {
                Ui.Line(At(0, v), At(8, v), new Color(0.6f, 0.55f, 0.45f, 0.5f));
                GUI.Label(new Rect(r.x + Px(4), At(0, v).y - Px(10), Px(40), Px(20)), v.ToString(), Ui.Small);
            }
            for (int t = 0; t <= 8; t += 2) GUI.Label(new Rect(At(t, 0).x - Px(10), y0 + Px(4), Px(40), Px(20)), $"{t}s", Ui.Small);
            var pc = new List<Vector2>(); var tk = new List<Vector2>();
            foreach (var p in trace) { if (p.T > upTo) break; pc.Add(At(p.T, p.Pc)); tk.Add(At(p.T, p.Tank)); }
            Ui.Lines(pc, Ui.Hex("#b4441c"));
            Ui.Lines(tk, Ui.Hex("#2a5aa0"));
            GUI.Label(new Rect(x0 + Px(6), y1, Px(300), Px(22)), "<color=#b4441c>chamber</color>  <color=#2a5aa0>tank</color>  (bar)", Ui.Small);
        }

        void DecayDial()
        {
            P(decay.Where == "count" ? "Decay test in the hold: the tank is locked up." : "Decay test: the tank is locked up, the valve closed.");
            var r = GUILayoutUtility.GetRect(Px(300), Px(260), GUILayout.ExpandWidth(true));
            var c = new Vector2(r.center.x, r.y + Px(150));
            float rad = Px(120);
            Ui.Box(new Rect(c.x - rad - Px(10), c.y - rad - Px(10), rad * 2 + Px(20), rad + Px(70)), Ui.Hex("#d8cba6"));
            var arc = new List<Vector2>();
            for (int i = 0; i <= 40; i++) { float a = Mathf.Lerp(200, 340, i / 40f) * Mathf.Deg2Rad; arc.Add(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * rad); }
            Ui.Lines(arc, Ui.Ink);
            // 22 to 24 bar across the dial, a tick every 0.1
            for (int i = 0; i <= 20; i++)
            {
                float a = Mathf.Lerp(200, 340, i / 20f) * Mathf.Deg2Rad;
                var d = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                Ui.Line(c + d * rad, c + d * (rad - Px(i % 5 == 0 ? 18 : 9)), Ui.Ink);
                if (i % 5 == 0) GUI.Label(new Rect(c.x + d.x * (rad - Px(44)) - Px(24), c.y + d.y * (rad - Px(44)) - Px(10), Px(48), Px(20)), (22 + i * 0.1).ToString("0.0"), Ui.Small);
            }
            float v = Mathf.Clamp((float)DecayNow, 22, 24);
            float na = Mathf.Lerp(200, 340, (v - 22) / 2f) * Mathf.Deg2Rad;
            Ui.Line(c, c + new Vector2(Mathf.Cos(na), Mathf.Sin(na)) * (rad - Px(6)), Ui.Red);
            S($"Locked up {decay.Minutes:0} min · air {decay.Temp}°C · started at {Round.DecayStart:0.0} bar");
            N("The air warms through the morning and cools in the afternoon; a closed tank follows it.");
            Gap(6);
            GUI.enabled = decay.Minutes >= 1;
            GUILayout.BeginHorizontal();
            if (B("Call it tight")) Later(() => { DecayCall(true); });
            if (B("Call it a leak")) Later(() => { DecayCall(false); });
            GUILayout.EndHorizontal();
            GUI.enabled = true;
        }

        void MorningPanel()
        {
            H("Launch morning");
            P($"Tower laid {Round.SideText(lay, "°")} on the dawn balloon.");
            N("A fin-stabilised round turns into a crosswind as she leaves the rail, so the tower is laid downwind to bring her back onto the range line. The balloons tell you the wind, late and not exactly, and it keeps moving.");
            if (lateDays > 0) { Rule(); S($"This round is {lateDays} day{(lateDays > 1 ? "s" : "")} late."); }
            Gap(18);
            if (B("Into the blockhouse for the count")) Later(() => { StartCount(); });
        }

        void CountPanel()
        {
            var c = count;
            if (c == null) return;
            H("The count");
            S($"Range window left: {Math.Max(0, c.WindowEnd - clock):0} min");
            S($"Tower laid {Round.SideText(c.Lay, "°")} · last balloon ({c.BalloonAt}): {(c.BalloonAt == "dawn" ? "see the morning's" : $"{Math.Abs(c.Balloon)} km/h {(c.Balloon > 0 ? "east" : c.Balloon < 0 ? "west" : "")}")}");
            Rule();
            GUILayout.Label($"PRESS · tank {TankNow:0.0} bar", Ui.Big);
            Gap(6);
            if (decay != null) { DecayDial(); return; }
            if (c.Busy > 0) { P($"The crew is out: back in about {c.Busy:0} min."); return; }
            if (c.AwaitFire)
            {
                P("Zero. The firing switch is yours.");
                if (GUILayout.Button("FIRE", Ui.ButtonOn, GUILayout.Height(Px(70)))) Later(() => { FireRound(); });
                if (!c.Held && B("Hold")) Later(() => { c.AwaitFire = false; Hold(); });
                return;
            }
            if (c.Poll != null)
            {
                P(c.Poll == "tank" ? "Ellis is polling you: tank pressure." : "Ellis is polling you for the last time: tank pressure and the igniter circuit.");
                GUILayout.BeginHorizontal();
                if (B("GO")) Later(() => { Answer(true); });
                if (B("HOLD")) Later(() => { Answer(false); });
                GUILayout.EndHorizontal();
                return;
            }
            if (!c.Held) { if (B("Hold the count")) Later(() => { Hold(); }); return; }
            P("Holding. The range clock runs on.");
            if (B("Resume the count")) Later(() => { Resume(); });
            if (B("Ask the range for another balloon · 10 min")) Later(() => { ReleaseBalloon(); });
            Gap(6);
            S($"Re-lay the tower to: {Round.SideText(c.RelayTo, "°")}");
            GUILayout.BeginHorizontal();
            if (B("◄ west 0.5°")) Later(() => { c.RelayTo = Math.Max(-Round.MaxLay, c.RelayTo - 0.5); });
            if (B("east 0.5° ►")) Later(() => { c.RelayTo = Math.Min(Round.MaxLay, c.RelayTo + 0.5); });
            GUILayout.EndHorizontal();
            if (B("Send the pad crew out · 30 min, the count recycles to T-7:30")) Later(() => { Relay(c.RelayTo); });
            if (B("Decay test in the hold")) Later(() => { DecayStart("count"); });
        }

        void ReviewPanel()
        {
            if (flight.Failure == null)
            {
                H("A good flight");
                P($"The radar saw her peak at {flight.Radar:0.0} km.");
                var est = prog.Estimate(load);
                S($"The drawing office said {est.low}-{est.high} km.");
                if (flight.Radar > prog.RangeRecord) S("A new range record.");
                P($"She came down {flight.Range:0.0} km downrange, {Round.SideText(flight.Cross, " km")} of the line{(flight.WreckFound ? "; the recovery party found her crater." : "; they never found her.")}");
                if (flight.WreckFound) foreach (var l in Wac.Wreck["nominal"]) S("· " + l);
                Gap(14);
                if (call == null) { call = "nominal"; Say("ellis", "Nice work. That's what she's for.", "go"); }
                if (B("Close the round")) Later(() => { CloseRound(); });
                return;
            }
            H("She didn't make it");
            P($"She came down {flight.Range:0.0} km downrange, {Round.SideText(flight.Cross, " km")} of the line.");
            if (flight.WreckFound) { S("The recovery party found her. What they saw:"); foreach (var l in Wac.Wreck[flight.Failure]) S("· " + l); }
            else P("We searched the scrub for three hours on the radar's last fix and never found her. Whatever is left of her stays out there.");
            Rule();
            if (call == null)
            {
                S("Your call: what brought her down?");
                foreach (var c in new[] { "ignition", "weld", "leak", "unknown" })
                    if (B(Wac.Explanations[c])) Later(() => { MakeCall(c); });
                return;
            }
            S($"You called it {Wac.Short[call]}.");
            if (fixAdopted != null) S("Adopted: " + fixAdopted);
            Rule();
            H("The investigation");
            foreach (var l in investigation) P(l);
            Gap(10);
            if (B("Close the round")) Later(() => { CloseRound(); });
        }

        void RoundEndPanel()
        {
            var f = prog.Flights[prog.Flights.Count - 1];
            H(f.Failure == null ? $"{def.Name}: {f.Apogee:0.0} km" : $"{def.Name}: lost");
            S(f.Failure == null ? "A good flight." : $"Lost to {Wac.Short[f.Failure]}{(f.Hidden ? ", a fault no inspection could have found" : "")}.");
            S(lateDays > 0 ? $"Flew {lateDays} day{(lateDays > 1 ? "s" : "")} late." : "Flew on time.");
            Rule();
            S("The crew's hours:");
            foreach (var it in slot.Items) S($"· {Slot.HoursText(it.hours)}: {it.what}");
            S($"Total {Slot.HoursText(slot.Spent)} of {Slot.HoursText(slot.Budget)}.");
            Rule();
            S($"Standing: {(standingChange > 0 ? "+" : "")}{standingChange} this round, {prog.Standing} in all.");
            if (prog.LateMark()) N("Two of your last three rounds flew late. That costs you a point.");
            Gap(16);
            if (B(roundIndex + 1 < Campaign.Season.Length ? "On to the next round" : "The season's end")) Later(() => { NextRound(); });
        }

        void SeasonPanel()
        {
            H("The season at White Sands");
            foreach (var f in prog.Flights)
                S($"· {f.Name}: {(f.Failure == null ? $"{f.Apogee:0.0} km" : "lost, " + Wac.Short[f.Failure])}{(f.Late ? ", late" : "")}");
            Rule();
            S($"Range record: {prog.RangeRecord:0.0} km. Standing: {prog.Standing}.");
            foreach (var c in prog.Adopted) S("· " + Programme.FixText[c]);
            Gap(16);
            if (B("Play the season again")) Later(() => { NewSeason(Environment.TickCount & 0x7fffffff); });
        }

        // ---------------- The range plot ----------------
        void RangePlot(Rect r)
        {
            Ui.Box(r, new Color(0.05f, 0.07f, 0.05f, 0.9f));
            Ui.Frame(r, Ui.Hex("#6a7a4a"));
            double maxX = Math.Max(30, flight.Range * 1.15), maxH = Math.Max(30, Math.Max(prog.RangeRecord, flight.Apogee) * 1.15);
            float x0 = r.x + Px(44), x1 = r.xMax - Px(12), y0 = r.yMax - Px(28), y1 = r.y + Px(30);
            Vector2 At(double x, double h) => new Vector2(Mathf.Lerp(x0, x1, (float)(x / maxX)), Mathf.Lerp(y0, y1, (float)(h / maxH)));
            var grid = new Color(0.3f, 0.45f, 0.3f, 0.5f);
            for (int k = 0; k <= 4; k++)
            {
                Ui.Line(At(0, maxH * k / 4), At(maxX, maxH * k / 4), grid);
                Ui.Label(new Rect(r.x + Px(4), At(0, maxH * k / 4).y - Px(10), Px(40), Px(20)), $"{maxH * k / 4:0}", Ui.Small, Ui.Hex("#9fc08a"));
            }
            foreach (var old in prog.Flights.Where(f => f.Trace != null).Skip(Math.Max(0, prog.Flights.Count - 3)))
                Ui.Lines(old.Trace.Select(p => At(p.X, p.H)).ToList(), new Color(0.5f, 0.6f, 0.45f, 0.45f));
            var now = beat == Beat.Flight ? PlotPoint(Math.Min(flightT, path.ImpactT)) : flight.Path[flight.Path.Count - 1];
            var pts = flight.Path.Where(p => p.T < now.T).Select(p => At(p.X, p.H)).ToList();
            pts.Add(At(now.X, now.H));
            Ui.Lines(pts, Ui.Hex("#9cff7a"));
            Ui.Label(new Rect(r.x + Px(10), r.y + Px(4), r.width, Px(24)), $"RANGE PLOT · T+{now.T:0} s · alt {now.H:0.0} km · downrange {now.X:0.0} km", Ui.Small, Ui.Hex("#c8f0a8"));
            Ui.Label(new Rect(x1 - Px(120), y0 + Px(4), Px(120), Px(20)), $"{maxX:0} km", Ui.Small, Ui.Hex("#9fc08a"));
        }
    }
}
