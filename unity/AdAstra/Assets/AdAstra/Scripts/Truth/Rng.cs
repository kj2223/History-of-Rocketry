// Seeded randomness for the hidden truth. Two streams per round, as in the game (core/rng.js): 'physical' decides what
// the hardware really does, 'observation' decides what people see of it. Hashes of the seed give draws that never shift
// the streams (the test kit, the wind, the decay needle).
using System;

namespace AdAstra.Truth
{
    public sealed class Stream
    {
        uint s;
        public Stream(uint seed) { s = seed == 0 ? 0x9E3779B9u : seed; }

        // mulberry32
        public double Next()
        {
            unchecked
            {
                s += 0x6D2B79F5u;
                uint t = s;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        public double Normal()
        {
            double u = 1.0 - Next(), v = Next();
            return Math.Sqrt(-2.0 * Math.Log(u)) * Math.Cos(2.0 * Math.PI * v);
        }
    }

    public static class Hash
    {
        public static double H01(int seed, int salt)
        {
            unchecked
            {
                uint h = (uint)seed ^ ((uint)(salt + 17) * 0x9E3779B1u);
                h *= 2654435761u;
                h ^= h >> 15;
                h *= 2246822507u;
                h ^= h >> 13;
                return h / 4294967296.0;
            }
        }

        public static double H01(int seed, string id, int salt)
        {
            unchecked
            {
                uint h = (uint)seed ^ ((uint)(salt + 11) * 0x9E3779B1u);
                foreach (char ch in id) h = (h ^ ch) * 2654435761u;
                h ^= h >> 15;
                h *= 2246822507u;
                h ^= h >> 13;
                return h / 4294967296.0;
            }
        }

        // round.js flutter(): a small signed wobble, +-0.15.
        public static double Flutter(int seed, int step)
        {
            unchecked
            {
                uint h = ((uint)seed ^ ((uint)(step + 1) * 2654435761u)) * 2246822507u;
                h = (h ^ (h >> 13)) * 3266489909u;
                h ^= h >> 16;
                return (h / 4294967296.0 - 0.5) * 0.3;
            }
        }
    }
}
