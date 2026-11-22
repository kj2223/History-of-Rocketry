// Sound, all made in code (no audio files): the desert wind outside, room tone in the hangar and the blockhouse's
// hum, a squelch on the net when someone calls, a key click for buttons, the count's last ten seconds, the motor
// (a rough, crackling roar whose loudness follows how far away she is), a break-up's boom and the thud of impact.
using UnityEngine;

namespace AdAstra.World
{
    public sealed class Sounds
    {
        const int Rate = 44100;
        readonly AudioSource wind, room, motor, oneShots;
        readonly AudioClip squelch, click, beep, boom, thud, ignite;
        float motorGoal, windGoal = 0.32f, roomGoal;

        public Sounds(GameObject on)
        {
            var rng = new System.Random(7);
            wind = Loop(on, Wind(rng, 8));
            room = Loop(on, RoomTone(rng, 4));
            motor = Loop(on, Roar(rng, 3));
            oneShots = on.AddComponent<AudioSource>(); oneShots.playOnAwake = false; oneShots.spatialBlend = 0;
            squelch = Squelch(rng); click = Click(rng); beep = Tone(880, 0.12f); boom = Boom(rng, 3.2f, 1); thud = Boom(rng, 1.6f, 0.45f);
            ignite = Boom(rng, 0.9f, 0.7f);
        }

        static AudioSource Loop(GameObject on, AudioClip c)
        {
            var s = on.AddComponent<AudioSource>();
            s.clip = c; s.loop = true; s.volume = 0; s.spatialBlend = 0; s.playOnAwake = false; s.Play();
            return s;
        }

        // Where we are: outdoors (wind), or in one of the rooms (wind faint through the walls, the room's own tone).
        public void Place(bool indoors, bool blockhouse)
        {
            windGoal = indoors ? 0.05f : 0.32f;
            roomGoal = indoors ? (blockhouse ? 0.22f : 0.12f) : 0;
            room.pitch = blockhouse ? 1f : 0.72f;
        }

        // The motor: on or off, and how far from the listener (metres). Loudness falls off with distance and a muffle.
        public void Motor(bool on, float distance)
        {
            if (!on) { motorGoal = 0; return; }
            float d = Mathf.Max(20, distance);
            motorGoal = Mathf.Clamp01(1.15f - Mathf.Log10(d / 20f) * 0.42f);
            motor.pitch = Mathf.Lerp(1f, 0.82f, Mathf.Clamp01(Mathf.Log10(d / 20f) / 2.5f));
        }

        public void Tick(float dt)
        {
            float k = 1 - Mathf.Exp(-dt * 6);
            wind.volume = Mathf.Lerp(wind.volume, windGoal, 1 - Mathf.Exp(-dt * 1.5f));
            room.volume = Mathf.Lerp(room.volume, roomGoal, 1 - Mathf.Exp(-dt * 1.5f));
            motor.volume = Mathf.Lerp(motor.volume, motorGoal, motorGoal > motor.volume ? 1 - Mathf.Exp(-dt * 30) : k);
        }

        public void Squelch() => oneShots.PlayOneShot(squelch, 0.35f);
        public void Click() => oneShots.PlayOneShot(click, 0.5f);
        public void Beep() => oneShots.PlayOneShot(beep, 0.22f);
        public void Ignite() => oneShots.PlayOneShot(ignite, 0.9f);
        public void Boom(float distance) => oneShots.PlayOneShot(boom, Mathf.Clamp(1.2f - Mathf.Log10(Mathf.Max(30, distance) / 30f) * 0.35f, 0.25f, 1));
        public void Thud() => oneShots.PlayOneShot(thud, 0.5f);
        public void StopAll() { motorGoal = 0; motor.volume = 0; }

        // ---- The clips
        static AudioClip Clip(string name, float[] d) { var c = AudioClip.Create(name, d.Length, 1, Rate, false); c.SetData(d, 0); return c; }

        static float N(System.Random r) => (float)(r.NextDouble() * 2 - 1);

        // Loops fade their ends into each other so they never click at the seam.
        static void Seam(float[] d, int fade)
        {
            int n = d.Length;
            for (int i = 0; i < fade; i++)
            {
                float k = i / (float)fade;
                d[i] = d[i] * k + d[n - fade + i] * (1 - k);
            }
        }

