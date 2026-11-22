// The C# random streams must give exactly the JS draws, or no golden trace could ever match.
using System.IO;
using AdAstra.Rules.Core;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace AdAstra.Rules.Tests
{
    public class RngTests
    {
        [Test]
        public void SameSeedsGiveTheJsDraws()
        {
            var golden = JArray.Parse(File.ReadAllText(Path.Combine(TestContext.CurrentContext.TestDirectory, "Golden", "rng.json")));
            Assert.That(golden.Count, Is.GreaterThan(0));
            foreach (var rec in golden)
            {
                uint seed = (uint)(long)rec["seed"];
                var streams = Rng.NewStreams(seed);
                foreach (var kv in streams)
                    Assert.That(kv.Value.State, Is.EqualTo((uint)(long)rec["start"][kv.Key]), $"seed {seed} {kv.Key} start");
                foreach (var kv in streams)
                {
                    var draws = (JArray)rec["draws"][kv.Key];
                    foreach (var d in draws) Assert.That(Rng.Draw(kv.Value), Is.EqualTo((double)d), $"seed {seed} {kv.Key}");
                }
                foreach (var n in (JArray)rec["normals"])
                    Assert.That(Rng.Normal(streams["physical"]), Is.EqualTo((double)n).Within(1e-12), $"seed {seed} normal");
                foreach (var kv in streams)
                    Assert.That(kv.Value.State, Is.EqualTo((uint)(long)rec["end"][kv.Key]), $"seed {seed} {kv.Key} end");
            }
        }

        [Test]
        public void AnUnknownAlgorithmIsRefused()
        {
            var s = new RngStream { Algorithm = "other", State = 1 };
            Assert.Throws<System.InvalidOperationException>(() => Rng.Draw(s));
        }
    }
}
