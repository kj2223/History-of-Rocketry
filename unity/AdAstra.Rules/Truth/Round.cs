// THE HIDDEN TRUTH OF ONE ROUND, translated from js/truth/round.js (creation and inspection only; stand, count and
// flight come later). What is really wrong with the round is decided when the round is made, and never shown to the
// player directly. The draws are taken in the JS order whatever the risks and the vehicle, so a fix never shifts the
// rest of the round. Same names and comments as the JS, which stays the reference.
using System;
using System.Collections.Generic;
using System.Linq;
using AdAstra.Rules.Core;
using Newtonsoft.Json.Linq;

namespace AdAstra.Rules.Truth
{
    public sealed class WindInfo
    {
        public int Kmh;      // km/h at the tower
        public double Lean;  // degrees the round leans off the vertical
    }

    public sealed class PhysicalState
    {
        public string TrueDefectMechanism;
        public List<string> LatentMechanisms = new List<string>();
        public string Culprit; // which mechanism brought a flight down, for truth only
        public readonly Dictionary<string, List<Sample>> Traces = new Dictionary<string, List<Sample>>();
    }

    public sealed class RoundState
    {
        public uint Seed;
        public Dictionary<string, RngStream> Rng;
        public PhysicalState Physical = new PhysicalState();
        public readonly Dictionary<string, string> Faults = new Dictionary<string, string>(); // spot id -> fault kind
        public readonly Dictionary<string, bool> Cues = new Dictionary<string, bool>();
        public string Vehicle;
        public string Igniter, Turbopump, Sustainer, Viking, Vanguard, Juno, Ranger;
        public double PropellantLoad = 1;
        public List<string> Adopted = new List<string>();
        public WindInfo Wind;
        // Vehicle-specific truths (only on their vehicles).
        public bool Thrust, Navdata, Dustcap, Lightning, Throttle;
        public bool HiddenFailure;
        public readonly List<string> Events = new List<string>();
    }

    public sealed class Reading
    {
        public double Value;
        public bool Out;
    }

    public static class RoundRules
    {
        const double CueIfFault = 0.8, CueIfSound = 0.2;
        // A day's work: fixing a real fault the player flagged, or chasing a false alarm.
        public const int FixHours = 2, FalseAlarmHours = 3, LeakCheckHours = 2;
        public const double MeterIfFault = 0.85, MeterIfSound = 0.08;

        // world/programme.js's starting chances: how the team builds rounds now.
        public static readonly Dictionary<string, object> DefaultProgramme = new Dictionary<string, object>
        {
            ["igniter"] = "wac-upper/r1", ["turbopump"] = "v2/r1", ["sustainer"] = "aerobee-sustainer/r1",
            ["viking"] = "viking/r1", ["vanguard"] = "vanguard-1/r1", ["juno"] = "jupiter/r1", ["ranger"] = "agena/r1",
            ["cameraRisk"] = 0.4, ["plugRisk"] = 0.5, ["controlRisk"] = 0.15, ["loxRisk"] = 0.15,
            ["thrustRisk"] = 0.3, ["guidanceRisk"] = 0.1, ["shortburnRisk"] = 0.1, ["shieldRisk"] = 0.12,
            ["scannerRisk"] = 0.25, ["titanctlRisk"] = 0.08, ["stage2Risk"] = 0.08, ["fuelcellRisk"] = 0.2,
            ["hatchRisk"] = 0.2, ["computerRisk"] = 0.15, ["navRisk"] = 0.1, ["shutdownRisk"] = 0.05,
            ["thrusterRisk"] = 0.08, ["saturnctlRisk"] = 0.05, ["j2Risk"] = 0.3, ["pogoRisk"] = 0.5,
            ["relightRisk"] = 0.25, ["spsRisk"] = 0.05, ["tankRisk"] = 0.05, ["cabinRisk"] = 0.15,
            ["alarmRisk"] = 0.4, ["ascentRisk"] = 0.08, ["chuteRisk"] = 0.1, ["lightningRisk"] = 0.08,
            ["throttleRisk"] = 0.25, ["h1Risk"] = 0.2, ["oringRisk"] = 0.15, ["foamRisk"] = 0.3,
            ["ssmeRisk"] = 0.1, ["boostRisk"] = 0.55, ["merlinRisk"] = 0.15, ["abortRisk"] = 0.08,
            ["weldRisk"] = 0.55, ["finRisk"] = 0.35, ["holddownRisk"] = 0.3, ["leakRisk"] = 0.45,
            ["vaneRisk"] = 0.4, ["sepRisk"] = 0.35,
        };

