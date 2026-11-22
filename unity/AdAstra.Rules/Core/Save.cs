// Saving and resuming, the same format as js/core/save.js, so a save is plain JSON either game can read.
// The game saves a checkpoint at the start of each work day. Knows nothing about the rules: the caller passes a
// check(checkpoint) that throws on a bad shape. Each mode keeps its own slot (current, last good and backup), so a
// Flight Director game and a management game never overwrite each other and neither save loads as the other.
using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AdAstra.Rules.Core
{
    public sealed class SaveError : Exception
    {
        public SaveError(string message) : base(message) { }
    }

    public sealed class SaveKeys
    {
        public string Current, LastGood, Backup, Unreadable;
        public IEnumerable<string> All()
        {
            yield return Current; yield return LastGood; yield return Backup;
            if (Unreadable != null) yield return Unreadable;
        }
    }

    public sealed class SaveSlot
    {
        public string Mode;
        public SaveKeys Keys;
        public int ContentVersion;
    }

    // Where saves are kept: browser storage in the JS game, files here. Same three calls.
    public interface ISaveStorage
    {
        string GetItem(string key);
        void SetItem(string key, string value);
        void RemoveItem(string key);
    }

    public sealed class MemoryStorage : ISaveStorage
    {
        readonly Dictionary<string, string> data = new Dictionary<string, string>();
        public string GetItem(string key) => data.TryGetValue(key, out var v) ? v : null;
        public void SetItem(string key, string value) => data[key] = value;
        public void RemoveItem(string key) => data.Remove(key);
    }

    // One file per key in a folder (in the game: %APPDATA%\Ad Astra\saves). Written to a temporary file first and
    // then moved into place, so a crash mid-write never leaves half a save.
    public sealed class FileStorage : ISaveStorage
    {
        readonly string dir;
        public FileStorage(string dir) { this.dir = dir; Directory.CreateDirectory(dir); }
        string PathOf(string key) => Path.Combine(dir, key + ".json");
        public string GetItem(string key) => File.Exists(PathOf(key)) ? File.ReadAllText(PathOf(key)) : null;
        public void SetItem(string key, string value)
        {
            var tmp = PathOf(key) + ".tmp";
            File.WriteAllText(tmp, value);
            if (File.Exists(PathOf(key))) File.Delete(PathOf(key));
            File.Move(tmp, PathOf(key));
        }
        public void RemoveItem(string key) { if (File.Exists(PathOf(key))) File.Delete(PathOf(key)); }
    }

    public static class Save
    {
        public const string Format = "per-aspera";
        public const int ContentVersion = 3; // 3: V-2 and Bumper rounds, seats and offers; 2: a season of rounds; 1: one round

        public static readonly SaveSlot Flight = new SaveSlot
        {
            Mode = "flight",
            ContentVersion = ContentVersion,
            Keys = new SaveKeys { Current = "pa-game", LastGood = "pa-game-last-good", Backup = "pa-game-backup", Unreadable = "pa-game-unreadable" },
        };
        public static readonly SaveSlot Management = new SaveSlot
        {
            Mode = "management",
            ContentVersion = 1,
            Keys = new SaveKeys { Current = "aa-manage", LastGood = "aa-manage-last-good", Backup = "aa-manage-backup" },
        };
        public static readonly SaveSlot Desk = new SaveSlot
        {
            Mode = "desk",
            ContentVersion = 1,
            Keys = new SaveKeys { Current = "aa-desk", LastGood = "aa-desk-last-good", Backup = "aa-desk-backup" },
        };

        // Flight Director saves carry no mode field, exactly as the JS writes them, so old saves still load.
        public static string Export(JToken checkpoint, SaveSlot slot = null)
        {
            slot ??= Flight;
            var env = new JObject { ["format"] = Format };
            if (slot.Mode != Flight.Mode) env["mode"] = slot.Mode;
            env["contentVersion"] = slot.ContentVersion;
            env["checkpoint"] = checkpoint;
            return env.ToString(Formatting.None);
        }

        public static JToken Parse(string text, Action<JToken> check, SaveSlot slot = null)
        {
            slot ??= Flight;
            JObject env;
            try { env = JObject.Parse(text); }
            catch (JsonException) { throw new SaveError("This is not a readable save."); }
            if ((string)env["format"] != Format) throw new SaveError("This is not an Ad Astra save.");
            var mode = (string)env["mode"] ?? Flight.Mode;
            if (mode != slot.Mode)
                throw new SaveError($"This is a {(mode == "management" ? "management" : "Flight Director")} save.");
            var cv = env["contentVersion"];
            if (cv == null || cv.Type != JTokenType.Integer || (int)cv != slot.ContentVersion)
                throw new SaveError($"This save is from another version of the game (content {cv}).");
            var checkpoint = env["checkpoint"];
            try { check?.Invoke(checkpoint); }
            catch (Exception e) when (!(e is SaveError)) { throw new SaveError($"The save is damaged: {e.Message}"); }
            return checkpoint;
        }

        public static void Write(ISaveStorage storage, JToken checkpoint, SaveSlot slot = null)
        {
            slot ??= Flight;
            var text = Export(checkpoint, slot);
            // The checkpoint before this one becomes the fallback, so a bad checkpoint never takes its own fallback with it.
            var previous = storage.GetItem(slot.Keys.Current);
            if (previous != text) storage.SetItem(slot.Keys.LastGood, previous ?? text);
            storage.SetItem(slot.Keys.Current, text);
        }

        // The saved checkpoint, falling back to the last good one. Null when nothing usable is saved.
        public static JToken Read(ISaveStorage storage, Action<JToken> check, SaveSlot slot = null)
        {
            slot ??= Flight;
            foreach (var key in new[] { slot.Keys.Current, slot.Keys.LastGood })
            {
                var text = storage.GetItem(key);
                if (text == null) continue;
                try { return Parse(text, check, slot); }
                catch (SaveError) { /* try the next one */ }
            }
            return null;
        }

        // Starting a new game keeps the one you were playing as the backup, so starting over never loses a game.
        public static void StartOver(ISaveStorage storage, Action<JToken> check, SaveSlot slot = null)
        {
            slot ??= Flight;
            var current = Read(storage, check, slot);
            if (current != null) storage.SetItem(slot.Keys.Backup, Export(current, slot));
            storage.RemoveItem(slot.Keys.Current);
            storage.RemoveItem(slot.Keys.LastGood);
        }

        public static JToken ReadBackup(ISaveStorage storage, Action<JToken> check, SaveSlot slot = null)
        {
            slot ??= Flight;
            var text = storage.GetItem(slot.Keys.Backup);
            if (text == null) return null;
            try { return Parse(text, check, slot); }
            catch (SaveError) { return null; }
        }

        // Go back to the backup: it becomes the current game, and the current game becomes the backup.
        public static bool SwapBackup(ISaveStorage storage, Action<JToken> check, SaveSlot slot = null)
        {
            slot ??= Flight;
            var backup = ReadBackup(storage, check, slot);
            if (backup == null) return false;
            var current = Read(storage, check, slot);
            if (current != null) storage.SetItem(slot.Keys.Backup, Export(current, slot));
            else storage.RemoveItem(slot.Keys.Backup);
            Write(storage, backup, slot);
            return true;
        }

        public static void Clear(ISaveStorage storage, SaveSlot slot = null)
        {
            slot ??= Flight;
            foreach (var k in slot.Keys.All()) storage.RemoveItem(k);
        }
    }
}
