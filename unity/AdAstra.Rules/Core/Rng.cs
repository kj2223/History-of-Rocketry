// Persisted random streams, the same as js/core/rng.js (freeze §9.3). A stream is plain JSON: { algorithm, state }.
// Drawing advances only the stream passed in, so streams stay independent. The arithmetic is unsigned 32-bit, which is
// exactly what the JS gets from Math.imul and >>> 0, so the same seed gives the same draws in both games.
using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace AdAstra.Rules.Core
{
    public sealed class RngStream
    {
        [JsonProperty("algorithm")] public string Algorithm = Rng.Algorithm;
        [JsonProperty("state")] public uint State;
    }

    public static class Rng
    {
        public const string Algorithm = "mulberry32-v1";

        static readonly (string Name, uint Salt)[] Salts =
        {
            ("physical", 0x9e3779b9u), ("observation", 0x85ebca6bu), ("forecast", 0xc2b2ae35u),
        };

        public static Dictionary<string, RngStream> NewStreams(uint seed)
        {
            var d = new Dictionary<string, RngStream>();
            foreach (var (name, salt) in Salts) d[name] = new RngStream { State = seed ^ salt };
            return d;
        }

        // A float in [0, 1). Mutates stream.State.
        public static double Draw(RngStream s)
        {
            if (s.Algorithm != Algorithm) throw new InvalidOperationException($"Unknown random algorithm {s.Algorithm}");
            unchecked
            {
                s.State += 0x6d2b79f5u;
                uint t = s.State;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        // Standard normal draw (Box–Muller); always takes exactly two draws.
        public static double Normal(RngStream s)
        {
            double u = Draw(s);
            if (u == 0) u = 1e-12;
            double v = Draw(s);
            return Math.Sqrt(-2 * Math.Log(u)) * Math.Cos(2 * Math.PI * v);
        }
    }
}