        static JObject WithProgramme(JObject overlay)
        {
            var p = new JObject(DefaultProgramme.Select(kv => new JProperty(kv.Key, kv.Value)));
            if (overlay != null)
                foreach (var kv in overlay.Properties()) p[kv.Name] = kv.Value;
            return p;
        }

        static double Num(JObject p, string name) => (double)p[name];
        static string Str(JObject p, string name) => (string)p[name];

        // A new round. The same seed always makes the same round.
        public static RoundState NewRound(uint seed, JObject programme, string vehicle, GameData data)
        {
            var p = WithProgramme(programme);
            var spots = (JObject)data["kits", "KITS"]?[vehicle]?["spots"] ?? new JObject();
            var r = new RoundState { Seed = seed, Vehicle = vehicle, Rng = Rng.NewStreams(seed) };
            r.Igniter = Str(p, "igniter"); r.Turbopump = Str(p, "turbopump"); r.Sustainer = Str(p, "sustainer");
            r.Viking = Str(p, "viking"); r.Vanguard = Str(p, "vanguard"); r.Juno = Str(p, "juno"); r.Ranger = Str(p, "ranger");
            r.Adopted = p["adopted"]?.Select(t => (string)t).ToList() ?? new List<string>();
            var batch = p["batch"] as JObject;
            bool Lot(string cause) => (string)p["lotVehicle"] == vehicle && batch?[cause] is JToken;

            // Each round has at most one fault of each kind, at one of the spots where it can be. The draws are taken
            // whatever the risks and the vehicle, so a fix never shifts the rest of the round.
            void Put(string kind, double risk, double chance, double where)
            {
                var ids = spots.Properties().Where(kv => (string)kv.Value["fault"] == kind).Select(kv => kv.Name).ToList();
                var rr = Lot(kind) ? Math.Min(0.9, risk * 1.6) : risk;
                if (ids.Count > 0 && chance < rr) r.Faults[ids[(int)(where * ids.Count)]] = kind;
            }
            double LatentChance(string cause) => Lot(cause) ? 0.8 : 0.5;
            var phys = r.Rng["physical"];
            var weld = Rng.Draw(phys); var weldAt = Rng.Draw(phys);
            var leak = Rng.Draw(phys); var leakAt = Rng.Draw(phys);
            Put("weld", Num(p, "weldRisk"), weld, weldAt);
            Put("leak", Num(p, "leakRisk"), leak, leakAt);
            var igniterFault = Rng.Draw(phys) < LatentChance("ignition");
            var vane = Rng.Draw(phys); var vaneAt = Rng.Draw(phys);
            var sep = Rng.Draw(phys); var sepAt = Rng.Draw(phys);
            var pumpFault = Rng.Draw(phys) < LatentChance("turbopump");
            var linerFault = Rng.Draw(phys) < LatentChance("liner");
            var fin = Rng.Draw(phys); var finAt = Rng.Draw(phys);
            var hold = Rng.Draw(phys); var holdAt = Rng.Draw(phys);
            var turbineFault = Rng.Draw(phys) < LatentChance("cutoff");
            Put("fin", Num(p, "finRisk"), fin, finAt);
            Put("holddown", Num(p, "holddownRisk"), hold, holdAt);
            Put("vanes", Num(p, "vaneRisk"), vane, vaneAt);
            Put("separation", Num(p, "sepRisk"), sep, sepAt);
            // Vanguard's injector draw is taken only on a Vanguard round, after the others, so the earlier rounds are unchanged.
            var injectorFault = vehicle == "vanguard" && Rng.Draw(phys) < LatentChance("injector");
            // Likewise the lunar shots' own draws, taken only on their rounds.
            var depletionFault = vehicle == "juno" && Rng.Draw(phys) < LatentChance("depletion");
            var agenaFault = vehicle == "ranger" && Rng.Draw(phys) < LatentChance("agena");
            if (vehicle == "ranger")
            {
                var cam = Rng.Draw(phys); var camAt = Rng.Draw(phys);
                Put("camera", Num(p, "cameraRisk"), cam, camAt);
            }
            // The Mercury-Redstone's own draws: the tail plug, the autopilot, the oxygen valve, the thrust controller
            // (no spot: nothing on the pad shows it).
            if (vehicle == "redstone")
            {
                var d = Draws(phys, 7);
                Put("plug", Num(p, "plugRisk"), d[0], d[1]);
                Put("control", Num(p, "controlRisk"), d[2], d[3]);
                Put("lox", Num(p, "loxRisk"), d[4], d[5]);
                r.Thrust = d[6] < Num(p, "thrustRisk");
            }
            // The Mercury-Atlas's own: the Atlas's guidance and sustainer, the capsule's heat shield and horizon scanner.
            if (vehicle == "atlas")
            {
                var d = Draws(phys, 8);
                Put("guidance", Num(p, "guidanceRisk"), d[0], d[1]);
                Put("shortburn", Num(p, "shortburnRisk"), d[2], d[3]);
                Put("shield", Num(p, "shieldRisk"), d[4], d[5]);
                Put("scanner", Num(p, "scannerRisk"), d[6], d[7]);
            }
            // Gemini's: the Titan's guidance and second stage, the spacecraft's fuel cells, hatch and computer, a wrong
            // number from the ground, the pad shutdown and the stuck thruster.
            if (vehicle == "titan")
            {
                var d = Draws(phys, 16);
                Put("titanctl", Num(p, "titanctlRisk"), d[0], d[1]);
                Put("stage2", Num(p, "stage2Risk"), d[2], d[3]);
                Put("fuelcell", Num(p, "fuelcellRisk"), d[4], d[5]);
                Put("hatch", Num(p, "hatchRisk"), d[6], d[7]);
                Put("computer", Num(p, "computerRisk"), d[8], d[9]);
                r.Navdata = d[10] < Num(p, "navRisk");
                Put("shutdown", Num(p, "shutdownRisk"), d[11], d[12]);
                Put("thruster", Num(p, "thrusterRisk"), d[13], d[14]);
                r.Dustcap = d[15] < 0.5;
            }
            // Apollo's: the Saturn IB's own draws, taken only on its rounds.
            if (vehicle == "saturnib")
            {
                var d = Draws(phys, 10);
                var kinds = new[] { "h1", "saturnctl", "sps", "cabin", "chute" };
                for (int i = 0; i < kinds.Length; i++) Put(kinds[i], Num(p, kinds[i] + "Risk"), d[2 * i], d[2 * i + 1]);
            }
            // The Shuttle's own draws.
            if (vehicle == "shuttle")
            {
                var d = Draws(phys, 12);
                var kinds = new[] { "oring", "ssme", "foam", "fuelcell", "computer", "cabin" };
                for (int i = 0; i < kinds.Length; i++) Put(kinds[i], Num(p, kinds[i] + "Risk"), d[2 * i], d[2 * i + 1]);
            }
            // Dragon's own draws.
            if (vehicle == "dragon")
            {
                var d = Draws(phys, 8);
                var kinds = new[] { "merlin", "abort", "computer", "chute" };
                for (int i = 0; i < kinds.Length; i++) Put(kinds[i], Num(p, kinds[i] + "Risk"), d[2 * i], d[2 * i + 1]);
            }
            // SLS reuses the Shuttle's kinds for her engines and boosters, and Apollo's for the upper stage, Orion and
            // the parachutes. Her draws are her own.
            if (vehicle == "sls")
            {
                var d = Draws(phys, 10);
                var kinds = new[] { "ssme", "oring", "relight", "sps", "chute" };
                for (int i = 0; i < kinds.Length; i++) Put(kinds[i], Num(p, kinds[i] + "Risk"), d[2 * i], d[2 * i + 1]);
            }
            if (vehicle == "saturn5")
            {
                var d = Draws(phys, 22);
                var kinds = new[] { "saturnctl", "j2", "pogo", "relight", "sps", "tank", "cabin", "alarm", "ascent", "chute" };
                for (int i = 0; i < kinds.Length; i++) Put(kinds[i], Num(p, kinds[i] + "Risk"), d[2 * i], d[2 * i + 1]);
                r.Lightning = d[20] < Num(p, "lightningRisk");
                // Apollo 16's own draw, taken after the others so no earlier Saturn V round changes.
                r.Throttle = Rng.Draw(phys) < Num(p, "throttleRisk");
            }
            var latent = new List<string>();
            if (igniterFault && (vehicle == "wac" || vehicle == "bumper")) latent.Add("pm-11");
            if (pumpFault && (vehicle == "v2" || vehicle == "bumper")) latent.Add("pm-03");
            if (linerFault && vehicle == "aerobee") latent.Add("pm-07");
            if (turbineFault && vehicle == "viking") latent.Add("pm-19");
            if (injectorFault) latent.Add("pm-23");
            if (depletionFault) latent.Add("pm-29");
            if (agenaFault) latent.Add("pm-31");
            r.Physical.TrueDefectMechanism = null;
            r.Physical.LatentMechanisms = latent;
            foreach (var id in spots.Properties().Select(kv => kv.Name))
                r.Cues[id] = Rng.Draw(r.Rng["observation"]) < (r.Faults.ContainsKey(id) ? CueIfFault : CueIfSound);
            r.Wind = WindOf(seed);
            return r;
        }

