// The golden round traces, replayed: for every seed, vehicle and programme, the C# creation and inspection must match
// the JS (tools/golden/record.mjs) exactly — faults, cues, latent mechanisms, stream end states, meters, the crew's
// findings, and the hours a flag or a leak check costs.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using AdAstra.Rules.Core;
using AdAstra.Rules.Truth;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace AdAstra.Rules.Tests
{
    public class RoundGoldenTests
    {
        static string Dir => TestContext.CurrentContext.TestDirectory;
        static JArray Golden() =>
            JArray.Parse(File.ReadAllText(Path.Combine(Dir, "Golden", "round.json")));
        static GameData Data => GameData.FromFolder(Path.Combine(Dir, "Data"));

        static readonly Dictionary<string, Func<RoundState, object>> VehicleTruths = new Dictionary<string, Func<RoundState, object>>
        {
            ["thrust"] = r => (object)r.Thrust, ["navdata"] = r => r.Navdata, ["dustcap"] = r => r.Dustcap,
            ["lightning"] = r => r.Lightning, ["throttle"] = r => r.Throttle,
        };

        [TestCaseSource(nameof(Cases))]
        public void MatchesTheJs(JObject expected)
        {
            var data = Data;
            JObject programme = (string)expected["programme"] == "lot"
                ? new JObject { ["lotVehicle"] = "wac", ["batch"] = new JObject { ["weld"] = true }, ["weldRisk"] = 0.9 }
                : null;
            var want = expected["case"];
            var r = RoundRules.NewRound((uint)want["seed"].Value<uint>(), programme, (string)expected["vehicle"], data);

            Assert.That((string)expected["vehicle"], Is.EqualTo(r.Vehicle));
            Assert.That(want["spots"].ToObject<List<string>>(), Is.EqualTo(((JObject)data["kits", "KITS"][r.Vehicle]["spots"]).Properties().Select(kv => kv.Name).ToList()), "spot order");
            Assert.That(want["faults"].ToObject<Dictionary<string, string>>(), Is.EqualTo(r.Faults), "faults");
            Assert.That(want["cues"].ToObject<Dictionary<string, bool>>(), Is.EqualTo(r.Cues), "cues");
            Assert.That(want["latent"].ToObject<List<string>>(), Is.EqualTo(r.Physical.LatentMechanisms), "latent mechanisms");
            Assert.That(want["wind"]["kmh"].Value<int>(), Is.EqualTo(r.Wind.Kmh), "wind kmh");
            Assert.That(want["wind"]["lean"].Value<double>(), Is.EqualTo(r.Wind.Lean).Within(1e-12), "wind lean");
            Assert.That((uint)want["streamEnd"]["physical"], Is.EqualTo(r.Rng["physical"].State), "physical stream end");
            Assert.That((uint)want["streamEnd"]["observation"], Is.EqualTo(r.Rng["observation"].State), "observation stream end");
            Assert.That((uint)want["streamEnd"]["forecast"], Is.EqualTo(r.Rng["forecast"].State), "forecast stream end");
            foreach (var kv in VehicleTruths)
            {
                var wanted = want[kv.Key].Type == JTokenType.Boolean ? (bool?)want[kv.Key] : null;
                var actual = (bool)kv.Value(r);
                Assert.That(actual, Is.EqualTo(wanted ?? false), kv.Key);
            }

            // Meters change nothing; the tank gauge reads off a hash. Both compare within double noise.
            foreach (var kv in ((JObject)want["meters"]).Properties())
            {
                var got = RoundRules.MeterReading(r, kv.Name, data);
                if (kv.Value.Type == JTokenType.Null) Assert.That(got, Is.Null, $"meter {kv.Name}");
                else
                {
                    Assert.That(got, Is.Not.Null, $"meter {kv.Name}");
                    Assert.That(got.Value, Is.EqualTo(kv.Value["value"].Value<double>()).Within(1e-9), $"meter {kv.Name} value");
                    Assert.That(got.Out, Is.EqualTo((bool)kv.Value["out"]), $"meter {kv.Name} out");
                }
            }
            var tank = want["tank"].Select(t => t.Value<double>()).ToArray();
            double[] gotTank = { RoundRules.TankGauge(r, 0), RoundRules.TankGauge(r, 10), RoundRules.TankGauge(r, 60), RoundRules.TankGauge(r, 120) };
            for (int i = 0; i < tank.Length; i++)
                Assert.That(gotTank[i], Is.EqualTo(tank[i]).Within(1e-9), $"tank at {i}");

            // The crew: observation draws, then the leak check, then flags, in the recorder's order.
            var crew1 = RoundRules.CrewInspect(r, 0.9, 0.1, data);
            Assert.That(crew1, Is.EqualTo(want["crew1"].ToObject<List<string>>()), "crew1");
            Assert.That((uint)want["streamAfterCrew"]["observation"], Is.EqualTo(r.Rng["observation"].State), "observation after crew1");
            var crew2 = RoundRules.CrewInspect(r, 0.4, 0.5, data);
            Assert.That(crew2, Is.EqualTo(want["crew2"].ToObject<List<string>>()), "crew2");
            var leak = RoundRules.LeakCheck(r, data);
            Assert.That(leak.Found, Is.EqualTo((string)want["leak"]["found"]), "leak found");
            Assert.That(leak.Hours, Is.EqualTo(want["leak"]["hours"].Value<int>()), "leak hours");
            Assert.That(want["faultsAfterLeak"].ToObject<Dictionary<string, string>>(), Is.EqualTo(r.Faults), "faults after leak check");
            var flagIds = want["flagIds"].ToObject<List<string>>();
            Assert.That(RoundRules.FlagSpots(r, flagIds, data), Is.EqualTo(want["flagHours"].Value<int>()), "flag hours");
            Assert.That(r.Events, Is.EqualTo(want["events"].ToObject<List<string>>()), "events");
            Assert.That(want["faultsAfterFlags"].ToObject<Dictionary<string, string>>(), Is.EqualTo(r.Faults), "faults after flags");
        }

        static IEnumerable<TestCaseData> Cases() =>
            Golden().Cast<JObject>().Select(c => new TestCaseData(c).SetName($"{c["vehicle"]} · {(string)c["programme"]} · seed {c["case"]["seed"]}"));
    }
}
