// HIDDEN PHYSICAL TRUTH, translated from js/truth/physical.js and the runTest half of js/truth/physics.js. Only the
// rules may import the mechanisms; the UI never sees this layer. Mechanism IDs are deliberately opaque.
using System;
using System.Collections.Generic;
using System.Linq;
using AdAstra.Rules.Core;
using Newtonsoft.Json.Linq;

namespace AdAstra.Rules.Truth
{
    public sealed class Sample
    {
        public string Quantity;
        public double Value;
    }

    public static class Physical
    {
        // True nominal value of each quantity for the baseline vehicle.
        public static readonly Dictionary<string, Dictionary<string, double>> Base = new Dictionary<string, Dictionary<string, double>>
        {
            ["wac"] = new Dictionary<string, double> { ["wac-upper.chamber-pressure"] = 20, ["vehicle.apogee"] = 70, ["vehicle.deviation"] = 2.5 },
            ["aerobee"] = new Dictionary<string, double>
            {
                ["aerobee-sustainer.wall-temp"] = 610, ["aerobee-sustainer.chamber-pressure"] = 20.5,
                ["vehicle.apogee"] = 110, ["vehicle.deviation"] = 1.5,
            },
            ["viking"] = new Dictionary<string, double> { ["viking.chamber-pressure"] = 21, ["vehicle.apogee"] = 170, ["vehicle.deviation"] = 1 },
            // Vanguard's apogee here is the perigee of the orbit a good round reaches (Vanguard 1: about 650 km).
            ["vanguard"] = new Dictionary<string, double> { ["vanguard-1.chamber-pressure"] = 21, ["vehicle.apogee"] = 650, ["vehicle.deviation"] = 1 },
            // The lunar shots' figure is the height a good round reaches before it leaves the range plot, in km.
            ["juno"] = new Dictionary<string, double> { ["jupiter.chamber-pressure"] = 21, ["vehicle.apogee"] = 120000, ["vehicle.deviation"] = 1 },
            ["ranger"] = new Dictionary<string, double> { ["agena.chamber-pressure"] = 20, ["vehicle.apogee"] = 120000, ["vehicle.deviation"] = 1 },
            // A V-2 from White Sands' rebuilt stock on a good day: nominal flights in 1946 reached about 170 km.
            ["v2"] = new Dictionary<string, double> { ["v2.chamber-pressure"] = 15.5, ["vehicle.apogee"] = 165, ["vehicle.deviation"] = 2.5 },
            ["bumper"] = new Dictionary<string, double>
            {
                ["v2.chamber-pressure"] = 15.5, ["wac-upper.chamber-pressure"] = 20,
                ["v2|wac-upper.separation"] = 0.2, ["vehicle.apogee"] = 390, ["vehicle.deviation"] = 2,
            },
        };

        // What each revision really does to true values (the coupled performance cost included).
        public static readonly Dictionary<string, Dictionary<string, double>> RevisionEffects =
            new Dictionary<string, Dictionary<string, double>>
            {
                ["aerobee-sustainer/r2"] = new Dictionary<string, double> { ["aerobee-sustainer.wall-temp"] = -20, ["vehicle.apogee"] = -6 },
                ["wac-upper/r2"] = new Dictionary<string, double> { ["v2|wac-upper.separation"] = -0.1, ["vehicle.apogee"] = 4 },
                ["wac-upper/r3"] = new Dictionary<string, double> { ["wac-upper.chamber-pressure"] = 0.8, ["vehicle.apogee"] = 4, ["vehicle.deviation"] = -0.6 },
                ["v2/r2"] = new Dictionary<string, double> { ["v2.chamber-pressure"] = 0.6, ["vehicle.apogee"] = 9 },
                ["viking/r2"] = new Dictionary<string, double> { ["viking.chamber-pressure"] = 0.5, ["vehicle.apogee"] = 6 },
                ["vanguard-1/r2"] = new Dictionary<string, double> { ["vanguard-1.chamber-pressure"] = 0.6, ["vehicle.apogee"] = 20, ["vehicle.deviation"] = -0.3 },
            };

        // The standing fixes that are a way of building rather than a new part (world/programme.js: FIXES).
        public static readonly Dictionary<string, (double? Apogee, double? Deviation)> FixEffects =
            new Dictionary<string, (double?, double?)>
            {
                ["weld"] = (-0.02, null),
                ["leak"] = (0.03, null),
                ["vanes"] = (null, -1),
                ["fin"] = (-0.01, -0.5),
                ["separation"] = (0.03, null),
            };