        static double[] Draws(RngStream s, int n)
        {
            var d = new double[n];
            for (int i = 0; i < n; i++) d[i] = Rng.Draw(s);
            return d;
        }

        public static bool FaultsInclude(RoundState r, string kind) => r.Faults.Values.Contains(kind);
        public static bool HasLeak(RoundState r) => FaultsInclude(r, "leak");
        public static bool HasWeldFault(RoundState r) => FaultsInclude(r, "weld");
        public static string FaultAt(RoundState r, string id) => r.Faults.TryGetValue(id, out var f) ? f : null;
        public static bool SpotLooksBad(RoundState r, string id) => r.Cues[id];
        public static bool HasHolddownFault(RoundState r) => FaultsInclude(r, "holddown");

        // A flaw in the hold-down fittings lets go under a full-duration firing's thrust this often (Viking 8, June 1952).
        public const double HolddownFailure = 0.7;

        // The stage that goes on the stand: the WAC's upper stage, or the V-2 (alone, or the lower stage of a Bumper).
        static string StandStage(RoundState r) =>
            r.Vehicle == "juno" ? "jupiter"
            : r.Vehicle == "ranger" ? "agena"
            : r.Vehicle == "vanguard" ? "vanguard-1"
            : r.Vehicle == "viking" ? "viking"
            : r.Vehicle == "aerobee" ? "aerobee-sustainer"
            : r.Vehicle == "v2" || r.Vehicle == "bumper" ? "v2"
            : "wac-upper";