        static AudioClip Wind(System.Random r, float seconds)
        {
            int n = (int)(Rate * seconds);
            var d = new float[n];
            float b = 0, lp = 0, gust = 0;
            for (int i = 0; i < n; i++)
            {
                b = (b + 0.02f * N(r)) / 1.02f;                    // brown noise
                float t = i / (float)Rate;
                gust = 0.55f + 0.25f * Mathf.Sin(t * 0.9f) + 0.2f * Mathf.Sin(t * 2.3f + 1.3f);
                float cut = 0.02f + 0.03f * gust;                 // gusts open the filter: the whistle of it
                lp += cut * (b * 6 - lp);
                d[i] = lp * gust * 0.8f;
            }
            Seam(d, Rate);
            return Clip("Wind", Trim(d, Rate));
        }

        static AudioClip RoomTone(System.Random r, float seconds)
        {
            int n = (int)(Rate * seconds);
            var d = new float[n];
            float lp = 0;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate;
                lp += 0.01f * (N(r) - lp);
                // Mains hum (60 Hz and its harmonics) from the panel, and the air in the room.
                d[i] = 0.16f * Mathf.Sin(2 * Mathf.PI * 60 * t) + 0.08f * Mathf.Sin(2 * Mathf.PI * 120 * t) + 0.03f * Mathf.Sin(2 * Mathf.PI * 180 * t) + lp * 2.2f;
            }
            Seam(d, Rate / 2);
            return Clip("Room", Trim(d, Rate / 2));
        }

        static AudioClip Roar(System.Random r, float seconds)
        {
            int n = (int)(Rate * seconds);
            var d = new float[n];
            float b = 0, lp1 = 0, lp2 = 0, crackle = 0;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate;
                b = (b + 0.04f * N(r)) / 1.03f;
                lp1 += 0.06f * (N(r) - lp1);                        // the hiss band
                lp2 += 0.25f * (lp1 - lp2);
                if (r.NextDouble() < 0.0016) crackle = (float)r.NextDouble() * 0.9f + 0.3f;   // the crackle of a rough flame
                crackle *= 0.985f;
                float rumble = Mathf.Sin(2 * Mathf.PI * 31 * t + Mathf.Sin(t * 13) * 2) * 0.25f;
                d[i] = Mathf.Clamp(b * 4.5f + lp2 * 1.6f + crackle * N(r) * 0.8f + rumble, -1, 1) * 0.8f;
            }
            Seam(d, Rate / 3);
            return Clip("Motor", Trim(d, Rate / 3));
        }

        static AudioClip Squelch(System.Random r)
        {
            int n = (int)(Rate * 0.16f);
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate, env = Mathf.Clamp01(t / 0.005f) * Mathf.Clamp01((0.16f - t) / 0.04f);
                d[i] = (N(r) * 0.6f + 0.25f * Mathf.Sign(Mathf.Sin(2 * Mathf.PI * 1200 * t))) * env * 0.6f;
            }
            return Clip("Squelch", d);
        }

        static AudioClip Click(System.Random r)
        {
            int n = (int)(Rate * 0.05f);
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate;
                d[i] = (N(r) * 0.5f + Mathf.Sin(2 * Mathf.PI * 2400 * t) * 0.5f) * Mathf.Exp(-t * 160);
            }
            return Clip("Click", d);
        }

        static AudioClip Tone(float hz, float seconds)
        {
            int n = (int)(Rate * seconds);
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate, env = Mathf.Clamp01(t / 0.01f) * Mathf.Clamp01((seconds - t) / 0.03f);
                d[i] = Mathf.Sin(2 * Mathf.PI * hz * t) * env * 0.7f;
            }
            return Clip("Beep", d);
        }

        static AudioClip Boom(System.Random r, float seconds, float size)
        {
            int n = (int)(Rate * seconds);
            var d = new float[n];
            float b = 0, lp = 0;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate;
                b = (b + 0.05f * N(r)) / 1.02f;
                lp += 0.08f * (N(r) - lp);
                float env = Mathf.Clamp01(t / 0.008f) * Mathf.Exp(-t * 2.2f / size);
                float thump = Mathf.Sin(2 * Mathf.PI * (48 - 20 * t) * t) * Mathf.Exp(-t * 4 / size);
                d[i] = Mathf.Clamp(b * 5 * env + lp * 3 * env * Mathf.Exp(-t * 6) + thump * 0.9f, -1, 1) * 0.9f;
            }
            return Clip("Boom", d);
        }

        static float[] Trim(float[] d, int fade) { var o = new float[d.Length - fade]; System.Array.Copy(d, 0, o, 0, o.Length); return o; }
    }
}
