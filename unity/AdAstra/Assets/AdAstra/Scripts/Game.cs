// AD ASTRA: THE WAC CORPORAL PROGRAMME, an HD-2D prototype in Unity. One season at White Sands, 1945-1946: four
// rounds. Each round: plan it, look the stage over in the hangar (or send the crew), static-fire it on the stand, lay
// the tower against the morning wind, run the count in the blockhouse, fly it, and call what went wrong.
// The rules are a port of the Electron game's (js/truth, js/world); the hidden truth lives in Scripts/Truth.
using System;
using System.Collections.Generic;
using System.Linq;
using AdAstra.Truth;
using AdAstra.World;
using UnityEngine;

namespace AdAstra
{
    public static class Boot
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start()
        {
            if (UnityEngine.Object.FindAnyObjectByType<Game>() != null) return;
            foreach (var c in UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsSortMode.None)) UnityEngine.Object.Destroy(c.gameObject);
            foreach (var l in UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None)) UnityEngine.Object.Destroy(l.gameObject);
            new GameObject("Ad Astra WAC").AddComponent<Game>();
        }
    }

    public enum Beat { Title, Arrive, Brief, CrewInspect, Hangar, Stand, Morning, Count, Flight, Review, RoundEnd, SeasonEnd }

    public sealed class LogLine { public string Time, Who, Text, Tone; }

    public sealed partial class Game : MonoBehaviour
    {
        // Inspectors (game.js INSPECTORS, world/people.js TRAITS)
        static readonly Dictionary<string, (string name, double hours, double hit, double fa)> Inspectors =
            new Dictionary<string, (string, double, double, double)>
            {
                ["you"] = ("You", 0, 0, 0),
                ["kowalski"] = ("Sgt. Kowalski", 5, 0.9, 0.1),
                ["delgado"] = ("Pvt. Delgado", 2, 0.6, 0.3),
            };

        Site site;
        PixelView view;
        Plumes plumes;
        Sounds sound;
        int lastBalloon;

        public Beat beat = Beat.Title;
        Programme prog;
        int gameSeed, roundIndex;
        RoundDef def;
        Round round;
        Slot slot;
        DateTime day;
        double clock;                 // minutes since midnight
        public float speed = 1;
        string objective = "";

        // What the player did this round (for the investigation)
        string inspector = "you";
        double load = 1;
        readonly Dictionary<string, bool> looked = new Dictionary<string, bool>();
        readonly Dictionary<string, Round.Reading> metered = new Dictionary<string, Round.Reading>();
        readonly HashSet<string> flagged = new HashSet<string>();
        string selectedSpot;
        List<string> crewFlags;
        int lateDays, scrubs;
        bool reworked, slotCharged;
        bool lastLost;

        // The stand
        List<TracePoint> trace;
        float fireT = -1;
        bool fired;

        // The decay test
        class Decay { public string Where; public double Minutes; public (double leak, double drift) Rates; public int Temp; public List<Vector2> Points = new List<Vector2>(); }
        Decay decay;
        readonly List<(string where, int minutes, double change, bool tight)> decays = new List<(string, int, double, bool)>();

        // The count
        class Count
        {
            public double T = 600, WindowEnd, Pressurised;
            public int Next;
            public bool Held, AwaitFire, Relaying, LeakHunt;
            public string Poll;
            public double Lay;
            public int Balloon; public string BalloonAt = "dawn";
            public double Busy;       // range minutes left on a crew errand while held
            public double RelayTo;
        }
        Count count;
        readonly List<(double at, double value, bool go)> reads = new List<(double, double, bool)>();
        double lay;

        // The flight
        Flight flight;
        float flightT;
        string call;                  // the player's call at the review
        List<string> investigation;
        string fixAdopted;
        int standingChange;

        public readonly List<LogLine> Log = new List<LogLine>();
        readonly Dictionary<string, (string text, float until, string tone)> bubbles = new Dictionary<string, (string, float, string)>();

        void Awake()
        {
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 1;
            site = new Site();
            view = new PixelView(site.Sky);
            view.Cam.depthTextureMode = DepthTextureMode.Depth;   // for the soft edges of the smoke
            plumes = new Plumes();
            sound = new Sounds(view.Cam.gameObject);
            view.Go(site.Views["site"], true);
            gameSeed = Environment.TickCount & 0x7fffffff;
            BuildHud();
            BotAwake();
        }

        // ---------------- The season ----------------
        public void NewSeason(int seed)
        {
            gameSeed = seed;
            prog = new Programme();
            roundIndex = 0;
            lastLost = false;
            StartRound();
        }

        void StartRound()
        {
            def = Campaign.Season[roundIndex];
            round = Round.Create(gameSeed * 31 + roundIndex * 977 + 13, prog);
            slot = new Slot(lastLost ? Slot.RebuildHours : 0);
            day = def.Start; clock = 8 * 60;
            looked.Clear(); metered.Clear(); flagged.Clear(); crewFlags = null; selectedSpot = null;
            lateDays = 0; scrubs = 0; reworked = false; slotCharged = false;
            trace = null; fireT = -1; fired = false; decay = null; decays.Clear();
            count = null; reads.Clear(); flight = null; call = null; investigation = null; fixAdopted = null; standingChange = 0;
            inspector = "you"; load = 1;
            Log.Clear(); bubbles.Clear();
            ClearFx(); site.ResetRocket(); site.LayTower(0);
            site.StandFlame.gameObject.SetActive(false); site.StandLight.intensity = 0;
            foreach (var p in site.People.Values) p.Hide();
            SetBeat(Beat.Arrive);
        }

        void SetBeat(Beat b)
        {
            beat = b;
            scroll = Vector2.zero;
            var P = site.People;
            switch (b)
            {
                case Beat.Arrive:
                    view.Go(site.Views["site"]);
                    objective = $"{def.Name[0].ToString().ToUpper()}{def.Name.Substring(1)}.";
                    break;
                case Beat.Brief:
                    view.Go(site.Views["site"]);
                    P["ellis"].Put(Site.OfficeAt + new Vector3(-3, 0, 5)); P["kowalski"].Put(Site.OfficeAt + new Vector3(0, 0, 5.5f));
                    P["delgado"].Put(Site.OfficeAt + new Vector3(2.4f, 0, 5)); P["you"].Put(Site.OfficeAt + new Vector3(-0.8f, 0, 8));
                    P["morgan"].Put(Site.OfficeAt + new Vector3(6, 0, 4));
                    objective = "Plan the round: who looks her over, and how much propellant she carries.";
                    Say("kowalski", Wac.Brief);
                    break;
                case Beat.Hangar:
                case Beat.CrewInspect:
                    view.Go(site.Views["hangar"], true);
                    foreach (var p in P.Values) p.Hide();
                    P["kowalski"].Put(Site.HangarRoom + new Vector3(-6.5f, 0, 4.2f));
                    P["delgado"].Put(Site.HangarRoom + new Vector3(6.2f, 0, 3.6f));
                    if (b == Beat.Hangar)
                    {
                        P["you"].Put(Site.HangarRoom + new Vector3(0.8f, 0, -1.8f));
                        objective = "Look the stage over. Every look and every test comes out of the crew's hours.";
                        Say("kowalski", Wac.InspectIntro.Replace("Kowalski hands you", "Here's"), "");
                    }
                    break;
                case Beat.Stand:
                    view.Go(site.Views["stand"], true);
                    foreach (var p in P.Values) p.Hide();
                    P["ellis"].Put(Site.StandAt + new Vector3(-10, 0, -10)); P["you"].Put(Site.StandAt + new Vector3(-8, 0, -12));
                    P["kowalski"].Put(Site.StandAt + new Vector3(4, 0, -5)); P["delgado"].Put(Site.StandAt + new Vector3(6.5f, 0, -4));
                    objective = "Static fire: an 8-second start-up firing on the stand. Read the traces against the red-line card.";
                    Say("ellis", "Stage is on the stand and pressurised. Your firing.");
                    break;
                case Beat.Morning:
                    view.Go(site.Views["morning"], true);
                    foreach (var p in P.Values) p.Hide();
                    P["vega"].Put(Site.TowerAt + new Vector3(-4, 0, -6)); P["kowalski"].Put(Site.TowerAt + new Vector3(4, 0, -6));
                    P["morgan"].Put(Site.BlockhouseAt + new Vector3(6, 0, 4)); P["you"].Put(Site.BlockhouseAt + new Vector3(8, 0, 1));
                    P["ellis"].Put(Site.BlockhouseAt + new Vector3(4, 0, 6));
                    objective = "Launch morning. The tower is laid on the dawn balloon. When you are ready, go in for the count.";
                    break;
                case Beat.Count:
                    view.Go(site.Views["blockhouse"], true);
                    foreach (var p in P.Values) p.Hide();
                    var R = Site.BlockhouseRoom;
                    P["ellis"].Put(R + new Vector3(-1.2f, 0, 2.3f), true); P["you"].Put(R + new Vector3(1.6f, 0, 2.3f), true);
                    P["vega"].Put(R + new Vector3(3.8f, 0, 2.0f), true); P["morgan"].Put(R + new Vector3(-4.6f, 0, -0.6f));
                    objective = "The count. You answer for tank pressure. You can call a hold at any time.";
                    break;
                case Beat.Flight:
                    foreach (var p in P.Values) p.Hide();
                    break;
                case Beat.Review:
                    view.Go(site.Views["site"], true);
                    P["ellis"].Put(Site.OfficeAt + new Vector3(-3, 0, 5)); P["you"].Put(Site.OfficeAt + new Vector3(-0.8f, 0, 8));
                    P["morgan"].Put(Site.OfficeAt + new Vector3(3, 0, 5)); P["kowalski"].Put(Site.OfficeAt + new Vector3(5.5f, 0, 6));
                    objective = flight.Failure == null ? "The review: what the radar saw." : "The review: what brought her down?";
                    break;
                case Beat.RoundEnd:
                case Beat.SeasonEnd:
                    view.Go(site.Views["site"]);
                    break;
            }
        }

        // ---------------- Words ----------------
        static readonly Dictionary<string, string> Names = new Dictionary<string, string>
        {
            ["you"] = "You", ["ellis"] = "Ellis", ["kowalski"] = "Sgt. Kowalski", ["delgado"] = "Pvt. Delgado",
            ["vega"] = "Vega", ["morgan"] = "Capt. Morgan", [""] = "",
        };

        public void Say(string who, string text, string tone = "", float seconds = 6)
        {
            Log.Add(new LogLine { Time = ClockText(), Who = Names.TryGetValue(who, out var n) ? n : who, Text = text, Tone = tone });
            if (Log.Count > 60) Log.RemoveAt(0);
            if (who != "") bubbles[who] = (text, Time.time + seconds, tone);
            // Calls on the net (the count, the range, the flight) come with the squelch of the field telephone.
            if (who != "" && who != "you" && (beat == Beat.Count || beat == Beat.Flight || beat == Beat.Morning)) sound?.Squelch();
        }

        void Note(string text) => Say("", text, "note");

        string ClockText() { int m = (int)clock % 1440; return $"{m / 60:00}:{m % 60:00}"; }
        string DateText() => day.ToString("dddd d MMMM yyyy", System.Globalization.CultureInfo.InvariantCulture).ToUpper();

        void NextDay(int days = 1) { day = day.AddDays(days); clock = 7 * 60; }

        // ---------------- The plan ----------------
        public void FinishPlan(string who, double propellant)
        {
            inspector = who; load = propellant; round.Load = load;
            var ins = Inspectors[who];
            Note($"Your plan: {(who == "you" ? "you look her over yourself" : ins.name + " looks her over")}; {load * 100:0}% propellant load.");
            if (who == "you") { clock += 30; SetBeat(Beat.Hangar); return; }
            slot.Spend(ins.hours, $"{ins.name}'s inspection");
            clock += ins.hours * 60;
            crewFlags = round.CrewInspect(ins.hit, ins.fa);
            foreach (var id in crewFlags) flagged.Add(id);
            var real = crewFlags.Where(id => round.FaultAt(id) != null).ToList();
            double h = round.FlagSpots(crewFlags);
            slot.Spend(h, "working the flags");
            clock += h * 60;
            SetBeat(Beat.CrewInspect);
            var names = crewFlags.Select(id => Wac.SpotById(id).Name.ToLower()).ToList();
            Say(who, crewFlags.Count > 0 ? $"I didn't like the look of the {string.Join(" and the ", names)}. We opened {(crewFlags.Count == 1 ? "it" : "them")} up." : "She looks clean to me. Buttoned her up.");
            if (crewFlags.Count > 0) Say("kowalski", ReportOnFlags(crewFlags, real), real.Count > 0 ? "go" : "");
        }

        static string ReportOnFlags(List<string> ids, List<string> real)
        {
            if (real.Count == 0) return "Nothing wrong with any of it. That was a day's work for nothing.";
            var r = string.Join(" and the ", real.Select(id => Wac.SpotById(id).Name.ToLower()));
            return ids.Count == real.Count ? $"Good call. The {r} had a real fault. Fixed." : $"The {r} had a real fault, fixed. The rest was sound.";
        }

        // ---------------- The hangar ----------------
        public void LookAt(string id)
        {
            if (looked.ContainsKey(id)) return;
            looked[id] = round.Cues[id];
            clock += 15;
            var s = Wac.SpotById(id);
            slot.Spend(0.25, $"a close look at the {s.Name.ToLower()}");
            Note($"{s.Name}: {(round.Cues[id] ? s.Cue : s.Sound)}");
        }

        public void MeterSpot(string id)
        {
            var s = Wac.SpotById(id); var m = Wac.MeterFor(s);
            if (m == null || metered.ContainsKey(id)) return;
            var r = round.MeterReading(id);
            metered[id] = r;
            clock += m.Minutes;
            slot.Spend(m.Minutes / 60.0, $"{m.Name.ToLower()} on the {s.Name.ToLower()}");
            Note($"{s.Name}, {m.Name.ToLower()}: {r.Value} {m.Unit} (limit {(m.Low ? "all " : "")}{m.Limit}).");
        }

        public void ToggleFlag(string id) { if (!flagged.Remove(id)) flagged.Add(id); }

        public void FinishInspection()
        {
            var ids = flagged.ToList();
            var real = ids.Where(id => round.FaultAt(id) != null).ToList();
            double h = round.FlagSpots(ids);
            slot.Spend(h, "working your flags");
            clock += h * 60;
            if (ids.Count > 0)
            {
                Note($"You flagged: {string.Join(", ", ids.Select(id => Wac.SpotById(id).Name.ToLower()))}.");
                Say("kowalski", ReportOnFlags(ids, real), real.Count > 0 ? "go" : "");
            }
            else Say("kowalski", "Nothing flagged? Buttoning her up, then.");
            ToStand();
        }

        public void ToStand() { NextDay(); SetBeat(Beat.Stand); }

        // ---------------- The stand ----------------
        public void Fire()
        {
            if (fired) return;
            fired = true; fireT = 0;
            trace = round.StaticFire();
            Say("ellis", "Firing in three, two, one. Fire.", "go");
            clock += 20;
        }

        public void ReworkIgniter()
        {
            if (reworked) return;
            reworked = true; lateDays += 1;
            round.ReworkIgniter();
            Say("kowalski", "An igniter rework. That puts the launch back a day.", "warn");
            Note("The crew spent the day reworking the igniter in the hangar.");
        }

        public void RollOut()
        {
            NextDay(reworked ? 2 : 1);
            clock = 7 * 60;
            if (!slotCharged)
            {
                slotCharged = true;
                if (slot.DaysOver > 0)
                {
                    lateDays += slot.DaysOver;
                    Say("morgan", $"Your crew ran {Slot.HoursText(slot.Overrun)} past their hours. The range gave the slot away: the round waits {slot.DaysOver} day{(slot.DaysOver > 1 ? "s" : "")}.", "bad");
                    day = day.AddDays(slot.DaysOver);
                }
            }
            MorningBalloon();
            SetBeat(Beat.Morning);
        }

        void MorningBalloon()
        {
            double dawn = 7 * 60;
            int b = round.BalloonAt(DayMinute(dawn));
            lay = Round.LayFor(b);
            site.LayTower((float)lay);
            Say("morgan", $"Dawn balloon: crosswind {Math.Abs(b)} km/h{(b != 0 ? $", toward the {(b > 0 ? "east" : "west")}" : "")}. The crew laid the tower {Round.SideText(lay, "°")} on it.");
        }

        // The wind is a function of the campaign minute, so each day has its own.
        double DayMinute(double minuteOfDay) => (day - new DateTime(1945, 1, 1)).TotalDays * 1440 + minuteOfDay;

        // ---------------- The decay test ----------------
        public void DecayStart(string where)
        {
            if (decay != null) return;
            decay = new Decay { Where = where, Rates = round.DecayRates(clock % 1440), Temp = round.AirTemp(clock % 1440) };
            Say("you", "Isolate the tank. Valve closed. Watch the needle.");
        }

        public double DecayNow => decay == null ? 0 : round.DecayReading(decay.Rates, decay.Minutes);

        void TickDecay(float dt)
        {
            if (decay == null) return;
            double step = dt * speed * 1.0; // a game minute per real second at 1x
            decay.Minutes += step;
            if (decay.Where == "count") { clock += step; }
            else clock += step;
            if (decay.Points.Count == 0 || decay.Points[decay.Points.Count - 1].x < (float)Math.Floor(decay.Minutes))
                decay.Points.Add(new Vector2((float)Math.Floor(decay.Minutes), (float)DecayNow));
        }

        public void DecayCall(bool tight)
        {
            if (decay == null) return;
            double change = DecayNow - Round.DecayStart;
            int watched = (int)Math.Round(decay.Minutes);
            string where = decay.Where;
            if (where == "stand") slot.Spend(decay.Minutes / 60, "the decay test");
            Note($"Decay test {(where == "count" ? "in the hold" : "on the stand")}: {watched} min locked up, the needle moved {(change >= 0 ? "+" : "")}{change:0.00} bar (air {decay.Temp}°C). You called it {(tight ? "tight" : "a leak")}.");
            decays.Add((where, watched, change, tight));
            decay = null;
            if (tight) { Say("you", "Tight. Open the regulator."); return; }
            if (where == "count") { count.LeakHunt = true; count.Busy = 45; Say("you", "I think she's leaking. Pad crew, go over the feed system.", "warn"); return; }
            var r = round.LeakCheck();
            slot.Spend(r.hours, fired ? "finding the leak after the firing" : "leak check before the firing");
            clock += r.hours * 60;
            Say("kowalski", r.found != null ? $"Found it: the {r.found.ToLower()}. Fixed." : "Nothing leaking that we can find.", r.found != null ? "go" : "");
        }

        // ---------------- The count ----------------
        public void StartCount()
        {
            clock = 9 * 60;
            count = new Count { WindowEnd = clock + 120, Lay = lay };
            reads.Clear();
            SetBeat(Beat.Count);
            Say("ellis", "All stations, this is the blockhouse. We are picking up the count at T minus ten minutes.");
        }

        struct Step { public double At; public string Who; public Func<string> Text; public string Poll; public bool Balloon; public string Tone; }
        List<Step> script;
        List<Step> Script()
        {
            if (script != null) return script;
            script = new List<Step>
            {
                new Step { At = 600, Who = "vega", Text = () => "Pad crew at the tower. Final arming under way." },
                new Step { At = 540, Who = "morgan", Text = () => BalloonCall("T-9:00"), Balloon = true },
                new Step { At = 450, Who = "ellis", Text = () => "PRESS, report tank pressure.", Poll = "tank" },
                new Step { At = 360, Who = "vega", Text = () => "Arming complete. Pad crew coming in." },
                new Step { At = 240, Who = "ellis", Text = () => "Tower is clear. Doors closing." },
                new Step { At = 200, Who = "morgan", Text = () => BalloonCall("T-3:20"), Balloon = true },
                new Step { At = 180, Who = "morgan", Text = () => "Range is clear. Range is go.", Tone = "go" },
                new Step { At = 120, Who = "ellis", Text = () => "PRESS, tank pressure and igniter circuit for the last time.", Poll = "final" },
                new Step { At = 60, Who = "vega", Text = () => "One minute." },
                new Step { At = 30, Who = "vega", Text = () => "Thirty seconds. Cameras and recorders running." },
            };
            for (int n = 10; n >= 1; n--) { int k = n; script.Add(new Step { At = k, Who = "vega", Text = () => $"{k}..." }); }
            return script;
        }

        string BalloonCall(string when)
        {
            int cross = round.BalloonAt(DayMinute(clock));
            count.Balloon = cross; count.BalloonAt = when;
            return $"Balloon at {when}: crosswind {Math.Abs(cross)} km/h{(cross != 0 ? $", toward the {(cross > 0 ? "east" : "west")}" : "")}. Tower is laid {Round.SideText(count.Lay, "°")}.";
        }

        public double TankNow => round.TankGauge(count?.Pressurised ?? 0);

        void TickCount(float dt)
        {
            var c = count;
            if (c == null) return;
            double rangeMin;
            if (c.Busy > 0)
            {
                // A crew errand: the range clock runs on in game minutes while they work.
                double step = dt * speed * 2.0;
                c.Busy -= step; clock += step; c.Pressurised += step * 60;
                if (c.Busy <= 0) FinishErrand();
                rangeMin = 0;
            }
            else if (c.Held || c.Poll != null || c.AwaitFire || decay != null)
            {
                rangeMin = decay != null ? 0 : dt * speed * 0.25;
                clock += rangeMin; c.Pressurised += rangeMin * 60;
            }
            else
            {
                // The count runs five times quicker than life until the last minute, then in real seconds, so ten minutes
                // of count takes about three at 1x. The speed buttons multiply it.
                double s = dt * speed * (c.T > 60 ? 5 : 1);
                c.T = Math.Max(0, c.T - s); clock += s / 60; c.Pressurised += s;
                var sc = Script();
                while (c.Next < sc.Count && sc[c.Next].At >= c.T)
                {
                    var st = sc[c.Next++];
                    Say(st.Who, st.Text(), st.Tone ?? "", 5);
                    if (st.At <= 10) sound.Beep();
                    if (st.Poll != null) { c.Poll = st.Poll; break; }
                }
                if (c.T <= 0 && !c.AwaitFire) { c.AwaitFire = true; Say("vega", "Zero. Fire on your hand.", "go"); }
            }
            if (clock >= c.WindowEnd && !c.AwaitFire) Scrub();
        }

        public void Answer(bool go)
        {
            var c = count; if (c?.Poll == null) return;
            double v = TankNow;
            reads.Add((c.T, v, go));
            Say("you", go ? $"PRESS is go. Tank {v:0.0} bar." : $"Hold, hold, hold. Tank reads {v:0.0} bar.", go ? "go" : "warn");
            c.Poll = null;
            if (!go) Hold();
        }

        public void Hold()
        {
            var c = count; if (c == null || c.Held) return;
            c.Held = true; c.Poll = null;
            Say("ellis", $"Hold. We are holding at T-{TText(c.T)}.", "warn");
        }

        public void Resume()
        {
            var c = count; if (c == null || !c.Held || c.Busy > 0 || decay != null) return;
            c.Held = false;
            Say("ellis", $"Resuming the count at T-{TText(c.T)}.", "go");
        }

        public void ReleaseBalloon()
        {
            var c = count; if (c == null || !c.Held || c.Busy > 0) return;
            c.Busy = 10; c.Relaying = false;
            Say("you", "Range, give me another balloon.");
        }

        public void Relay(double to)
        {
            var c = count; if (c == null || !c.Held || c.Busy > 0) return;
            c.RelayTo = Math.Max(-Round.MaxLay, Math.Min(Round.MaxLay, Math.Round(to * 2) / 2));
            c.Relaying = true; c.Busy = 30;
            Say("you", $"Pad crew, re-lay the tower to {Round.SideText(c.RelayTo, "°")}.", "warn");
            Note($"T-{TText(c.T)}: held, and sent the pad crew out to re-lay the tower from {Round.SideText(c.Lay, "°")} to {Round.SideText(c.RelayTo, "°")}.");
        }

        void FinishErrand()
        {
            var c = count;
            c.Busy = 0;
            if (c.Relaying)
            {
                c.Relaying = false; c.Lay = c.RelayTo; lay = c.Lay; site.LayTower((float)lay);
                c.T = Math.Max(c.T, 450); c.Next = Script().FindIndex(s => s.At <= c.T);
                if (c.Next < 0) c.Next = Script().Count;
                Say("vega", $"Tower laid {Round.SideText(c.Lay, "°")}. Coming in. The count recycles to T-{TText(c.T)}.", "go");
            }
            else if (c.LeakHunt)
            {
                c.LeakHunt = false;
                var r = round.LeakCheck();
                c.Pressurised = 0;
                Say("kowalski", r.found != null ? $"Found it: the {r.found.ToLower()}. Fixed, and she's pressurised again." : "Went over every line. Nothing leaking.", r.found != null ? "go" : "");
            }
            else
            {
                int cross = round.BalloonAt(DayMinute(clock));
                c.Balloon = cross; c.BalloonAt = ClockText();
                Say("morgan", $"Balloon at {ClockText()}: crosswind {Math.Abs(cross)} km/h{(cross != 0 ? $", toward the {(cross > 0 ? "east" : "west")}" : "")}. That would want the tower at {Round.SideText(Round.LayFor(cross), "°")}.");
            }
        }

        void Scrub()
        {
            Say("morgan", "That is the range window gone. We are scrubbed for today.", "bad", 7);
            Note($"The count was scrubbed at T-{TText(count.T)}: the range window closed before she could fly. The launch waits a day.");
            count = null; decay = null;
            lateDays += 1; scrubs += 1;
            NextDay();
            MorningBalloon();
            SetBeat(Beat.Morning);
        }

        public static string TText(double t) { int s = (int)Math.Ceiling(t); return $"{s / 60}:{s % 60:00}"; }

        public void FireRound()
        {
            var c = count; if (c == null || !c.AwaitFire) return;
            double cross = round.CrosswindAt(DayMinute(clock));
            lastBalloon = c.Balloon;
            flight = round.Fly(c.Lay, cross);
            count = null;
            Say("vega", "Fire!", "go");
            StartFlight(c.Lay, cross);
        }

        // ---------------- The review ----------------
        public void MakeCall(string cause)
        {
            if (call != null) return;
            call = cause;
            string truth = flight.Failure ?? "nominal";
            Say("you", Wac.Explanations[cause]);
            if (flight.Failure == null) { }
            else if (round.Hidden) Say("ellis", cause == truth ? "Maybe. But nothing we did on the ground could have caught it." : "I don't think so. And nothing on the ground showed it either.");
            else if (cause == truth)
            {
                fixAdopted = prog.Adopt(cause);
                Say("ellis", fixAdopted != null ? $"Agreed. {fixAdopted}" : "Agreed. We already fixed that, and it still got through.", "go");
            }
            else if (cause == "unknown") Say("ellis", "Then we fly the next one blind. I don't like it.", "warn");
            else Say("ellis", "I'm not sure that's it. We'll make the change, but I have my doubts.", "warn");
            investigation = Investigate();
        }

        // THE INVESTIGATION (game.js investigate): where the cause could have been caught.
        List<string> Investigate()
        {
            var lines = new List<string>();
            string cause = flight.Failure;
            if (cause == null) return lines;
            if (round.Hidden) { lines.Add($"The investigation found {Wac.Short[cause]} in a part that had passed every test. Nothing on the ground would have caught it."); return lines; }
            if (cause == "weld" || cause == "leak")
            {
                var id = round.Faults.FirstOrDefault(kv => kv.Value == cause).Key;
                var spot = id != null ? Wac.SpotById(id) : null;
                if (spot != null)
                {
                    bool cue = round.Cues[id];
                    lines.Add(!looked.ContainsKey(id)
                        ? $"In the hangar: the fault was at the {spot.Name.ToLower()}, and nobody looked closely at it.{(cue ? $" A look would have shown this: \"{spot.Cue}\"" : " Even a close look would have shown nothing.")}"
                        : cue ? $"In the hangar: you looked at the {spot.Name.ToLower()} and saw this: \"{spot.Cue}\" That was the fault{(flagged.Contains(id) ? "." : ", and it was not flagged.")}"
                              : $"In the hangar: you looked at the {spot.Name.ToLower()} and it looked sound. It was not.");
                    var m = Wac.MeterFor(spot);
                    var read = metered.TryGetValue(id, out var rr) ? rr : round.MeterReading(id);
                    lines.Add(metered.ContainsKey(id)
                        ? $"The test kit read {read.Value} {m.Unit} on it (limit {(m.Low ? "all " : "")}{m.Limit})."
                        : $"The test kit was never put on it. It would have read {read.Value} {m.Unit} (limit {(m.Low ? "all " : "")}{m.Limit}).");
                }
            }
            if (cause == "ignition")
            {
                TracePoint? low = null;
                if (trace != null) foreach (var p in trace) if (p.T >= 0.7f && p.T <= 6.8f && (p.Pc < Wac.PcLo || p.Pc > Wac.PcHi)) { low = p; break; }
                lines.Add(low.HasValue
                    ? $"On the stand: the chamber pressure trace read {low.Value.Pc:0.0} bar at {low.Value.T:0.0} s, outside the {Wac.PcLo} to {Wac.PcHi} on the red-line card. That was the fault showing itself."
                    : "On the stand: the trace stayed inside its red lines. The firing did not show it.");
                lines.Add(reworked ? "The rework was asked for, but it did not cure this." : "The rework (rework the igniter) was there to be asked for.");
            }
            if (cause == "leak")
            {
                if (trace != null) foreach (var p in trace) if (p.Tank < Wac.TankLo) { lines.Add($"On the stand: the tank trace was down to {p.Tank:0.0} bar at {p.T:0.0} s."); break; }
                foreach (var d in decays)
                    lines.Add($"The decay test {(d.where == "count" ? "in the count" : "on the stand")}: the needle moved {(d.change >= 0 ? "+" : "")}{d.change:0.00} bar in {d.minutes} min, and you called it {(d.tight ? "tight" : "a leak")}.");
                foreach (var r in reads) if (r.value < Wac.TankLo) { lines.Add($"In the count: at T-{TText(r.at)} the tank read {r.value:0.0} bar, under the red line, and the call was {(r.go ? "GO" : "HOLD")}."); break; }
            }
            if (lines.Count == 0) lines.Add($"The investigation found {Wac.Short[cause]}. Nothing you could see pointed to it.");
            return lines;
        }

        public void CloseRound()
        {
            bool late = lateDays > 0;
            prog.Record(new FlownRound
            {
                Id = def.Id, Name = def.Name, Failure = flight.Failure, Hidden = round.Hidden, Load = load, Late = late,
                Apogee = flight.Failure == null ? flight.Radar : (double?)null, Trace = flight.Path,
            });
            standingChange = flight.Failure == null ? 1 : 0;
            if (prog.LateMark()) standingChange -= 1;
            prog.Standing += standingChange;
            lastLost = flight.Failure != null;
            SetBeat(Beat.RoundEnd);
        }

        public void NextRound()
        {
            roundIndex++;
            if (roundIndex >= Campaign.Season.Length) { SetBeat(Beat.SeasonEnd); return; }
            StartRound();
        }

        // ---------------- The frame ----------------
        // Buttons act between frames, not in the middle of a GUI pass: changing the clipboard while IMGUI is still laying
        // it out breaks the layout ("Getting control N's position in a group with only N controls").
        readonly List<Action> later = new List<Action>();
        void Later(Action a) { later.Add(a); sound?.Click(); }

        void Update()
        {
            if (later.Count > 0) { var run = later.ToArray(); later.Clear(); foreach (var a in run) a(); }
            float dt = Time.deltaTime;
            if (beat == Beat.Stand && fireT >= 0) TickFiring(dt);
            TickDecay(dt);
            if (beat == Beat.Count) TickCount(dt);
            if (beat == Beat.Count && count != null) site.SetClock(count.AwaitFire ? "T-0:00" : $"T-{TText(count.T)}", count.Held);
            if (beat == Beat.Flight) TickFlight(dt);
            TickFx(dt);
            bool inside = beat == Beat.Hangar || beat == Beat.CrewInspect || beat == Beat.Count;
            sound.Place(inside, beat == Beat.Count);
            if (beat != Beat.Flight && !(beat == Beat.Stand && fireT >= 0)) sound.Motor(false, 0);
            sound.Tick(dt);
            if (beat == Beat.Title) TitleOrbit(dt);
            view.Tick(dt, !BotRunning);
            foreach (var p in site.People.Values) if (p.Shown) p.Tick(view.Cam, dt);
        }

        void LateUpdate()
        {
            RefreshHud();
            int frame = Mathf.FloorToInt(Time.time * 18);
            float blur = beat == Beat.Hangar || beat == Beat.Count || beat == Beat.CrewInspect ? 5f : 7f;
            view.Render(frame, 0.85f, beat == Beat.Flight || beat == Beat.Stand ? 1.4f : 0.9f, blur);
        }

        float orbit;
        void TitleOrbit(float dt)
        {
            orbit += dt * 4;
            var c = Site.TowerAt + new Vector3(0, 10, 0);
            var off = Quaternion.Euler(0, orbit, 0) * new Vector3(60, 22, -90);
            view.Follow(c, c + off, 40);
        }

        float standDebt;
        void TickFiring(float dt)
        {
            fireT += dt;
            bool on = fireT > 0.1f && fireT < 8.1f;
            site.StandFlame.gameObject.SetActive(on);
            site.StandLight.intensity = on ? 3.5f : 0;
            if (on) site.StandFlame.localScale = new Vector3(1, 0.9f + 0.1f * Mathf.PerlinNoise(Time.time * 9, 0), 1);
            if (fireT - dt <= 0.1f && fireT > 0.1f) sound.Ignite();
            sound.Motor(on, (view.Cam.transform.position - site.StandStage.position).magnitude);
            if (on)
            {
                // Into the flame pit and out along the trench: fire at the pit mouth, then the brown acid cloud.
                var pit = site.StandStage.position + new Vector3(0, -0.5f, 0);
                for (int i = 0; i < 2; i++) plumes.Fire(pit + new Vector3(0, -0.3f, UnityEngine.Random.Range(0.5f, 3f)), new Vector3(0, 2, 14) + UnityEngine.Random.insideUnitSphere * 3, 1.6f, 0.3f);
                standDebt += dt * 45;
                while (standDebt >= 1)
                {
                    standDebt -= 1;
                    plumes.Smoke(pit + new Vector3(UnityEngine.Random.Range(-1f, 1f), 0.2f, 4.5f), new Vector3(0, 2.2f, 9) + UnityEngine.Random.insideUnitSphere * 2.5f, 2.4f, 9f, Plumes.Acid);
                }
            }
            if (fireT >= 8.4f && fireT - dt < 8.4f)
            {
                Note("The firing is over. The traces are on the strip chart.");
                Say("kowalski", "Cut-off. She's quiet.");
            }
        }
    }
}