        static Dictionary<string, string> Stages(RoundState r) =>
            r.Vehicle == "v2" ? new Dictionary<string, string> { ["v2"] = r.Turbopump }
            : r.Vehicle == "viking" ? new Dictionary<string, string> { ["viking"] = r.Viking ?? "viking/r1" }
            : r.Vehicle == "vanguard" ? new Dictionary<string, string> { ["vanguard-1"] = r.Vanguard ?? "vanguard-1/r1" }
            : r.Vehicle == "juno" ? new Dictionary<string, string> { ["jupiter"] = r.Juno ?? "jupiter/r1" }
            : r.Vehicle == "ranger" ? new Dictionary<string, string> { ["agena"] = r.Ranger ?? "agena/r1" }
            : r.Vehicle == "aerobee" ? new Dictionary<string, string>
                {
                    ["aerobee-booster"] = "aerobee-booster/r1",
                    ["aerobee-sustainer"] = r.Sustainer ?? "aerobee-sustainer/r1",
                }
            : r.Vehicle == "bumper" ? new Dictionary<string, string> { ["v2"] = r.Turbopump, ["wac-upper"] = r.Igniter }
            : new Dictionary<string, string> { ["tiny-tim"] = "tiny-tim/r1", ["wac-upper"] = r.Igniter };