        // Relative noise of the true value from article to article and run to run.
        public const double Scatter = 0.015;
        public static readonly Dictionary<string, double> ScatterOf = new Dictionary<string, double>
        {
            ["vehicle.apogee"] = 0.05, ["vehicle.deviation"] = 0.25,
        };

        public sealed class Mechanism
        {
            public string Stage;
            public string[] AbsentFrom;
            public Dictionary<string, string> When;
            public Dictionary<string, double> Effects;
            public Dictionary<string, double> OnFailure;
            public double? FlightFailureChance;
        }

        // Mechanisms present in hardware. `effects` show whenever they are active; `onFailure` shows only on the
        // flights they actually bring down.
        public static readonly Dictionary<string, Mechanism> Mechanisms = new Dictionary<string, Mechanism>
        {
            ["pm-07"] = new Mechanism
            {
                Stage = "aerobee-sustainer", AbsentFrom = new[] { "aerobee-sustainer/r2" },
                When = new Dictionary<string, string> { ["burn"] = "long" },
                Effects = new Dictionary<string, double> { ["aerobee-sustainer.wall-temp"] = 180 },
                FlightFailureChance = 0.25,
            },
            // Captured V-2s were old, reassembled hardware; roughly a third failed at White Sands.
            ["pm-03"] = new Mechanism
            {
                Stage = "v2", AbsentFrom = new[] { "v2/r2" },
                When = new Dictionary<string, string> { ["burn"] = "short" },
                Effects = new Dictionary<string, double> { ["v2.chamber-pressure"] = -3.5 },
                FlightFailureChance = 0.3,
            },
            // Early WAC Corporal firings lost a fair share of rounds to ignition and feed trouble.
            ["pm-11"] = new Mechanism
            {
                Stage = "wac-upper", AbsentFrom = new[] { "wac-upper/r3" },
                When = new Dictionary<string, string> { ["burn"] = "short" },
                Effects = new Dictionary<string, double> { ["wac-upper.chamber-pressure"] = -5 },
                FlightFailureChance = 0.2,
            },
            // Early Vikings lost flights to premature motor cutoff. Only a full-duration stand firing shows it.
            ["pm-19"] = new Mechanism
            {
                Stage = "viking", AbsentFrom = new[] { "viking/r2" },
                When = new Dictionary<string, string> { ["burn"] = "long" },
                Effects = new Dictionary<string, double> { ["viking.chamber-pressure"] = -5 },
                FlightFailureChance = 0.25,
            },
            // A Jupiter whose propellant utilisation is off runs out early (Pioneer 3, December 1958).
            ["pm-29"] = new Mechanism
            {
                Stage = "jupiter", AbsentFrom = new[] { "jupiter/r2" },
                When = new Dictionary<string, string> { ["burn"] = "long" },
                Effects = new Dictionary<string, double> { ["jupiter.chamber-pressure"] = -5 },
                FlightFailureChance = 0.4,
            },
            // An Agena whose restart system is marginal will not light a second time in orbit (Rangers 1 and 2, 1961).
            ["pm-31"] = new Mechanism
            {
                Stage = "agena", AbsentFrom = new[] { "agena/r2" },
                When = new Dictionary<string, string> { ["burn"] = "short" },
                Effects = new Dictionary<string, double> { ["agena.chamber-pressure"] = -4.5 },
                FlightFailureChance = 0.4,
            },
            // Vanguard's first-stage injector could burn through at ignition (TV-3, December 1957).
            ["pm-23"] = new Mechanism
            {
                Stage = "vanguard-1", AbsentFrom = new[] { "vanguard-1/r2" },
                When = new Dictionary<string, string> { ["burn"] = "short" },
                Effects = new Dictionary<string, double> { ["vanguard-1.chamber-pressure"] = -4.5 },
                FlightFailureChance = 0.4,
            },
        };

        // Mechanisms every new campaign starts with, besides the worked-case defect.
        public static readonly string[] Latent = { "pm-03", "pm-11", "pm-19" };

