// The game's data, as tools/export-data.mjs wrote it from js/data: one JSON object per module, each holding that
// module's exports. Functions in the JS data are marked { "$function": path } and translated by hand in C#.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
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
                d.Modules[name] = Resolve(JObject.Parse(File.ReadAllText(f)), name);
            }
            return d;
        }

        // From text already loaded (in Unity: TextAssets), keyed by module name.
        public static GameData FromTexts(IEnumerable<KeyValuePair<string, string>> modules)
        {
            var d = new GameData();
            foreach (var kv in modules) if (!kv.Key.StartsWith("_")) d.Modules[kv.Key] = Resolve(JObject.Parse(kv.Value), kv.Key);
            return d;
        }

        // The exporter marks a value shared between two places as { "$ref": "module.path" }. Resolve those against the
        // module's own document, so a shared spot (say WAC's fitting, reused by the Aerobee kit) reads the same here as
        // it does in the JS. Refs may chain; a depth cap turns a cycle into an error instead of a hang.
        static JObject Resolve(JObject module, string name)
        {
            ResolveNode(module, module, name, 0);
            return module;
        }

        static void ResolveNode(JToken node, JObject root, string moduleName, int depth)
        {
            if (depth > 100) throw new InvalidDataException($"Ref cycle at or under $ref in {moduleName}");
            if (node is JObject o)
            {
                foreach (var p in o.Properties().ToList())
                {
                    if (p.Value is JObject v && v.Count == 1 && v["$ref"] != null)
                    {
                        // Replace the marker in place: the target was resolved before this token reached it (the exporter
                        // only ever points at something earlier in the document).
                        p.Value = ReplaceMarker(root, moduleName, (string)v["$ref"], depth);
                        continue;
                    }
                    ResolveNode(p.Value, root, moduleName, depth + 1);
                }
            }
            else if (node is JArray a)
            {
                for (int i = 0; i < a.Count; i++)
                {
                    if (a[i] is JObject v && v.Count == 1 && v["$ref"] != null)
                        a[i] = ReplaceMarker(root, moduleName, (string)v["$ref"], depth);
                    else
                        ResolveNode(a[i], root, moduleName, depth + 1);
                }
            }
        }

        static JToken ReplaceMarker(JObject root, string moduleName, string path, int depth)
        {
            var target = Lookup(root, moduleName, path, depth);
            if (target is JObject t && t.Count == 1 && t["$ref"] != null) target = ReplaceMarker(root, moduleName, (string)t["$ref"], depth + 1);
            return target.DeepClone();
        }

        static JToken Lookup(JObject root, string moduleName, string path, int depth)
        {
            var parts = path.Split('.');
            if (parts[0] != moduleName) throw new InvalidDataException($"$ref {path} leaves module {moduleName}");
            JToken cur = root;
            for (int i = 1; i < parts.Length; i++)
            {
                var seg = parts[i];
                if (seg.Length == 0) throw new InvalidDataException($"$ref {path} has an empty step");
                // A step is a property name, then markers: <i> steps into a $map (element i), {i} into a $set,
                // [i] into a plain array (repeated markers chain).
                int at = 0;
                while (at < seg.Length)
                {
                    var m = System.Text.RegularExpressions.Regex.Match(seg.Substring(at), @"^([^<>{}\[\]]*)(<([0-9]+)>|\{([0-9]+)\}|\[([0-9]+)\])?");
                    if (!m.Success || (m.Groups[1].Length == 0 && m.Groups[2].Length == 0))
                        throw new InvalidDataException($"$ref {path}: cannot read step '{seg}'");
                    if (m.Groups[1].Length > 0)
                    {
                        cur = cur?[m.Groups[1].Value];
                        if (cur == null) throw new InvalidDataException($"$ref {path}: missing '{m.Groups[1].Value}' in {moduleName}");
                    }
                    if (m.Groups[2].Length > 0)
                    {
                        var digits = m.Groups[3].Success ? m.Groups[3].Value : m.Groups[4].Success ? m.Groups[4].Value : m.Groups[5].Value;
                        int index = int.Parse(digits);
                        var obj = cur as JObject;
                        if (obj != null && obj["$map"] != null) cur = obj["$map"][index];      // a [key, value] entry
                        else if (obj != null && obj["$set"] != null) cur = obj["$set"][index]; // an element
                        else cur = cur[index];                                  // a plain array
                        if (cur == null) throw new InvalidDataException($"$ref {path}: missing index in '{seg}'");
                    }
                    at += m.Length;
                }
            }
            return cur;
        }
    }
}
