// Smoke and fire, as particles: soft billboard puffs with the sun baked into their texture (lit on top, shaded under),
// that grow, slow and thin out; and additive fire for the motor and a break-up. Replaces the solid balls the first build
// used. The WAC's acid and aniline exhaust leaves a rust-brown cloud; the Tiny Tim booster's solid motor a white one.
using UnityEngine;

namespace AdAstra.World
{
    public sealed class Plumes
    {
        public static readonly Color Booster = new Color(0.94f, 0.92f, 0.88f), Acid = new Color(0.86f, 0.62f, 0.44f),
            Dust = new Color(0.84f, 0.76f, 0.62f), Wreck = new Color(0.32f, 0.3f, 0.28f);

        readonly ParticleSystem smoke, fire;

        public Plumes()
        {
            smoke = Make("Smoke particles", new Material(Shader.Find("AdAstra/Smoke")) { mainTexture = PuffTexture(128) }, 6000, true);
            fire = Make("Fire particles", new Material(Shader.Find("AdAstra/Fire")) { mainTexture = GlowTexture(64) }, 2500, false);
        }

        static ParticleSystem Make(string name, Material mat, int max, bool isSmoke)
        {
            var go = new GameObject(name);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = false; main.playOnAwake = false; main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.scalingMode = ParticleSystemScalingMode.Shape;
            main.gravityModifier = isSmoke ? -0.015f : -0.05f;   // warm smoke rises a little
            var em = ps.emission; em.enabled = false;
            var shape = ps.shape; shape.enabled = false;

            var size = ps.sizeOverLifetime; size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1, isSmoke
                ? new AnimationCurve(new Keyframe(0, 0.35f, 0, 6), new Keyframe(0.15f, 1f), new Keyframe(1, 3.2f, 1.2f, 0))
                : new AnimationCurve(new Keyframe(0, 0.6f), new Keyframe(0.2f, 1f), new Keyframe(1, 1.6f)));

            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            if (isSmoke)
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                          new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(0.85f, 0.06f), new GradientAlphaKey(0.55f, 0.45f), new GradientAlphaKey(0, 1) });
            else
                g.SetKeys(new[] { new GradientColorKey(new Color(1f, 0.97f, 0.85f), 0), new GradientColorKey(new Color(1f, 0.62f, 0.22f), 0.35f), new GradientColorKey(new Color(0.7f, 0.18f, 0.05f), 1) },
                          new[] { new GradientAlphaKey(1, 0), new GradientAlphaKey(0.7f, 0.4f), new GradientAlphaKey(0, 1) });
            col.color = new ParticleSystem.MinMaxGradient(g);

            var drag = ps.limitVelocityOverLifetime; drag.enabled = true;
            drag.limit = new ParticleSystem.MinMaxCurve(10000); drag.drag = new ParticleSystem.MinMaxCurve(isSmoke ? 0.45f : 1.2f);
            drag.multiplyDragByParticleSize = false; drag.multiplyDragByParticleVelocity = false;

            var rot = ps.rotationOverLifetime; rot.enabled = true;
            rot.z = new ParticleSystem.MinMaxCurve(-0.25f, 0.25f);

            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = mat;
            r.renderMode = ParticleSystemRenderMode.Billboard;
            r.sortMode = isSmoke ? ParticleSystemSortMode.Distance : ParticleSystemSortMode.None;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            r.minParticleSize = 0; r.maxParticleSize = 4;
            ps.Play();
            return ps;
        }

        public void Smoke(Vector3 at, Vector3 vel, float size, float life, Color tint)
        {
            var e = new ParticleSystem.EmitParams
            {
                position = at, velocity = vel, startSize = size * Random.Range(0.8f, 1.25f), startLifetime = life * Random.Range(0.8f, 1.2f),
                rotation = Random.Range(0f, 360f), startColor = tint * Random.Range(0.92f, 1.04f),
            };
            e.startColor = new Color(e.startColor.r, e.startColor.g, e.startColor.b, tint.a);
            smoke.Emit(e, 1);
        }

        public void Fire(Vector3 at, Vector3 vel, float size, float life)
        {
            var e = new ParticleSystem.EmitParams
            {
                position = at, velocity = vel, startSize = size * Random.Range(0.75f, 1.2f), startLifetime = life * Random.Range(0.8f, 1.2f),
                rotation = Random.Range(0f, 360f), startColor = Color.white,
            };
            fire.Emit(e, 1);
        }

        public int Count => smoke.particleCount;

        public void Clear() { smoke.Clear(); fire.Clear(); }

        // A puff: a few overlapping noise blobs inside a soft circle, lit from above and the sun's side.
        static Texture2D PuffTexture(int n)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, name = "Puff" };
            var px = new Color[n * n];
            var light = new Vector3(-0.45f, 0.75f, 0.5f).normalized;
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2 - 1, v = (y + 0.5f) / n * 2 - 1;
                    float r = Mathf.Sqrt(u * u + v * v);
                    float noise = Fbm(u * 2.2f + 7.3f, v * 2.2f + 1.7f);
                    float edge = 1 - Mathf.SmoothStep(0.35f, 1.0f, r + (noise - 0.5f) * 0.55f);
                    float a = Mathf.Clamp01(edge * (0.65f + 0.6f * noise));
                    // A sphere's normal under the puff, roughened by the noise, lit by the sun.
                    float z = Mathf.Sqrt(Mathf.Max(0, 1 - Mathf.Min(1, r * r)));
                    var nrm = new Vector3(u + (noise - 0.5f) * 0.6f, v + (noise - 0.5f) * 0.6f, z).normalized;
                    float lit = Mathf.Clamp01(Vector3.Dot(nrm, light) * 0.5f + 0.55f);
                    float shade = Mathf.Lerp(0.6f, 1.06f, lit);
                    px[y * n + x] = new Color(shade, shade * 0.99f, shade * 0.97f, a);
                }
            t.SetPixels(px); t.Apply(true);
            return t;
        }

        static Texture2D GlowTexture(int n)
        {
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Clamp, name = "Glow" };
            var px = new Color[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2 - 1, v = (y + 0.5f) / n * 2 - 1;
                    float r = Mathf.Sqrt(u * u + v * v);
                    float a = Mathf.Pow(Mathf.Clamp01(1 - r), 1.8f) * (0.8f + 0.4f * Fbm(u * 3 + 2, v * 3 + 5));
                    px[y * n + x] = new Color(1, 1, 1, Mathf.Clamp01(a));
                }
            t.SetPixels(px); t.Apply(true);
            return t;
        }

        static float Fbm(float x, float y)
        {
            float s = 0, a = 0.5f, f = 1;
            for (int i = 0; i < 4; i++) { s += a * Mathf.PerlinNoise(x * f, y * f); f *= 2.03f; a *= 0.5f; }
            return s / 0.9375f;
        }
    }
}
