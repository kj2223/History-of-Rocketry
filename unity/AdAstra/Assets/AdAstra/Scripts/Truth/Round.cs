// THE HIDDEN TRUTH OF ONE WAC CORPORAL ROUND. Ported from the game's truth/round.js, truth/physical.js (the WAC parts),
// truth/aim.js and truth/decay.js. What is really wrong with the round is decided when it is made and never shown to the
// player directly: they meet it through a mark on a weld, a reading on the test kit, a rough trace, a needle, the wreck.
// No drawing here.
using System;
using System.Collections.Generic;
using System.Linq;

namespace AdAstra.Truth
{
    public struct TracePoint { public float T, Pc, Tank; }
    public struct PathPoint { public float T, X, H; }

    public sealed class Flight
    {
        public string Failure;          // null for a good flight
        public float FailAt = -1, Burn;
        public double Apogee, Range, Radar;
        public List<PathPoint> Path = new List<PathPoint>();
        public double Cross;            // where she came down across the range line (km, + east)
        public string Landing;          // line / wide / off
        public bool WreckFound;
    }

    public sealed class Round
    {
        // Constants from round.js
        public const double CueIfFault = 0.8, CueIfSound = 0.2;
        public const double FixHours = 2, FalseAlarmHours = 3, LeakCheckHours = 2;
        public const double WeldFailure = 0.45, LeakFailure = 0.6;
        public const double HiddenFailure = 0.12;
        public const double MeterIfFault = 0.85, MeterIfSound = 0.08;
        public const double IgnitionFlightFailure = 0.2; // pm-11 flightFailureChance
        public const float BurnTime = 45f;

        public int Seed;
        public Stream Physical, Observation;
        public Dictionary<string, string> Faults = new Dictionary<string, string>();
        public Dictionary<string, bool> Cues = new Dictionary<string, bool>();
        public bool IgniterLatent;            // the hang-fire fault pm-11 in the igniter
        public string Igniter = "r1";         // r3: the reworked igniter
        public double Load = 1;               // share of a full propellant load
        public List<string> Adopted = new List<string>();
        public List<string> Events = new List<string>();
        public bool Hidden;
        public Flight Flight;

        public bool HasLeak => Faults.ContainsValue("leak");
        public bool HasWeld => Faults.ContainsValue("weld");
        public bool HasIgniterFault => IgniterLatent && Igniter == "r1";

        public static Round Create(int seed, Programme p)
        {
            var r = new Round { Seed = seed };
            r.Physical = new Stream((uint)seed * 2654435761u + 1u);
            r.Observation = new Stream((uint)seed * 2246822519u + 7u);
            double weld = r.Physical.Next(), weldAt = r.Physical.Next(), leak = r.Physical.Next(), leakAt = r.Physical.Next();
            r.Put("weld", p.RiskFor("weld", p.WeldRisk), weld, weldAt);
            r.Put("leak", p.RiskFor("leak", p.LeakRisk), leak, leakAt);
            r.IgniterLatent = r.Physical.Next() < (p.InLot("ignition") ? 0.8 : 0.5);
            r.Igniter = p.Igniter;
            r.Adopted = new List<string>(p.Adopted);
            foreach (var s in Wac.Spots)
                r.Cues[s.Id] = r.Observation.Next() < (r.Faults.ContainsKey(s.Id) ? CueIfFault : CueIfSound);
            return r;
        }

        void Put(string kind, double risk, double chance, double where)
        {
            var ids = Wac.Spots.Where(s => s.Fault == kind).Select(s => s.Id).ToArray();
            if (ids.Length > 0 && chance < risk) Faults[ids[(int)Math.Floor(where * ids.Length)]] = kind;
        }

        public string FaultAt(string id) => Faults.TryGetValue(id, out var f) ? f : null;

        // ---- The test kit: better evidence than a look, but not proof. Hashes, never the streams.
        public struct Reading { public double Value; public bool Out; }

        public Reading MeterReading(string id)
        {
            var m = Wac.MeterFor(Wac.SpotById(id));
            bool outOf = Hash.H01(Seed, id, 1) < (Faults.ContainsKey(id) ? MeterIfFault : MeterIfSound);
            double a = outOf ? m.BadLo : m.SoundLo, b = outOf ? m.BadHi : m.SoundHi;
            double v = a + (b - a) * Hash.H01(Seed, id, 2);
            v = m.Whole ? Math.Round(v) : Math.Round(v * 100) / 100;
            return new Reading { Value = v, Out = m.Low ? v < m.Limit : v > m.Limit };
        }

        // ---- Flags: real faults are fixed; false alarms cost time. Returns the crew hours.
        public double FlagSpots(IEnumerable<string> ids)
        {
            double hours = 0;
            foreach (var id in ids)
            {
                var spot = Wac.SpotById(id);
                if (Faults.TryGetValue(id, out var f))
                {
                    Events.Add($"You flagged the {spot.Name.ToLower()}: the crew found a real {Wac.Found[f]} and fixed it.");
                    Faults.Remove(id);
                    hours += FixHours;
                }
                else
                {
                    Events.Add($"You flagged the {spot.Name.ToLower()}: nothing wrong with it.");
                    hours += FalseAlarmHours;
                }
            }
            return hours;
        }