        // data/vehicles.js: a revision is its stage's rN; its lineage is that revision back to r1.
        public static List<string> Lineage(string revision)
        {
            var slash = revision.LastIndexOf('/');
            if (slash < 0 || slash + 2 >= revision.Length || revision[slash + 1] != 'r') return new List<string> { revision };
            int n;
            if (!int.TryParse(revision.Substring(slash + 2), out n)) return new List<string> { revision };
            var list = new List<string>();
            for (int i = n; i >= 1; i--) list.Add($"{revision.Substring(0, slash)}/r{i}");
            return list;
        }

        // A mechanism is present on every article whose stage revision has not removed it.
        static bool Present(Mechanism m, Dictionary<string, string> stages)
        {
            if (!stages.TryGetValue(m.Stage, out var rev) || rev == null) return false;
            return !Lineage(rev).Any(m.AbsentFrom.Contains);
        }

        static bool Showing(Mechanism m, Dictionary<string, string> conditions)
        {
            if (m.When == null) return true;
            foreach (var kv in m.When)
                if (!conditions.TryGetValue(kv.Key, out var v) || v != kv.Value) return false;
            return true;
        }

        // The true trace of a test (js/truth/physics.js runTest). The draw count is fixed: 1 roll + 2 per quantity.
        // Quantities come from data/vehicles.js VEHICLE_QUANTITIES, passed as a JSON array.
        public static List<Sample> RunTest(RoundState state, string jobId, string kind, string vehicle, string stage,
            Dictionary<string, string> stages, Dictionary<string, string> conditions, JArray quantities)
        {
            var stream = state.Rng["physical"];
            var ids = new List<string>();
            if (state.Physical.TrueDefectMechanism != null) ids.Add(state.Physical.TrueDefectMechanism);
            ids.AddRange(state.Physical.LatentMechanisms);
            var mechanisms = ids.Where(Mechanisms.ContainsKey).Select(id => Mechanisms[id])
                .Where(m => Present(m, stages)).ToList();
            // One roll decides the flight: each active mechanism brings it down with its own chance, independently.
            double roll = Rng.Draw(stream);
            double survive = 1;
            Mechanism culprit = null;
            foreach (var m in mechanisms)
            {
                survive *= 1 - (m.FlightFailureChance ?? 0);
                if (culprit == null && roll < 1 - survive) culprit = m;
            }
            bool failed = kind == "flight" && culprit != null;
            if (kind == "flight")
                state.Physical.Culprit = failed ? Mechanisms.First(kv => kv.Value == culprit).Key : null;
            var samples = new List<Sample>();
            foreach (var quantity in quantities.Select(t => (string)t))
            {
                double value = Base[vehicle][quantity];
                foreach (var rev in stages.Values)
                    foreach (var r in Lineage(rev))
                        if (RevisionEffects.TryGetValue(r, out var fx) && fx.TryGetValue(quantity, out var e)) value += e;
                foreach (var m in mechanisms)
                    if (Showing(m, conditions) && m.Effects.TryGetValue(quantity, out var me)) value += me;
                if (failed && culprit.OnFailure != null && culprit.OnFailure.TryGetValue(quantity, out var of)) value += of;
                // A flight carries the standing fixes in its build, and leans with the wind on the day (truth/round.js).
                if (kind == "flight")
                {
                    double apogeeShare = 0, deviationAdd = 0;
                    foreach (var c in state.Adopted)
                        if (FixEffects.TryGetValue(c, out var f))
                        {
                            if (f.Apogee.HasValue) apogeeShare += f.Apogee.Value;
                            if (f.Deviation.HasValue) deviationAdd += f.Deviation.Value;
                        }
                    if (quantity == "vehicle.apogee") value *= 1 + apogeeShare;
                    if (quantity == "vehicle.deviation") value = Math.Max(0.3, value + deviationAdd + state.Wind.Lean);
                }
                value *= 1 + (ScatterOf.TryGetValue(quantity, out var so) ? so : Scatter) * Rng.Normal(stream);
                if (failed && quantity == "vehicle.apogee") value *= 0.3;
                if (failed && quantity == "vehicle.deviation") value += 40;
                samples.Add(new Sample { Quantity = quantity, Value = value });
            }
            // A stand firing produces readings only for the stage on the stand.
            if (kind == "ground")
                samples = samples.Where(s => s.Quantity.StartsWith(stage + ".")).ToList();
            state.Physical.Traces[jobId] = samples;
            return samples;
        }
    }
}
