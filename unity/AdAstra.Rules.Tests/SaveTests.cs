// Saves: the same text as the JS game writes, the same refusals, the same fallbacks (tests/save-roundtrip, mode-saves).
using System;
using System.IO;
using AdAstra.Rules.Core;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace AdAstra.Rules.Tests
{
    public class SaveTests
    {
        static JObject Golden() =>
            JObject.Parse(File.ReadAllText(Path.Combine(TestContext.CurrentContext.TestDirectory, "Golden", "saves.json")));

        [Test]
        public void WritesExactlyWhatTheJsWrites()
        {
            var g = Golden();
            Assert.That(Save.Export(g["checkpoint"], Save.Flight), Is.EqualTo((string)g["flight"]));
            Assert.That(Save.Export(g["checkpoint"], Save.Management), Is.EqualTo((string)g["management"]));
            Assert.That(Save.Export(g["checkpoint"], Save.Desk), Is.EqualTo((string)g["desk"]));
        }

        [Test]
        public void ReadsJsSavesBack()
        {
            var g = Golden();
            var cp = Save.Parse((string)g["flight"], null, Save.Flight);
            Assert.That(JToken.DeepEquals(cp, g["checkpoint"]), Is.True);
        }

        [Test]
        public void RefusesTheWrongModeVersionOrJunk()
        {
            var g = Golden();
            var e = Assert.Throws<SaveError>(() => Save.Parse((string)g["management"], null, Save.Flight));
            Assert.That(e.Message, Is.EqualTo("This is a management save."));
            e = Assert.Throws<SaveError>(() => Save.Parse((string)g["flight"], null, Save.Desk));
            Assert.That(e.Message, Is.EqualTo("This is a Flight Director save."));
            e = Assert.Throws<SaveError>(() => Save.Parse("{\"format\":\"per-aspera\",\"contentVersion\":2,\"checkpoint\":{}}", null));
            Assert.That(e.Message, Does.StartWith("This save is from another version"));
            Assert.Throws<SaveError>(() => Save.Parse("not json", null));
            Assert.Throws<SaveError>(() => Save.Parse("{\"format\":\"other\"}", null));
            e = Assert.Throws<SaveError>(() => Save.Parse((string)g["flight"], _ => throw new Exception("no round")));
            Assert.That(e.Message, Is.EqualTo("The save is damaged: no round"));
        }

        [Test]
        public void FallsBackToTheLastGoodSave()
        {
            var store = new MemoryStorage();
            Save.Write(store, new JObject { ["day"] = 1 });
            Save.Write(store, new JObject { ["day"] = 2 });
            Assert.That((int)Save.Read(store, null)["day"], Is.EqualTo(2));
            store.SetItem(Save.Flight.Keys.Current, "garbage");
            Assert.That((int)Save.Read(store, null)["day"], Is.EqualTo(1));
        }

        [Test]
        public void StartingOverKeepsTheOldGameAsBackupAndSwapsBack()
        {
            var store = new MemoryStorage();
            Save.Write(store, new JObject { ["day"] = 9 });
            Save.StartOver(store, null);
            Assert.That(Save.Read(store, null), Is.Null);
            Save.Write(store, new JObject { ["day"] = 1 });
            Assert.That(Save.SwapBackup(store, null), Is.True);
            Assert.That((int)Save.Read(store, null)["day"], Is.EqualTo(9));
            Assert.That((int)Save.ReadBackup(store, null)["day"], Is.EqualTo(1));
        }

        [Test]
        public void ModesNeverShareASlot()
        {
            var store = new MemoryStorage();
            Save.Write(store, new JObject { ["fd"] = true }, Save.Flight);
            Save.Write(store, new JObject { ["m"] = true }, Save.Management);
            Assert.That(Save.Read(store, null, Save.Flight)["fd"], Is.Not.Null);
            Assert.That(Save.Read(store, null, Save.Management)["m"], Is.Not.Null);
            Save.Clear(store, Save.Management);
            Assert.That(Save.Read(store, null, Save.Management), Is.Null);
            Assert.That(Save.Read(store, null, Save.Flight), Is.Not.Null);
        }

        [Test]
        public void FileStorageRoundTrips()
        {
            var dir = Path.Combine(Path.GetTempPath(), "aa-save-" + Guid.NewGuid().ToString("N"));
            try
            {
                var store = new FileStorage(dir);
                Save.Write(store, new JObject { ["day"] = 4 });
                Save.Write(store, new JObject { ["day"] = 5 });
                Assert.That((int)Save.Read(new FileStorage(dir), null)["day"], Is.EqualTo(5));
            }
            finally { Directory.Delete(dir, true); }
        }
    }
}