        static readonly Dictionary<string, double> NominalPc = new Dictionary<string, double>
        {
            ["wac-upper"] = 20, ["v2"] = 15.5, ["aerobee-sustainer"] = 20.5, ["viking"] = 21,
            ["vanguard-1"] = 21, ["jupiter"] = 21, ["agena"] = 20,
        };

        // Stages whose fault is a late sag on a full-duration firing, not a rough start: when (s) the sag sets in.
        static readonly Dictionary<string, double> SagAt = new Dictionary<string, double> { ["viking"] = 12, ["jupiter"] = 20 };

        public sealed class TracePoint
        {
            public double T, Pc, Tank;
            public double? Wall;
        }

        public sealed class StandResult
        {
            public List<TracePoint> Trace = new List<TracePoint>();
            public double Steady;
            public double? Wall;
            public double? Loose;
        }

        // A static firing on the stand (js/truth/round.js staticFire). Returns the trace the player sees, with gauge
        // noise. burn 'short' (8 s): a start-up check; 'long' (30 s): a full-duration firing with thermocouples on the
        // chamber, the only firing that shows the liner's wall temperature.
        public static StandResult StaticFire(RoundState r, string burn, GameData data)
        {
            var vehicle = r.Vehicle ?? "wac";
            var stage = StandStage(r);
            var stages = Stages(r);
            Physical.RunTest(r, "stand", "ground", vehicle, stage, stages, new Dictionary<string, string> { ["burn"] = burn },
                (JArray)data["vehicles", "VEHICLE_QUANTITIES"][vehicle]);
            var samples = r.Physical.Traces["stand"].ToDictionary(s => s.Quantity, s => s.Value);
            r.Physical.Traces.Remove("stand");
            double steady = samples.TryGetValue(stage + ".chamber-pressure", out var steadyBox) ? steadyBox : 0;
            double? wallEnd = samples.TryGetValue(stage + ".wall-temp", out var wallBox) ? wallBox : (double?)null;
            bool longBurn = burn == "long";
            double sagAt = SagAt.TryGetValue(stage, out var sag) ? sag : 0;
            bool leak = HasLeak(r);
            var obs = r.Rng["observation"];
            double nominal = NominalPc[stage];
            double rough = sagAt > 0 ? 0 : Math.Max(0, nominal - 0.5 - steady) / 4;
            double PcAt(double t) => sagAt <= 0 ? steady : t < sagAt ? nominal : steady + (nominal - steady) * Math.Exp(-(t - sagAt) / 2.5);
            // A flawed hold-down lets go under full thrust: the firing ends with the round leaving the stand. One physical draw.
            double? loose = longBurn && HasHolddownFault(r) && Rng.Draw(r.Rng["physical"]) < HolddownFailure ? 9 : (double?)null;
            double span = loose ?? (longBurn ? 30 : 8), step = longBurn ? 0.25 : 0.1;
            var result = new StandResult { Steady = steady, Wall = longBurn && wallEnd.HasValue ? wallEnd : null, Loose = loose };
            for (int i = 0; i <= (int)(span / step); i++)
            {
                double t = i * step, rise = Math.Min(1, t / 0.6);
                double chug = rough * (t < 3 ? 4 * Math.Sin(t * 23) * Math.Exp(-t / 2.5) : 0.6 * Math.Sin(t * 17));
                var point = new TracePoint
                {
                    T = t,
                    Pc = Math.Max(0, PcAt(t) * rise + chug + 0.35 * Rng.Normal(obs)),
                    Tank = 23 - (leak ? Math.Min(6, t * 0.45) : 0) + 0.15 * Rng.Normal(obs),
                };
                if (longBurn && wallEnd.HasValue) point.Wall = 300 + (wallEnd.Value - 300) * (1 - Math.Exp(-t / 7)) + 4 * Rng.Normal(obs);
                result.Trace.Add(point);
            }
            if (loose.HasValue)
                r.Events.Add("The hold-down fittings let go during the full-duration firing, and the round left the stand.");
            return result;
        }

