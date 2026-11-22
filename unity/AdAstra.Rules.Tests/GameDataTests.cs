// The exported data loads, and every module the JS game has is there.
using System.IO;
using System.Linq;
using AdAstra.Rules.Core;
using NUnit.Framework;

namespace AdAstra.Rules.Tests
{
    public class GameDataTests
    {
        static string Dir => Path.Combine(TestContext.CurrentContext.TestDirectory, "Data");

        [Test]
        public void EveryJsDataModuleIsExported()
        {
            var data = GameData.FromFolder(Dir);
            var js = Directory.GetFiles(Path.Combine(TestContext.CurrentContext.TestDirectory, "JsData"), "*.js")
                .Select(Path.GetFileNameWithoutExtension).ToList();
            Assert.That(js, Is.Not.Empty);
            foreach (var m in js) Assert.That(data.Modules.ContainsKey(m), Is.True, m);
        }

        [Test]
        public void KnownFactsComeThrough()
        {
            var data = GameData.FromFolder(Dir);
            Assert.That(data.Modules["campaign"].Properties().Count(), Is.GreaterThan(0));
            Assert.That(data.Modules["vehicles"].Properties().Count(), Is.GreaterThan(0));
        }
    }
}