        public List<string> CrewInspect(double hit, double falseAlarm) =>
            Wac.Spots.Select(s => s.Id).Where(id => Observation.Next() < (Faults.ContainsKey(id) ? hit : falseAlarm)).ToList();

        // The crew goes over the feed system. Returns the spot it found (or null) and the hours.
        public (string found, double hours) LeakCheck()
        {
            var id = Faults.FirstOrDefault(kv => kv.Value == "leak").Key;
            if (id != null)
            {
                var name = Wac.SpotById(id).Name;
                Faults.Remove(id);
                Events.Add($"A leak check found the leak at the {name.ToLower()} and fixed it.");
                return (name, LeakCheckHours + FixHours);
            }
            Events.Add("A leak check found nothing.");
            return (null, LeakCheckHours);
        }

        public void ReworkIgniter()
        {
            Events.Add(HasIgniterFault ? "The igniter was reworked: the old one had a real hang-fire fault."
                                       : "The igniter was reworked, though the old one was sound.");
            Igniter = "r3";
        }

        // ---- The static firing on the stand: an 8 s start-up check. A hang-fire igniter shows a rough, low start; a
        // leak shows a falling tank pressure.
        public List<TracePoint> StaticFire()
        {
            double nominal = 20 + (Igniter == "r3" ? 0.8 : 0);
            double steady = nominal * (1 + 0.015 * Physical.Normal()) - (HasIgniterFault ? 5 : 0);
            double rough = Math.Max(0, nominal - 0.5 - steady) / 4;
            var tr = new List<TracePoint>();
            for (int i = 0; i <= 80; i++)
            {
                double t = i * 0.1, rise = Math.Min(1, t / 0.6);
                double chug = rough * (t < 3 ? 4 * Math.Sin(t * 23) * Math.Exp(-t / 2.5) : 0.6 * Math.Sin(t * 17));
                tr.Add(new TracePoint
                {
                    T = (float)t,
                    Pc = (float)Math.Max(0, steady * rise + chug + 0.35 * Observation.Normal()),
                    Tank = (float)(23 - (HasLeak ? Math.Min(6, t * 0.45) : 0) + 0.15 * Observation.Normal()),
                });
            }
            return tr;
        }

        // The tank gauge, s seconds after the stage was pressurised for the count.
        public double TankGauge(double s) =>
            23 - (HasLeak ? Math.Min(6, s * 0.012) : 0) + Hash.Flutter(Seed, (int)Math.Floor(s / 4));

        // ---- The wind (aim.js)
        public const double Weathercock = 0.45, ClearedKm = 5, OffRangeKm = 12, MaxLay = 10;

        public static int WindKmh(int seed)
        {
            double u = Hash.Flutter(seed, 7001) / 0.3 + 0.5;
            return (int)Math.Round(4 + 36 * u * u);
        }

        public double CrosswindAt(double minute)
        {
            int kmh = WindKmh(Seed);
            double side = Hash.H01(Seed, 1) < 0.5 ? -1 : 1;
            double b = side * kmh * 0.8, swing = 5 + kmh * 0.6;
            double p1 = Hash.H01(Seed, 2) * Math.PI * 2, p2 = Hash.H01(Seed, 3) * Math.PI * 2;
            double gust = (Hash.H01(Seed, 1000 + (int)Math.Floor(minute / 6)) - 0.5) * 4;
            return b + swing * (0.65 * Math.Sin(minute / 70 + p1) + 0.35 * Math.Sin(minute / 23 + p2)) + gust;
        }

        public int BalloonAt(double minute) =>
            (int)Math.Round(CrosswindAt(minute) + (Hash.H01(Seed, 5000 + (int)Math.Floor(minute)) - 0.5) * 8);

        public static double LayFor(double cross) =>
            Math.Max(-MaxLay, Math.Min(MaxLay, Math.Round(Weathercock * cross * 2) / 2));

        public static double CrossImpact(double x, double lay, double cross) =>
            x * Math.Tan((lay - Weathercock * cross) * Math.PI / 180);

        public static string LandingOf(double y) =>
            Math.Abs(y) <= ClearedKm ? "line" : Math.Abs(y) <= OffRangeKm ? "wide" : "off";

        public bool WreckFoundAt(double y)
        {
            var l = LandingOf(y);
            return l == "line" || (l == "wide" && Hash.H01(Seed, 9001) < 0.5);
        }

        public static string SideText(double v, string unit) =>
            Math.Abs(v) < 0.05 ? "0" + unit : $"{Math.Abs(Math.Round(v, 1))}{unit} {(v > 0 ? "east" : "west")}";