        // THE TEST KIT: a measurement on one part, read against its limit. Drawn from a hash of the seed and the part,
        // never from the round's random streams, so using the meter changes nothing else that happens.
        static readonly JObject Xray = JObject.FromObject(new
        {
            name = "X-ray the seam", minutes = 45, unit = "pores per inch", limit = 2.0,
            sound = new[] { 0.0, 2.0 }, bad = new[] { 4.0, 9.0 }, whole = true,
        });

        static readonly Dictionary<string, JObject> Meters = new Dictionary<string, JObject>
        {
            ["leak"] = JObject.FromObject(new
            {
                name = "Pressure-decay test", minutes = 30, unit = "bar lost in 10 min", limit = 0.2,
                sound = new[] { 0.02, 0.15 }, bad = new[] { 0.3, 1.2 },
            }),
            ["weld"] = Xray,
            ["tank"] = Xray,
            ["default"] = JObject.FromObject(new
            {
                name = "Bench check", minutes = 30, unit = "of 10 cycles clean", limit = 10.0,
                sound = new[] { 10.0, 10.0 }, bad = new[] { 6.0, 9.0 }, whole = true, low = true,
            }),
        };

        static JObject MeterFor(JToken spot)
        {
            var fault = (string)spot?["fault"];
            return fault == null ? null : Meters.TryGetValue(fault, out var m) ? m : Meters["default"];
        }

        // JS Math.imul: signed 32-bit multiply, bit pattern preserved in uint arithmetic.
        static uint Imul(uint a, uint b) => (uint)unchecked((int)a * (int)b);

        public static double Hash01(uint seed, string id, uint salt)
        {
            uint h = seed ^ Imul(salt + 11, 0x9e3779b1u);
            foreach (var ch in id) h = Imul(h ^ ch, 2654435761u);
            h = Imul(h ^ (h >> 15), 2246822507u);
            h ^= h >> 13;
            return h / 4294967296.0;
        }

        // JS Math.round: half always up, unlike .NET's banker's rounding.
        static double JsRound(double v) => Math.Floor(v + 0.5);

        // { value, out }: the reading, and whether it is past the limit (low readings fail for a bench check).
        public static Reading MeterReading(RoundState r, string id, GameData data)
        {
            var spots = (JObject)data["kits", "KITS"]?[r.Vehicle]?["spots"] ?? new JObject();
            var m = MeterFor(spots[id]);
            if (m == null) return null;
            bool whole = m["whole"] is JToken, low = m["low"] is JToken;
            double limit = (double)m["limit"];
            var sound = ((JArray)m["sound"]).Select(t => (double)t).ToArray();
            var bad = ((JArray)m["bad"]).Select(t => (double)t).ToArray();
            bool outOfBand = Hash01(r.Seed, id, 1) < (r.Faults.ContainsKey(id) ? MeterIfFault : MeterIfSound);
            var range = outOfBand ? bad : sound;
            double value = range[0] + (range[1] - range[0]) * Hash01(r.Seed, id, 2);
            value = whole ? JsRound(value) : JsRound(value * 100) / 100;
            return new Reading { Value = value, Out = low ? value < limit : value > limit };
        }

