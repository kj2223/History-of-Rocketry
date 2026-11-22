// WHITE SANDS PROVING GROUND, 1945, built in 3D out of code: the desert flat under the Organ Mountains, the WAC launch
// tower and its round, the blockhouse, the static stand and its dugout, the assembly hangar, poles and trucks. The two
// rooms you work in (the hangar floor and the blockhouse) are separate cut-away dioramas off to the side of the map.
// Everything here is presentation: nothing in this file changes what happens to a round.
using System.Collections.Generic;
using UnityEngine;

namespace AdAstra.World
{
    public sealed class View
    {
        public Vector3 Pos, Target; public float Fov, Focus;
        public View(Vector3 pos, Vector3 target, float fov = 40, float focus = 0.45f) { Pos = pos; Target = target; Fov = fov; Focus = focus; }
    }

    public sealed class Person
    {
        public string Id, Name;
        public Transform Root;
        Renderer quad;
        Material front, back;
        public bool Back;
        public Vector3 Goal;
        public float Height;

        public Person(string id, string name, Look look, Transform parent, Shader sprite, Material blob, float height = 2.6f)
        {
            Id = id; Name = name; Height = height;
            Root = new GameObject(name).transform;
            Root.SetParent(parent, false);
            front = SpriteMat(sprite, PixelArt.Person(look, false));
            back = SpriteMat(sprite, PixelArt.Person(look, true));
            var q = Geo.Prim(PrimitiveType.Quad, Root, front, new Vector3(0, height / 2, 0), new Vector3(height / 2, height, 1));
            q.layer = PixelView.SpriteLayer;
            quad = q.GetComponent<Renderer>();
            quad.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            var s = Geo.Prim(PrimitiveType.Quad, Root, blob, new Vector3(0, 0.08f, 0), new Vector3(height * 0.45f, height * 0.25f, 1), new Vector3(90, 0, 0));
            s.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            Goal = Root.position;
        }

        static Material SpriteMat(Shader sh, Texture2D t)
        {
            var m = new Material(sh) { mainTexture = t };
            m.SetFloat("_AlphaClip", 1); m.EnableKeyword("_ALPHATEST_ON");
            m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
            if (m.HasProperty("_Cutoff")) m.SetFloat("_Cutoff", 0.5f);
            if (m.HasProperty("_Color")) m.color = new Color(1.05f, 1.02f, 0.98f);
            return m;
        }

        public void Put(Vector3 p, bool facingAway = false) { Root.position = p; Goal = p; Back = facingAway; Root.gameObject.SetActive(true); }
        public void WalkTo(Vector3 p) { Goal = p; }
        public void Hide() => Root.gameObject.SetActive(false);
        public bool Shown => Root.gameObject.activeSelf;
        public Vector3 Head => Root.position + Vector3.up * (Height + 0.3f);

        // Face the camera around the vertical only, so the pixel people stand up straight in the 3D world.
        public void Tick(Camera cam, float dt)
        {
            var d = Goal - Root.position; d.y = 0;
            float step = 3.2f * dt;
            if (d.magnitude > step) Root.position += d.normalized * step; else Root.position = new Vector3(Goal.x, Root.position.y, Goal.z);
            var f = cam.transform.position - Root.position; f.y = 0;
            if (f.sqrMagnitude > 0.001f) Root.rotation = Quaternion.LookRotation(-f.normalized, Vector3.up);
            quad.sharedMaterial = Back ? back : front;
        }
    }

    public sealed class Site
    {
        public Transform Root;
        public Transform Tower, TowerPivot, Rocket, RocketFlame, StandStage, StandFlame, HangarStage, BlockhouseClock;
        public Light Sun, StandLight, RocketLight;
        public Dictionary<string, Transform> SpotAnchors = new Dictionary<string, Transform>();
        public Dictionary<string, Person> People = new Dictionary<string, Person>();
        public Dictionary<string, View> Views = new Dictionary<string, View>();
        public Transform Sky;
        public Material Smoke, Debris, Flash;

        public static readonly Vector3 TowerAt = new Vector3(0, 0, 0), BlockhouseAt = new Vector3(-46, 0, -34),
            StandAt = new Vector3(58, 0, -22), HangarAt = new Vector3(-36, 0, -96), OfficeAt = new Vector3(14, 0, -88);
        // The rooms sit well below the desert floor so their floors never share a plane with it (that was the z-fighting).
        public const float RoomFloor = -400;
        public static readonly Vector3 HangarRoom = new Vector3(1200, RoomFloor, 0), BlockhouseRoom = new Vector3(-1200, RoomFloor, 0);

        Material sand, scrub, concrete, steel, rust, wood, olive, white, black, dark, earth, canvas, glass, mountain, bulb;
        Shader spriteShader; Material blob;

        public Site()
        {
            Root = new GameObject("White Sands 1945").transform;
            MakeMaterials();
            Light();
            Ground();
            Mountains();
            BuildTower();
            BuildBlockhouse();
            BuildStand();
            BuildHangar();
            BuildOffice();
            Poles();
            Trucks();
            HangarInterior();
            BlockhouseInterior();
            MakePeople();
            MakeViews();
        }

