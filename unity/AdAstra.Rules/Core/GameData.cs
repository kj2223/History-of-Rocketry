// The game's data, as tools/export-data.mjs wrote it from js/data: one JSON object per module, each holding that
// module's exports. Functions in the JS data are marked { "$function": path } and translated by hand in C#.
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;

namespace AdAstra.Rules.Core
{
    public sealed class GameData
    {
        public readonly Dictionary<string, JObject> Modules = new Dictionary<string, JObject>();

        public JToken this[string module, string export] => Modules[module][export];

        // From a folder of exported JSON (tests, tools).
        public static GameData FromFolder(string dir)
        {
            var d = new GameData();
            foreach (var f in Directory.GetFiles(dir, "*.json"))
            {
                var name = Path.GetFileNameWithoutExtension(f);
                if (name.StartsWith("_")) continue;
                d.Modules[name] = JObject.Parse(File.ReadAllText(f));
            }
            return d;
        }

        // From text already loaded (in Unity: TextAssets), keyed by module name.
        public static GameData FromTexts(IEnumerable<KeyValuePair<string, string>> modules)
        {
            var d = new GameData();
            foreach (var kv in modules) if (!kv.Key.StartsWith("_")) d.Modules[kv.Key] = JObject.Parse(kv.Value);
            return d;
        }
    }
}