        static readonly Dictionary<string, string> Found = new Dictionary<string, string>
        {
            ["camera"] = "arcing camera supply", ["weld"] = "weld flaw", ["leak"] = "leak",
            ["vanes"] = "cracked vane", ["separation"] = "bad firing lead",
            ["fin"] = "cracked fin fitting", ["holddown"] = "flawed hold-down fitting",
        };

        // The player flags spots for the crew. Real faults are fixed; false alarms cost time. Returns the hours the crew spends.
        public static int FlagSpots(RoundState r, IEnumerable<string> ids, GameData data)
        {
            var spots = (JObject)data["kits", "KITS"]?[r.Vehicle]?["spots"] ?? new JObject();
            int hours = 0;
            foreach (var id in ids)
            {
                var name = (string)spots[id]?["name"] ?? id;
                if (r.Faults.TryGetValue(id, out var kind))
                {
                    r.Events.Add($"You flagged the {name.ToLowerInvariant()}: the crew found a real {(Found.TryGetValue(kind, out var label) ? label : kind)} and fixed it.");
                    r.Faults.Remove(id);
                    hours += FixHours;
                }
                else
                {
                    r.Events.Add($"You flagged the {name.ToLowerInvariant()}: nothing wrong with it.");
                    hours += FalseAlarmHours;
                }
            }
            return hours;
        }

        // A crew member looks the round over instead of you, and reports the spots they think look bad. One
        // observation draw per spot.
        public static List<string> CrewInspect(RoundState r, double hit, double falseAlarm, GameData data)
        {
            var spots = (JObject)data["kits", "KITS"]?[r.Vehicle]?["spots"] ?? new JObject();
            var found = new List<string>();
            foreach (var id in spots.Properties().Select(kv => kv.Name))
                if (Rng.Draw(r.Rng["observation"]) < (r.Faults.ContainsKey(id) ? hit : falseAlarm))
                    found.Add(id);
            return found;
        }

        // The crew leak-checks the feed and pressurisation system. Finds and fixes a leak if there is one.
        public static (string Found, int Hours) LeakCheck(RoundState r, GameData data)
        {
            var id = r.Faults.FirstOrDefault(kv => kv.Value == "leak").Key;
            if (id != null)
            {
                var name = (string)data["kits", "KITS"]?[r.Vehicle]?["spots"]?[id]?["name"] ?? id;
                r.Faults.Remove(id);
                r.Events.Add($"A leak check found the leak at the {name.ToLowerInvariant()} and fixed it.");
                return (name, LeakCheckHours + FixHours);
            }
            r.Events.Add("A leak check found nothing.");
            return (null, LeakCheckHours);
        }

        // The tank pressure the blockhouse gauge shows at count second s: steady, or bleeding off if the round leaks.
        public static double TankGauge(RoundState r, double s) =>
            23 - (HasLeak(r) ? Math.Min(6, s * 0.012) : 0) + Flutter(r.Seed, (uint)Math.Floor(s / 4));

        // The wind on the range for the count: km/h at the tower, and how far it leans the round off the vertical.
        // Taken from the seed, not the round's streams, so it moves no draw. Mostly light; now and then a stiff breeze.
        public static WindInfo WindOf(uint seed)
        {
            double u = Flutter(seed, 7001) / 0.3 + 0.5;
            int kmh = (int)JsRound(4 + 36 * u * u);
            return new WindInfo { Kmh = kmh, Lean = kmh * 0.1 };
        }

        static double Flutter(uint seed, uint step)
        {
            uint h = Imul(seed ^ Imul(step + 1, 2654435761u), 2246822507u);
            h = Imul(h ^ (h >> 13), 3266489909u);
            h ^= h >> 16;
            return (h / 4294967296.0 - 0.5) * 0.3;
        }
    }
}