        void MakeMaterials()
        {
            var ground = PixelArt.Mottle(64, new[] { "#c9b48a", "#bda77c", "#d6c49c", "#b29c70", "#cdb990", "#a99267" }, 7, 900, 3);
            sand = Geo.Mat("#ffffff"); sand.mainTexture = ground; sand.mainTextureScale = new Vector2(220, 220);
            scrub = Geo.Mat("#5c6a3a");
            concrete = Geo.Mat("#b8b2a4");
            steel = Geo.Mat("#8a8f92", 0.3f, 0.4f);
            rust = Geo.Mat("#9a6a48", 0.15f, 0.2f);
            wood = Geo.Mat("#ffffff"); wood.mainTexture = PixelArt.Planks("#9c7a54", "#7a5c3c"); wood.mainTextureScale = new Vector2(4, 4);
            olive = Geo.Mat("#5a6240");
            white = Geo.Mat("#ecebe4", 0.35f, 0.1f);
            black = Geo.Mat("#26262a", 0.2f);
            dark = Geo.Mat("#3c3e40");
            earth = Geo.Mat("#a8946c");
            canvas = Geo.Mat("#b9ab84");
            glass = Geo.Mat("#7d97a4", 0.7f);
            mountain = Geo.Mat("#8d8a9a");
            bulb = Geo.Glow("#fff1c8", 2.5f);
            Smoke = Geo.Mat("#efe9dc");
            Debris = Geo.Mat("#3a3a3a");
            Flash = new Material(Shader.Find("AdAstra/Additive")) { color = new Color(1f, 0.85f, 0.6f, 1f) };
            spriteShader = Shader.Find("Universal Render Pipeline/Simple Lit"); // lit, no highlights, like the old Diffuse
            blob = new Material(Shader.Find("AdAstra/UnlitAlpha")) { mainTexture = PixelArt.Blob(), color = new Color(0.12f, 0.08f, 0.04f, 0.45f) };
        }

        void Light()
        {
            var go = new GameObject("Sun");
            Sun = go.AddComponent<Light>();
            Sun.type = LightType.Directional;
            Sun.color = Geo.Hex("#fff0d4");
            Sun.intensity = 1.25f;
            Sun.shadows = LightShadows.Soft;
            Sun.shadowStrength = 0.85f;
            Sun.shadowBias = 0.06f;
            Sun.shadowNormalBias = 0.7f;
            go.transform.rotation = Quaternion.Euler(38, 128, 0);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Geo.Hex("#9fb3c8");
            RenderSettings.ambientEquatorColor = Geo.Hex("#b7a98c");
            RenderSettings.ambientGroundColor = Geo.Hex("#6e5e44");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Geo.Hex("#cfc9b8");
            RenderSettings.fogStartDistance = 400;
            RenderSettings.fogEndDistance = 5200;
            QualitySettings.shadowDistance = 260;
            QualitySettings.shadowResolution = ShadowResolution.VeryHigh;
            QualitySettings.shadowCascades = 2;

            var sky = Geo.Prim(PrimitiveType.Sphere, null, new Material(Shader.Find("AdAstra/Sky")), Vector3.zero, Vector3.one * 9000);
            sky.name = "Sky";
            sky.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            sky.GetComponent<Renderer>().sharedMaterial.SetVector("_SunDir", -go.transform.forward);
            Sky = sky.transform;
        }

        void Ground()
        {
            var g = Geo.Prim(PrimitiveType.Plane, Root, sand, Vector3.zero, new Vector3(1200, 1, 1200));
            g.name = "Desert";
            g.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // Creosote and mesquite: a few thousand low bushes baked into one mesh, kept off the roads and the pads.
            var piece = Geo.PrimMesh(PrimitiveType.Sphere);
            var where = new List<Matrix4x4>();
            var r = new System.Random(11);
            for (int i = 0; i < 4200; i++)
            {
                float rad = Mathf.Lerp(8, 1400, Mathf.Pow((float)r.NextDouble(), 1.6f));
                float a = (float)(r.NextDouble() * Mathf.PI * 2);
                var p = new Vector3(Mathf.Cos(a) * rad, 0, Mathf.Sin(a) * rad);
                if (Clear(p)) continue;
                float s = 0.6f + (float)r.NextDouble() * 1.4f;
                where.Add(Matrix4x4.TRS(p + Vector3.up * s * 0.2f, Quaternion.Euler(0, (float)r.NextDouble() * 360, 0), new Vector3(s * 1.4f, s * 0.75f, s * 1.2f)));
            }
            var bushes = Geo.MeshObj("Scrub", Root, Geo.Combine(piece, where), scrub);
            Geo.Shadows(bushes);
            // Roads: hard-packed caliche
            var road = Geo.Mat("#d9cdb0");
            // Each layer clear of the one under it, so no two surfaces share a height.
            Geo.Box(Root, road, new Vector3(-12, 0.03f, -50), new Vector3(7, 0.06f, 120), new Vector3(0, -14, 0));
            Geo.Box(Root, road, new Vector3(0, 0.05f, -92), new Vector3(140, 0.10f, 7));
            Geo.Box(Root, road, new Vector3(0, 0.07f, 0), new Vector3(22, 0.14f, 22));
        }

