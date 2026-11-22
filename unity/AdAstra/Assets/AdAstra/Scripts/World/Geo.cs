// Small helpers to build the world out of code: materials, boxes, cylinders, cones, beams, combined scatter.
using System.Collections.Generic;
using UnityEngine;

namespace AdAstra.World
{
    public static class Geo
    {
        static Shader standard;
        public static Shader Standard => standard ? standard : (standard = Shader.Find("Universal Render Pipeline/Lit"));

        public static void Kill(Object o) { if (!o) return; if (Application.isPlaying) Object.Destroy(o); else Object.DestroyImmediate(o); }

        public static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        public static Material Mat(string hex, float smooth = 0.08f, float metal = 0f)
        {
            var m = new Material(Standard) { color = Hex(hex) };
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_Metallic", metal);
            return m;
        }

        public static Material Glow(string hex, float strength = 1.5f)
        {
            var m = Mat(hex);
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", Hex(hex) * strength);
            m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            return m;
        }

        public static GameObject Prim(PrimitiveType t, Transform parent, Material m, Vector3 pos, Vector3 scale, Vector3 euler = default)
        {
            var go = GameObject.CreatePrimitive(t);
            Kill(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.transform.localEulerAngles = euler;
            go.GetComponent<Renderer>().sharedMaterial = m;
            return go;
        }

        public static GameObject Box(Transform p, Material m, Vector3 pos, Vector3 size, Vector3 euler = default) =>
            Prim(PrimitiveType.Cube, p, m, pos, size, euler);

        // A cylinder standing on its centre (Unity's is 2 high).
        public static GameObject Cyl(Transform p, Material m, Vector3 pos, float radius, float height, Vector3 euler = default) =>
            Prim(PrimitiveType.Cylinder, p, m, pos, new Vector3(radius * 2, height / 2, radius * 2), euler);

        public static GameObject Ball(Transform p, Material m, Vector3 pos, Vector3 size) => Prim(PrimitiveType.Sphere, p, m, pos, size);

        // A beam from a to b.
        public static GameObject Beam(Transform p, Material m, Vector3 a, Vector3 b, float thick)
        {
            var go = Prim(PrimitiveType.Cube, p, m, (a + b) / 2, new Vector3(thick, (b - a).magnitude, thick));
            go.transform.localRotation = Quaternion.FromToRotation(Vector3.up, (b - a).normalized);
            return go;
        }

        public static GameObject MeshObj(string name, Transform p, Mesh mesh, Material m, Vector3 pos = default)
        {
            var go = new GameObject(name);
            go.transform.SetParent(p, false);
            go.transform.localPosition = pos;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = m;
            return go;
        }

        // A cone or frustum along +Y from y=0 to y=h. uv.y runs 0 at the base to 1 at the top.
        public static Mesh Cone(int seg, float r0, float r1, float h, bool capBase = true)
        {
            var v = new List<Vector3>(); var uv = new List<Vector2>(); var t = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i * Mathf.PI * 2 / seg, c = Mathf.Cos(a), s = Mathf.Sin(a);
                v.Add(new Vector3(c * r0, 0, s * r0)); uv.Add(new Vector2(i / (float)seg, 0));
                v.Add(new Vector3(c * r1, h, s * r1)); uv.Add(new Vector2(i / (float)seg, 1));
            }
            for (int i = 0; i < seg; i++)
            {
                int a = i * 2;
                t.AddRange(new[] { a, a + 1, a + 2, a + 1, a + 3, a + 2 });
            }
            if (capBase)
            {
                int c0 = v.Count; v.Add(Vector3.zero); uv.Add(new Vector2(0.5f, 0));
                for (int i = 0; i < seg; i++) t.AddRange(new[] { c0, i * 2, i * 2 + 2 });
            }
            var m = new Mesh();
            m.SetVertices(v); m.SetUVs(0, uv); m.SetTriangles(t, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        // Many copies of one mesh baked into a single mesh (scrub, rocks, poles' insulators).
        public static Mesh Combine(Mesh piece, List<Matrix4x4> where)
        {
            var ci = new CombineInstance[where.Count];
            for (int i = 0; i < where.Count; i++) ci[i] = new CombineInstance { mesh = piece, transform = where[i] };
            var m = new Mesh { indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            m.CombineMeshes(ci, true, true);
            return m;
        }

        public static Mesh PrimMesh(PrimitiveType t)
        {
            var go = GameObject.CreatePrimitive(t);
            var mesh = go.GetComponent<MeshFilter>().sharedMesh;
            Kill(go);
            return mesh;
        }

        public static void Shadows(GameObject root, bool cast = true, bool receive = true)
        {
            foreach (var r in root.GetComponentsInChildren<Renderer>())
            {
                r.shadowCastingMode = cast ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = receive;
            }
        }
    }
}
