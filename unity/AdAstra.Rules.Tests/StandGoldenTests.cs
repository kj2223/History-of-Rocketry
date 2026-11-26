// The golden stand traces, replayed: creation then a static firing, short and long burns, compared point for point —
// the trace, the steady chamber pressure, the wall temperature, a hold-down that breaks loose, the events, and the
// streams' end states.
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
    public class StandGoldenTests
    {
        static string Dir => TestContext.CurrentContext.TestDirectory;
        static JArray Golden() => JArray.Parse(File.ReadAllText(Path.Combine(Dir, "Golden", "stand.json")));
        static GameData Data => GameData.FromFolder(Path.Combine(Dir, "Data"));

        [TestCaseSource(nameof(Cases))]
        public void MatchesTheJs(JObject expected)
        {
            var data = Data;
            JObject programme = (string)expected["programme"] == "lot"
                ? new JObject { ["lotVehicle"] = "wac", ["batch"] = new JObject { ["weld"] = true }, ["weldRisk"] = 0.9 }
                : null;
            var vehicle = (string)expected["vehicle"];
            foreach (var burnCase in new[] { ("short", expected["short"]), ("long", expected["long"]) })
            {
                if (burnCase.Item2 == null || burnCase.Item2.Type == JTokenType.Null) continue; // the lot cases record the short burn only
                var want = (JObject)burnCase.Item2;
                var r = RoundRules.NewRound((uint)expected["seed"].Value<uint>(), programme, vehicle, data);
                var fire = RoundRules.StaticFire(r, burnCase.Item1, data);
                Assert.That(fire.Trace.Count, Is.EqualTo(want["trace"].Count()), $"{vehicle} {burnCase.Item1} points");
                for (int i = 0; i < fire.Trace.Count; i++)
                {
                    var got = fire.Trace[i];
                    var exp = (JObject)want["trace"][i];
                    Assert.That(got.T, Is.EqualTo(exp["t"].Value<double>()).Within(1e-12), $"{vehicle} {burnCase.Item1} t[{i}]");
                    Assert.That(got.Pc, Is.EqualTo(exp["pc"].Value<double>()).Within(1e-9), $"{vehicle} {burnCase.Item1} pc[{i}]");
                    Assert.That(got.Tank, Is.EqualTo(exp["tank"].Value<double>()).Within(1e-9), $"{vehicle} {burnCase.Item1} tank[{i}]");
                    var expWall = exp["wall"]?.Type == JTokenType.Null || exp["wall"] == null ? (double?)null : exp["wall"].Value<double>();
                    if (expWall.HasValue) Assert.That(got.Wall, Is.EqualTo(expWall).Within(1e-9), $"{vehicle} {burnCase.Item1} wall[{i}]");
                    else Assert.That(got.Wall, Is.Null, $"{vehicle} {burnCase.Item1} wall[{i}] absent");
                }
                Assert.That(fire.Steady, Is.EqualTo(want["steady"].Value<double>()).Within(1e-9), $"{vehicle} {burnCase.Item1} steady");
                var expLoose = want["loose"].Type == JTokenType.Null ? (double?)null : want["loose"].Value<double>();
                Assert.That(fire.Loose, Is.EqualTo(expLoose), $"{vehicle} {burnCase.Item1} loose");
                var expWallResult = want["wall"].Type == JTokenType.Null ? (double?)null : want["wall"].Value<double>();
                Assert.That(fire.Wall, Is.EqualTo(expWallResult), $"{vehicle} {burnCase.Item1} wall");
                Assert.That(r.Events, Is.EqualTo(want["events"].ToObject<List<string>>()), $"{vehicle} {burnCase.Item1} events");
                Assert.That((uint)want["streamEnd"]["physical"], Is.EqualTo(r.Rng["physical"].State), $"{vehicle} {burnCase.Item1} physical stream");
                Assert.That((uint)want["streamEnd"]["observation"], Is.EqualTo(r.Rng["observation"].State), $"{vehicle} {burnCase.Item1} observation stream");
                Assert.That((uint)want["streamEnd"]["forecast"], Is.EqualTo(r.Rng["forecast"].State), $"{vehicle} {burnCase.Item1} forecast stream");
            }
        }

        static IEnumerable<TestCaseData> Cases() =>
            Golden().Cast<JObject>().Select(c =>
                new TestCaseData(c).SetName($"{c["vehicle"]} · {(string)c["programme"] ?? "default"} · seed {c["seed"]}"));
    }
}