        static bool Clear(Vector3 p) =>
            (p - TowerAt).magnitude < 16 || (p - BlockhouseAt).magnitude < 16 || (p - StandAt).magnitude < 18 ||
            (p - HangarAt).magnitude < 24 || (p - OfficeAt).magnitude < 12 || Mathf.Abs(p.z + 92) < 6 && Mathf.Abs(p.x) < 75 ||
            Mathf.Abs(p.x + 12 + (p.z + 50) * 0.25f) < 5 && p.z > -110 && p.z < 10;

        // The Organ Mountains to the west and the San Andres and Sacramentos round the basin: jagged, hazy, far.
        void Mountains()
        {
            var verts = new List<Vector3>(); var tris = new List<int>();
            var r = new System.Random(3);
            int n = 240;
            for (int i = 0; i <= n; i++)
            {
                float a = i * Mathf.PI * 2 / n;
                float west = Mathf.Clamp01(Mathf.Cos(a - Mathf.PI)); // the Organs, high to the west
                float h = 120 + 260 * west + 520 * west * west * (float)r.NextDouble() + 90 * (float)r.NextDouble();
                float rad = 3600 - 800 * west;
                verts.Add(new Vector3(Mathf.Cos(a) * (rad + 600), -20, Mathf.Sin(a) * (rad + 600)));
                verts.Add(new Vector3(Mathf.Cos(a) * rad, h, Mathf.Sin(a) * rad));
            }
            for (int i = 0; i < n; i++)
            {
                int b = i * 2;
                tris.AddRange(new[] { b, b + 2, b + 1, b + 1, b + 2, b + 3 });
            }
            var m = new Mesh(); m.SetVertices(verts); m.SetTriangles(tris, 0); m.RecalculateNormals();
            var go = Geo.MeshObj("Mountains", Root, m, mountain);
            go.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        // The WAC tower: about 31 m of three-legged steel lattice. It can be laid a few degrees against the wind.
        public const float TowerHeight = 31;
        void BuildTower()
        {
            TowerPivot = new GameObject("Tower pivot").transform;
            TowerPivot.SetParent(Root, false);
            TowerPivot.localPosition = TowerAt;
            Tower = new GameObject("WAC tower").transform;
            Tower.SetParent(TowerPivot, false);
            Geo.Box(Root, concrete, TowerAt + new Vector3(0, 0.25f, 0), new Vector3(9, 0.5f, 9));
            float H = TowerHeight, w = 2.2f;
            var legs = new Vector3[3];
            for (int i = 0; i < 3; i++) { float a = i * Mathf.PI * 2 / 3 + 0.3f; legs[i] = new Vector3(Mathf.Cos(a) * w, 0, Mathf.Sin(a) * w); }
            foreach (var l in legs) Geo.Beam(Tower, rust, l + Vector3.up * 0.5f, l + Vector3.up * H, 0.22f);
            for (float y = 0.5f; y <= H; y += 2.6f)
                for (int i = 0; i < 3; i++)
                {
                    var a = legs[i] + Vector3.up * y; var b = legs[(i + 1) % 3] + Vector3.up * y;
                    Geo.Beam(Tower, rust, a, b, 0.12f);
                    if (y + 2.6f <= H) Geo.Beam(Tower, rust, a, legs[(i + 1) % 3] + Vector3.up * (y + 2.6f), 0.08f);
                }
            Geo.Box(Tower, steel, new Vector3(0, H + 0.3f, 0), new Vector3(2.6f, 0.4f, 2.6f));
            Geo.Box(Tower, rust, new Vector3(2.8f, 6, 0), new Vector3(2.2f, 0.15f, 1.6f));
            Geo.Shadows(Tower.gameObject);
            // The round: the WAC Corporal on its Tiny Tim booster, drawn about twice real size so it reads in the diorama.
            Rocket = MakeRocket("WAC round", Tower, true);
            Rocket.localPosition = new Vector3(0, 0.6f, 0);
            RocketFlame = MakeFlame(Rocket, 0.35f, 6f);
            RocketLight = new GameObject("Flame light").AddComponent<Light>();
            RocketLight.type = LightType.Point; RocketLight.color = Geo.Hex("#ffb060"); RocketLight.range = 80; RocketLight.intensity = 0;
            RocketLight.transform.SetParent(Rocket, false); RocketLight.transform.localPosition = new Vector3(0, -2, 0);
        }

        public Transform MakeRocket(string name, Transform parent, bool withBooster)
        {
            var r = new GameObject(name).transform;
            r.SetParent(parent, false);
            float s = 2f, R = 0.15f * s;
            float y0 = 0;
            if (withBooster)
            {
                Geo.Cyl(r, dark, new Vector3(0, 1.2f * s / 2 + 0.05f, 0), 0.13f * s, 1.2f * s);
                for (int i = 0; i < 3; i++)
                {
                    var f = Geo.Box(r, dark, Vector3.zero, new Vector3(0.04f * s, 0.6f * s, 0.5f * s));
                    float a = i * 120 + 30;
                    f.transform.localPosition = Quaternion.Euler(0, a, 0) * new Vector3(0, 0.3f * s, 0.33f * s);
                    f.transform.localRotation = Quaternion.Euler(0, a, 0);
                }
                y0 = 1.25f * s;
            }
            Geo.Cyl(r, white, new Vector3(0, y0 + 2.0f * s, 0), R, 4.0f * s);
            Geo.Cyl(r, black, new Vector3(0, y0 + 1.2f * s, 0), R * 1.02f, 0.25f * s);
            Geo.Cyl(r, black, new Vector3(0, y0 + 3.3f * s, 0), R * 1.02f, 0.18f * s);
            var nose = Geo.MeshObj("Nose", r, Geo.Cone(16, R, 0.01f, 0.9f * s), white, new Vector3(0, y0 + 4.0f * s, 0));
            for (int i = 0; i < 3; i++)
            {
                var f = Geo.Box(r, black, Vector3.zero, new Vector3(0.03f * s, 0.45f * s, 0.32f * s));
                float a = i * 120;
                f.transform.localPosition = Quaternion.Euler(0, a, 0) * new Vector3(0, y0 + 0.3f * s, R + 0.14f * s);
                f.transform.localRotation = Quaternion.Euler(0, a, 0);
            }
            Geo.Shadows(r.gameObject);
            return r;
        }

        public Transform MakeFlame(Transform parent, float radius, float length)
        {
            var f = new GameObject("Flame").transform;
            f.SetParent(parent, false);
            var outer = new Material(Shader.Find("AdAstra/Additive")) { color = new Color(1f, 0.62f, 0.25f, 0.9f) };
            var inner = new Material(Shader.Find("AdAstra/Additive")) { color = new Color(1f, 0.95f, 0.8f, 1f) };
            var o = Geo.MeshObj("Outer", f, Geo.Cone(16, radius, radius * 0.15f, length, false), outer);
            o.transform.localRotation = Quaternion.Euler(180, 0, 0);
            var i2 = Geo.MeshObj("Inner", f, Geo.Cone(16, radius * 0.55f, 0.02f, length * 0.5f, false), inner);
            i2.transform.localRotation = Quaternion.Euler(180, 0, 0);
            foreach (var rr in f.GetComponentsInChildren<Renderer>()) rr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            f.gameObject.SetActive(false);
            return f;
        }

        // The 1945 blockhouse: walls three metres thick under a pyramid of concrete, a periscope on top, a steel door.
        void BuildBlockhouse()
        {
            var b = new GameObject("Blockhouse").transform; b.SetParent(Root, false); b.localPosition = BlockhouseAt;
            b.localRotation = Quaternion.Euler(0, 35, 0);
            Geo.Box(b, concrete, new Vector3(0, 2.2f, 0), new Vector3(13, 4.4f, 11));
            var roof = Geo.MeshObj("Roof", b, Geo.Cone(4, 9.5f, 1.2f, 4.2f), concrete, new Vector3(0, 4.4f, 0));
            roof.transform.localRotation = Quaternion.Euler(0, 45, 0);
            Geo.Box(b, dark, new Vector3(0, 1.3f, 5.52f), new Vector3(1.8f, 2.4f, 0.1f));
            Geo.Cyl(b, steel, new Vector3(-2, 9.3f, 1), 0.25f, 1.6f);
            Geo.Cyl(b, steel, new Vector3(2, 9.3f, 1), 0.25f, 1.6f);
            for (int i = 0; i < 8; i++) Geo.Box(b, canvas, new Vector3(-6 + i * 1.6f, 0.4f, 7f), new Vector3(1.4f, 0.7f, 0.8f), new Vector3(0, i * 7, 0));
            Geo.Shadows(b.gameObject);
        }

        // The static stand: a steel frame over a flame pit, the stage held down in it, and the sandbagged dugout.
        void BuildStand()
        {
            var s = new GameObject("Static stand").transform; s.SetParent(Root, false); s.localPosition = StandAt;
            Geo.Box(s, concrete, new Vector3(0, 0.3f, 0), new Vector3(10, 0.6f, 8));
            Geo.Box(s, dark, new Vector3(0, 0.35f, 3.5f), new Vector3(3, 0.7f, 6.1f));
            for (int i = 0; i < 4; i++)
            {
                float x = i % 2 == 0 ? -1.6f : 1.6f, z = i < 2 ? -1.2f : 1.2f;
                Geo.Beam(s, steel, new Vector3(x, 0.6f, z), new Vector3(x * 0.5f, 9, z * 0.5f), 0.2f);
            }
            for (float y = 2; y < 9; y += 2.3f) Geo.Box(s, steel, new Vector3(0, y, 0), new Vector3(2.6f - y * 0.17f, 0.14f, 2f - y * 0.11f));
            StandStage = MakeRocket("Stage on the stand", s, false);
            StandStage.localPosition = new Vector3(0, 1.4f, 0);
            StandFlame = MakeFlame(StandStage, 0.32f, 5f);
            StandLight = new GameObject("Stand light").AddComponent<Light>();
            StandLight.type = LightType.Point; StandLight.color = Geo.Hex("#ffb060"); StandLight.range = 40; StandLight.intensity = 0;
            StandLight.transform.SetParent(s, false); StandLight.transform.localPosition = new Vector3(0, 0.5f, 0);
            // The dugout: earth banked over timber, sandbags, a slit to watch through.
            var d = new GameObject("Dugout").transform; d.SetParent(Root, false); d.localPosition = StandAt + new Vector3(-16, 0, -14);
            d.localRotation = Quaternion.Euler(0, 30, 0);
            Geo.Ball(d, earth, new Vector3(0, 0, 0), new Vector3(11, 5, 8));
            Geo.Box(d, wood, new Vector3(0, 1.1f, 3.7f), new Vector3(3.5f, 2.2f, 0.4f));
            Geo.Box(d, dark, new Vector3(0, 1.0f, 3.92f), new Vector3(1.0f, 1.8f, 0.05f));
            for (int i = 0; i < 10; i++) Geo.Box(d, canvas, new Vector3(-4 + i * 0.9f, 0.3f + (i % 2) * 0.35f, 4.3f), new Vector3(0.85f, 0.35f, 0.6f));
            Geo.Shadows(s.gameObject); Geo.Shadows(d.gameObject);
        }

        // The assembly hangar: a wooden-framed building with a curved roof and big doors open to the morning.
        void BuildHangar()
        {
            var h = new GameObject("Hangar").transform; h.SetParent(Root, false); h.localPosition = HangarAt;
            h.localRotation = Quaternion.Euler(0, -8, 0);
            Geo.Box(h, wood, new Vector3(0, 3.5f, 0), new Vector3(26, 7, 16));
            var roof = Geo.Cyl(h, steel, new Vector3(0, 7, 0), 8.2f, 26.4f, new Vector3(0, 0, 90));
            roof.transform.localScale = new Vector3(6f, 13.2f, 16.4f);
            Geo.Box(h, dark, new Vector3(0, 3, 8.02f), new Vector3(11, 6, 0.1f));
            Geo.Box(h, canvas, new Vector3(16, 1.2f, 6), new Vector3(3, 2.4f, 3));
            Geo.Shadows(h.gameObject);
        }

        void BuildOffice()
        {
            var o = new GameObject("Range office").transform; o.SetParent(Root, false); o.localPosition = OfficeAt;
            Geo.Box(o, wood, new Vector3(0, 1.6f, 0), new Vector3(9, 3.2f, 6));
            Geo.Box(o, olive, new Vector3(0, 3.35f, 0), new Vector3(9.6f, 0.3f, 6.6f), new Vector3(4, 0, 0));
            Geo.Box(o, glass, new Vector3(-2, 1.8f, 3.02f), new Vector3(1.6f, 1, 0.05f));
            Geo.Box(o, glass, new Vector3(2, 1.8f, 3.02f), new Vector3(1.6f, 1, 0.05f));
            Geo.Cyl(o, steel, new Vector3(5.5f, 5, 0), 0.08f, 10);
            Geo.Shadows(o.gameObject);
        }

        void Poles()
        {
            var p = new GameObject("Poles").transform; p.SetParent(Root, false);
            Vector3 prev = Vector3.zero; bool first = true;
            for (int i = 0; i < 9; i++)
            {
                var at = Vector3.Lerp(HangarAt + new Vector3(14, 0, 4), StandAt + new Vector3(-10, 0, -10), i / 8f) + new Vector3(0, 0, -6);
                Geo.Cyl(p, wood, at + Vector3.up * 4, 0.12f, 8);
                Geo.Box(p, wood, at + Vector3.up * 7.6f, new Vector3(1.6f, 0.12f, 0.12f));
                if (!first) Geo.Beam(p, black, prev + Vector3.up * 7.5f, at + Vector3.up * 7.5f, 0.03f);
                prev = at; first = false;
            }
            Geo.Shadows(p.gameObject);
        }

        void Trucks()
        {
            void Truck(Vector3 at, float yaw)
            {
                var t = new GameObject("Truck").transform; t.SetParent(Root, false); t.localPosition = at; t.localRotation = Quaternion.Euler(0, yaw, 0);
                Geo.Box(t, olive, new Vector3(0, 1.4f, -0.8f), new Vector3(2.3f, 1.8f, 4.2f));
                Geo.Box(t, canvas, new Vector3(0, 2.7f, -0.8f), new Vector3(2.3f, 1.0f, 4.0f));
                Geo.Box(t, olive, new Vector3(0, 1.2f, 2.3f), new Vector3(2.2f, 1.5f, 2f));
                Geo.Box(t, glass, new Vector3(0, 1.7f, 3.31f), new Vector3(1.9f, 0.6f, 0.04f));
                foreach (var z in new[] { -2f, -0.6f, 2.4f })
                    foreach (var x in new[] { -1.15f, 1.15f })
                        Geo.Cyl(t, black, new Vector3(x, 0.5f, z), 0.5f, 0.35f, new Vector3(0, 0, 90));
                Geo.Shadows(t.gameObject);
            }
            Truck(new Vector3(-14, 0, -20), 20);
            Truck(new Vector3(-28, 0, -80), -80);
            Truck(StandAt + new Vector3(-8, 0, 8), 150);
        }

        // ---- The hangar floor, a cut-away diorama: the WAC stage on its cradle with its panels off.
        void HangarInterior()
        {
            var h = new GameObject("Hangar floor").transform; h.SetParent(Root, false); h.localPosition = HangarRoom;
            var floor = Geo.Mat("#7c766a");
            Geo.Box(h, floor, new Vector3(0, -0.1f, 0), new Vector3(22, 0.2f, 14));
            Geo.Box(h, wood, new Vector3(0, 3.5f, 7), new Vector3(22, 7, 0.3f));
            Geo.Box(h, wood, new Vector3(-11, 3.5f, 0), new Vector3(0.3f, 7, 14));
            Geo.Box(h, wood, new Vector3(11, 3.5f, 0), new Vector3(0.3f, 7, 14));
            for (int i = -2; i <= 2; i++) Geo.Box(h, glass, new Vector3(i * 4, 4.6f, 6.84f), new Vector3(2.2f, 1.4f, 0.05f));
            // The cradle and the stage lying on it, about two and a half times real size so its welds can be pointed at.
            for (int i = -1; i <= 1; i += 2)
            {
                Geo.Box(h, wood, new Vector3(i * 2.4f, 0.45f, 0), new Vector3(0.5f, 0.9f, 1.6f));
                Geo.Box(h, steel, new Vector3(i * 2.4f, 0.95f, 0), new Vector3(0.6f, 0.15f, 1.0f));
            }
            HangarStage = MakeRocket("Stage on the cradle", h, false);
            HangarStage.localPosition = new Vector3(-4.6f, 1.45f, 0);
            HangarStage.localRotation = Quaternion.Euler(0, 0, -90);
            HangarStage.localScale = Vector3.one * 1.25f;
            // Panels off: a dark opening at the feed system.
            Geo.Box(HangarStage, dark, new Vector3(0, 1.2f, 0.28f), new Vector3(0.36f, 0.9f, 0.05f));
            void Anchor(string id, float along, float up = 0.5f)
            {
                var a = new GameObject("Spot " + id).transform; a.SetParent(HangarStage, false);
                a.localPosition = new Vector3(0, along, 0) + new Vector3(-up, 0, 0.0f);
                SpotAnchors[id] = a;
            }
            Anchor("weld-fwd", 6.6f); Anchor("weld-mid", 4.4f); Anchor("weld-aft", 2.4f);
            Anchor("fitting", 1.4f, -0.5f); Anchor("pressure", 3.3f, -0.6f); Anchor("fins", 0.4f, 0.9f);
            // Benches, racks, crates, a hanging lamp over the stage.
            Geo.Box(h, wood, new Vector3(-6, 0.45f, 5.5f), new Vector3(5, 0.9f, 1.4f));
            Geo.Box(h, steel, new Vector3(-6, 1.3f, 6.4f), new Vector3(5, 1.6f, 0.2f));
            Geo.Box(h, wood, new Vector3(7.5f, 0.5f, 4.8f), new Vector3(1.8f, 1, 1.8f));
            Geo.Box(h, wood, new Vector3(8.6f, 0.4f, 2.6f), new Vector3(1.4f, 0.8f, 1.4f), new Vector3(0, 20, 0));
            Geo.Box(h, olive, new Vector3(6.5f, 0.8f, -4f), new Vector3(1.2f, 1.6f, 0.8f));
            foreach (var x in new[] { -3.5f, 3.5f })
            {
                Geo.Cyl(h, black, new Vector3(x, 5.8f, 0), 0.02f, 2.4f);
                Geo.MeshObj("Shade", h, Geo.Cone(12, 0.6f, 0.15f, 0.4f, false), Geo.Mat("#2f5a42"), new Vector3(x, 4.25f, 0));
                Geo.Ball(h, bulb, new Vector3(x, 4.2f, 0), Vector3.one * 0.22f);
                var l = new GameObject("Lamp").AddComponent<Light>(); l.transform.SetParent(h, false);
                l.type = LightType.Spot; l.transform.localPosition = new Vector3(x, 4.1f, 0); l.transform.localRotation = Quaternion.Euler(90, 0, 0);
                // URP lights fall off as 1/d² (built-in was far gentler), so the lamps are set about 0.034·range² times their old
                // intensity, which matches the old pool of light at half the range.
                l.spotAngle = 95; l.range = 12; l.intensity = 9.5f; l.color = Geo.Hex("#ffe3b4"); l.shadows = LightShadows.Soft;
            }
            Geo.Shadows(h.gameObject);
        }

        // ---- The blockhouse inside: the firing panel under the periscopes, the count clock on the wall.
        void BlockhouseInterior()
        {
            var b = new GameObject("Blockhouse inside").transform; b.SetParent(Root, false); b.localPosition = BlockhouseRoom;
            var conc = Geo.Mat("#9e998e");
            Geo.Box(b, Geo.Mat("#5e5b55"), new Vector3(0, -0.1f, 0), new Vector3(14, 0.2f, 10));
            Geo.Box(b, conc, new Vector3(0, 2, 5), new Vector3(14, 4, 0.6f));
            Geo.Box(b, conc, new Vector3(-7, 2, 0), new Vector3(0.6f, 4, 10));
            Geo.Box(b, conc, new Vector3(7, 2, 0), new Vector3(0.6f, 4, 10));
            // The firing console along the far wall.
            var panelMat = Geo.Mat("#4f5a4a", 0.25f, 0.2f);
            Geo.Box(b, panelMat, new Vector3(0, 0.45f, 3.4f), new Vector3(9, 0.9f, 1.1f));
            var face = Geo.Box(b, panelMat, new Vector3(0, 1.4f, 3.9f), new Vector3(9, 1.2f, 0.2f), new Vector3(-20, 0, 0));
            var dial = Geo.Glow("#efe6c8", 0.35f);
            var lampG = Geo.Glow("#5cff8a", 2.2f); var lampA = Geo.Glow("#ffb340", 2.2f); var lampR = Geo.Glow("#ff4a3a", 0.4f);
            for (int i = 0; i < 8; i++)
            {
                Geo.Cyl(b, dial, new Vector3(-3.9f + i * 1.1f, 1.55f, 3.76f), 0.2f, 0.06f, new Vector3(70, 0, 0));
                Geo.Box(b, i % 3 == 0 ? lampG : i % 3 == 1 ? lampA : lampR, new Vector3(-3.7f + i * 1.1f, 1.05f, 3.62f), new Vector3(0.1f, 0.08f, 0.06f));
            }
            Geo.Box(b, Geo.Glow("#b02a20", 0.6f), new Vector3(3.2f, 0.95f, 3.2f), new Vector3(0.5f, 0.08f, 0.35f));
            // Periscopes through the roof, and the count clock on the wall above the console.
            Geo.Cyl(b, steel, new Vector3(-2.5f, 3.2f, 3.6f), 0.18f, 1.8f);
            Geo.Cyl(b, steel, new Vector3(2.5f, 3.2f, 3.6f), 0.18f, 1.8f);
            Geo.Box(b, black, new Vector3(0, 3.1f, 4.68f), new Vector3(2.6f, 0.9f, 0.1f));
            BlockhouseClock = new GameObject("Count clock").transform; BlockhouseClock.SetParent(b, false); BlockhouseClock.localPosition = new Vector3(0, 3.1f, 4.6f);
            // The clock face: amber pixel figures on the dark board, in the world (so it sits behind the people and
            // takes the room's light and focus like everything else).
            clockTex = new Texture2D(48, 16, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, name = "Count clock" };
            var clockFace = Geo.Prim(PrimitiveType.Quad, b, new Material(Shader.Find("AdAstra/UnlitAlpha")) { mainTexture = clockTex, color = Color.white },
                new Vector3(0, 3.1f, 4.615f), new Vector3(2.4f, 0.8f, 1));
            clockFace.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            SetClock("T-10:00", false);
            // Strip-chart recorder and a desk with the red-line card.
            Geo.Box(b, wood, new Vector3(-4.5f, 0.4f, -1.5f), new Vector3(2.4f, 0.8f, 1.2f));
            Geo.Box(b, Geo.Mat("#ece4cc"), new Vector3(-4.5f, 0.81f, -1.5f), new Vector3(0.8f, 0.02f, 0.6f), new Vector3(0, 12, 0));
            Geo.Box(b, panelMat, new Vector3(4.6f, 0.6f, -1.2f), new Vector3(1.6f, 1.2f, 0.9f));
            foreach (var x in new[] { -3f, 3f })
            {
                Geo.Ball(b, bulb, new Vector3(x, 3.7f, 0.8f), Vector3.one * 0.2f);
                var l = new GameObject("Lamp").AddComponent<Light>(); l.transform.SetParent(b, false);
                l.type = LightType.Spot; l.transform.localPosition = new Vector3(x, 3.6f, 0.8f); l.transform.localRotation = Quaternion.Euler(80, 0, 0);
                l.spotAngle = 100; l.range = 9; l.intensity = 4.4f; /* 1.8 before URP, see the hangar lamps */ l.color = Geo.Hex("#ffe0b0"); l.shadows = LightShadows.Soft;
            }
            var green = new GameObject("Panel glow").AddComponent<Light>(); green.transform.SetParent(b, false);
            green.type = LightType.Point; green.transform.localPosition = new Vector3(0, 1.4f, 3.0f); green.range = 4; green.intensity = 0.4f; /* 0.7 before URP */ green.color = Geo.Hex("#9affc0");
            Geo.Shadows(b.gameObject);
        }

        void MakePeople()
        {
            void Add(string id, string name, Look l, float h = 2.6f) => People[id] = new Person(id, name, l, Root, spriteShader, blob, h);
            Add("you", "You", new Look { Shirt = "#e9e6dc", Trousers = "#3a3c44", Hair = "#5a3a22", Accent = "#7a2a2a" });
            Add("ellis", "Ellis", new Look { Shirt = "#7f9bb5", Trousers = "#4a4038", Hair = "#2a1c14", LongHair = true, Skirt = true, Skin = "#e0ae88" });
            Add("kowalski", "Sgt. Kowalski", new Look { Shirt = "#6b6d45", Trousers = "#5a5c3a", Hair = "#8a6a44", Hat = "#5a5c3a", Stripes = true });
            Add("delgado", "Pvt. Delgado", new Look { Shirt = "#b5a171", Trousers = "#5a5c3a", Hair = "#1c1410", Hat = "#6b6d45", Skin = "#c48b62" });
            Add("vega", "Vega", new Look { Shirt = "#a48f6a", Trousers = "#a48f6a", Hair = "#2a1a10", Skin = "#b97f58" });
            Add("morgan", "Capt. Morgan", new Look { Shirt = "#c2ad80", Trousers = "#7d6a48", Hair = "#3a2a1a", Hat = "#7d6a48", Accent = "#e8c66a" });
            foreach (var p in People.Values) p.Hide();
        }

        void MakeViews()
        {
            Views["site"] = new View(new Vector3(70, 46, -150), new Vector3(2, 6, -40), 38, 0.42f);
            Views["tower"] = new View(new Vector3(34, 9, -48), new Vector3(-2, 13, 0), 40, 0.5f);
            Views["morning"] = new View(new Vector3(-30, 12, -58), new Vector3(-6, 10, -8), 42, 0.45f);
            Views["stand"] = new View(StandAt + new Vector3(16, 11, -30), StandAt + new Vector3(-4, 3, -4), 40, 0.42f);
            Views["hangar"] = new View(HangarRoom + new Vector3(2, 9.5f, -14), HangarRoom + new Vector3(-0.6f, 1.2f, 1.2f), 44, 0.48f);
            Views["blockhouse"] = new View(BlockhouseRoom + new Vector3(0.5f, 6.4f, -9.5f), BlockhouseRoom + new Vector3(0, 1.4f, 2.2f), 48, 0.5f);
            Views["range"] = new View(new Vector3(-60, 6, -120), new Vector3(0, 60, 200), 50, 0.6f);
        }

        // ---- The count clock's face.
        Texture2D clockTex;
        string clockShown;
        static readonly Dictionary<char, string[]> Glyphs = new Dictionary<char, string[]>
        {
            ['0'] = new[] { ".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###." },
            ['1'] = new[] { "..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###." },
            ['2'] = new[] { ".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####" },
            ['3'] = new[] { "####.", "....#", "....#", ".###.", "....#", "....#", "####." },
            ['4'] = new[] { "...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#." },
            ['5'] = new[] { "#####", "#....", "####.", "....#", "....#", "#...#", ".###." },
            ['6'] = new[] { "..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###." },
            ['7'] = new[] { "#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..." },
            ['8'] = new[] { ".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###." },
            ['9'] = new[] { ".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.." },
            ['T'] = new[] { "#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.." },
            ['-'] = new[] { ".....", ".....", ".....", "####.", ".....", ".....", "....." },
            [':'] = new[] { "..", "..", "#.", "..", "#.", "..", ".." },
            ['H'] = new[] { "#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#" },
            ['O'] = new[] { ".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###." },
            ['L'] = new[] { "#....", "#....", "#....", "#....", "#....", "#....", "#####" },
            ['D'] = new[] { "####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####." },
        };

        public void SetClock(string text, bool hold)
        {
            string key = text + (hold ? "|H" : "");
            if (key == clockShown || clockTex == null) return;
            clockShown = key;
            int W = clockTex.width, H = clockTex.height;
            var board = new Color(0.07f, 0.04f, 0.02f, 1f);
            var lit = new Color(1f, 0.62f, 0.2f, 1f);
            var px = new Color[W * H];
            for (int i = 0; i < px.Length; i++) px[i] = board;
            void Write(string s, int top, Color c)
            {
                int width = 0;
                foreach (var ch in s) width += (Glyphs.TryGetValue(ch, out var g) ? g[0].Length : 3) + 1;
                int x = (W - width + 1) / 2;
                foreach (var ch in s)
                {
                    if (!Glyphs.TryGetValue(ch, out var g)) { x += 4; continue; }
                    for (int row = 0; row < 7; row++)
                        for (int col = 0; col < g[row].Length; col++)
                            if (g[row][col] == '#') px[(H - 1 - (top + row)) * W + x + col] = c;
                    x += g[0].Length + 1;
                }
            }
            Write(text, 1, lit);
            if (hold) Write("HOLD", 9, new Color(1f, 0.25f, 0.12f, 1f));
            clockTex.SetPixels(px); clockTex.Apply(false);
        }

        // ---- Things the game turns on and off.
        public void LayTower(float degreesEast) => TowerPivot.localRotation = Quaternion.Euler(0, 0, -degreesEast);
        public void ResetRocket()
        {
            Rocket.SetParent(Tower, false);
            Rocket.localPosition = new Vector3(0, 0.6f, 0);
            Rocket.localRotation = Quaternion.identity;
            Rocket.gameObject.SetActive(true);
            RocketFlame.gameObject.SetActive(false);
            RocketLight.intensity = 0;
        }
    }
}