        // ---- The decay test (decay.js): lock up the tank and watch the needle. The air warms through the morning and
        // cools through the afternoon, and a closed tank follows it.
        public const double DecayStart = 23;

        public (double leak, double drift) DecayRates(double minuteOfDay)
        {
            double leak = HasLeak ? 0.02 + 0.05 * Hash.H01(Seed, 1 + 29) : 0;
            bool warming = minuteOfDay < 14 * 60;
            double drift = (warming ? 1 : -1) * (0.005 + 0.025 * Hash.H01(Seed, 2 + 29 + (int)Math.Floor(minuteOfDay / 240)));
            return (leak, drift);
        }

        public double DecayReading((double leak, double drift) rates, double minutes)
        {
            double flutter = (Hash.H01(Seed, 129 + (int)Math.Floor(minutes * 2)) - 0.5) * 0.08;
            return DecayStart + (rates.drift - rates.leak) * minutes + flutter;
        }

        public int AirTemp(double minuteOfDay) =>
            (int)Math.Round(4 + 14 * Math.Sin(Math.Max(0, Math.Min(1, (minuteOfDay - 360) / 600)) * Math.PI * 0.9) + Hash.H01(Seed, 36) * 4);

        // ---- The flight. The order is the order the causes can strike: an igniter that hangs fire never tests the welds.
        public Flight Fly(double lay, double crossAtLiftoff)
        {
            double apogee = 70 + (Igniter == "r3" ? 4 : 0);
            if (Adopted.Contains("weld")) apogee *= 0.98;
            if (Adopted.Contains("leak")) apogee *= 1.03;
            apogee *= 1 + 0.05 * Physical.Normal();
            apogee *= Math.Pow(0.55 + 0.45 * Load, 2);
            double deviation = (2.5 - (Igniter == "r3" ? 0.6 : 0)) * (1 + 0.25 * Physical.Normal());

            string failure = null;
            if (HasIgniterFault && Physical.Next() < IgnitionFlightFailure) failure = "ignition";
            if (failure == null && HasWeld && Physical.Next() < WeldFailure) failure = "weld";
            if (failure == null && HasLeak && Physical.Next() < LeakFailure) failure = "leak";
            double hidden = Physical.Next(), which = Physical.Next();
            if (failure == null && hidden < HiddenFailure)
            {
                failure = new[] { "ignition", "weld", "leak" }[(int)Math.Floor(which * 3)];
                Hidden = true;
                Events.Add("Something failed that no inspection could have found.");
            }

            float failAt = failure == "ignition" ? 2 : failure == "weld" ? 14 : failure == "leak" ? 24 : -1;
            double dev = failure == "ignition" ? 40 : 0;
            var f = new Flight { Failure = failure, FailAt = failAt, Burn = failure != null ? failAt : BurnTime };
            FlyPath(f, apogee, (3 + deviation + dev) * Math.PI / 180);
            f.Radar = f.Apogee * (1 + 0.01 * Observation.Normal());
            f.Cross = CrossImpact(f.Range, lay, crossAtLiftoff);
            f.Landing = LandingOf(f.Cross);
            f.WreckFound = WreckFoundAt(f.Cross);
            Flight = f;
            return f;
        }

        // A simple sounding-rocket track: a powered climb to burnout, then a ballistic coast. Fitted so a full burn peaks
        // at the apogee the physics gives; an early cut leaves her lower and shorter.
        static void FlyPath(Flight f, double apogee, double tilt)
        {
            const double g = 0.0098; // km/s^2
            double tb = BurnTime, hb = 0.3 * apogee, vb = Math.Sqrt(2 * g * (apogee - hb));
            double cut = f.Failure != null ? f.FailAt : tb, frac = cut / tb;
            double hc = hb * frac * frac, vc = vb * frac;
            double vUp = vc * Math.Cos(tilt), vSide = vc * Math.Sin(tilt);
            double xc = hc * Math.Tan(tilt);
            if (f.Failure == "ignition") { hc = 0.4; xc = 0.05; vUp = 0.12; vSide = 0.1; }
            double peak = 0, t = 0;
            for (; t <= 600; t += 1)
            {
                double x, h;
                if (t <= cut)
                {
                    double q = t / tb;
                    h = f.Failure == "ignition" ? hc * Math.Min(1, t / cut) : hb * q * q;
                    x = f.Failure == "ignition" ? xc * Math.Min(1, t / cut) : h * Math.Tan(tilt);
                }
                else
                {
                    double s = t - cut;
                    h = hc + vUp * s - 0.5 * g * s * s;
                    x = xc + vSide * s;
                }
                if (h < 0) h = 0;
                peak = Math.Max(peak, h);
                f.Path.Add(new PathPoint { T = (float)t, X = (float)x, H = (float)h });
                if (t > cut && h <= 0) break;
            }
            f.Apogee = peak;
            f.Range = f.Path[f.Path.Count - 1].X;
        }
    }
}
