// The 1945 'field' interface: a typed field office in olive, manila and cream, Courier New, accent #e8c66a (DESIGN.md
// section 3). Drawn with IMGUI at full resolution on top of the pixel picture, so type is never pixelated. Everything
// scales with the window's height.
using System.Collections.Generic;
using UnityEngine;

namespace AdAstra.UI
{
    public static class Ui
    {
        public static float U => Screen.height / 1080f;
        public static int Px(float v) => Mathf.RoundToInt(v * U);

        public static readonly Color Olive = Hex("#4a5236"), OliveDark = Hex("#30361f"), Manila = Hex("#eadfbd"),
            Cream = Hex("#f4ecd6"), Ink = Hex("#2b2418"), Accent = Hex("#e8c66a"), Red = Hex("#a8321e"), Green = Hex("#3d7a3a"),
            Faint = Hex("#8a7f66"), Amber = Hex("#ff9a30");

        public static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        static Font font;
        public static Font Font
        {
            get
            {
                if (font == null) font = Font.CreateDynamicFontFromOSFont(new[] { "Courier New", "Consolas", "Lucida Console" }, 20);
                return font;
            }
        }

        static readonly Dictionary<Color, Texture2D> fills = new Dictionary<Color, Texture2D>();
        public static Texture2D Fill(Color c)
        {
            if (fills.TryGetValue(c, out var t) && t) return t;
            t = new Texture2D(1, 1) { hideFlags = HideFlags.DontSave };
            t.SetPixel(0, 0, c); t.Apply();
            fills[c] = t;
            return t;
        }

        static float builtFor = -1;
        public static GUIStyle Text, Small, Head, Title, Button, ButtonOn, Paper, Bar, Date, Log, Bubble, Clock, Marker, MarkerOn, Strip, Note, Big;

        public static void Build()
        {
            if (Mathf.Approximately(builtFor, Screen.height) && Text != null) return;
            builtFor = Screen.height;
            GUIStyle S(int size, Color c, FontStyle fs = FontStyle.Normal, TextAnchor a = TextAnchor.UpperLeft, bool wrap = true) =>
                new GUIStyle { font = Font, fontSize = Px(size), fontStyle = fs, alignment = a, wordWrap = wrap, richText = true, normal = { textColor = c } };
            Text = S(21, Ink);
            Small = S(17, Ink);
            Note = S(18, Faint, FontStyle.Italic);
            Head = S(24, Ink, FontStyle.Bold);
            Title = S(54, Accent, FontStyle.Bold, TextAnchor.MiddleCenter);
            Big = S(30, Ink, FontStyle.Bold);
            Button = S(20, Cream, FontStyle.Bold, TextAnchor.MiddleCenter, true);
            Button.normal.background = Fill(Olive); Button.hover.background = Fill(Hex("#5d6845")); Button.hover.textColor = Accent;
            Button.active.background = Fill(OliveDark); Button.active.textColor = Accent;
            Button.padding = new RectOffset(Px(14), Px(14), Px(8), Px(8)); Button.margin = new RectOffset(Px(2), Px(6), Px(4), Px(4));
            ButtonOn = new GUIStyle(Button); ButtonOn.normal.background = Fill(Hex("#7a5a1e")); ButtonOn.normal.textColor = Accent;
            Paper = new GUIStyle { normal = { background = Fill(Manila) }, padding = new RectOffset(Px(22), Px(22), Px(18), Px(18)) };
            Bar = new GUIStyle { normal = { background = Fill(OliveDark) } };
            Date = S(20, Accent, FontStyle.Bold, TextAnchor.MiddleCenter, false); Date.normal.background = Fill(Hex("#1d1a10"));
            Log = S(18, Hex("#e8e2cc")); Log.normal.background = Fill(new Color(0.08f, 0.09f, 0.06f, 0.82f)); Log.padding = new RectOffset(Px(10), Px(10), Px(5), Px(5));
            Bubble = S(18, Ink, FontStyle.Normal, TextAnchor.MiddleCenter); Bubble.normal.background = Fill(Cream); Bubble.padding = new RectOffset(Px(10), Px(10), Px(6), Px(6));
            Clock = S(46, Amber, FontStyle.Bold, TextAnchor.MiddleCenter, false); Clock.normal.background = Fill(new Color(0.06f, 0.03f, 0.01f, 0.92f));
            Marker = S(18, Ink, FontStyle.Bold, TextAnchor.MiddleCenter, false); Marker.normal.background = Fill(Cream); Marker.hover.background = Fill(Accent);
            MarkerOn = new GUIStyle(Marker); MarkerOn.normal.background = Fill(Accent);
            Strip = S(21, Hex("#f0ead6"), FontStyle.Normal, TextAnchor.MiddleLeft); Strip.normal.background = Fill(new Color(0.12f, 0.13f, 0.09f, 0.94f)); Strip.padding = new RectOffset(Px(16), Px(16), Px(10), Px(10));
        }

        public static Color ToneColor(string tone) => tone == "go" ? Hex("#8fe08a") : tone == "bad" ? Hex("#ff8a6a") : tone == "warn" ? Accent : Hex("#e8e2cc");

        // ---- Lines, for traces, needles and the range plot (GUI coordinates).
        static Material line;
        public static Vector2 Origin;
        public static void MarkOrigin() => Origin = GUIUtility.GUIToScreenPoint(Vector2.zero);
        public static void Lines(IList<Vector2> pts, Color c, bool strip = true)
        {
            if (Event.current.type != EventType.Repaint || pts.Count < 2) return;
            // GUI points inside a GUILayout area or scroll view are local to it; GL draws in the window's pixels.
            // GUIToScreenPoint also counts where the window is on the desktop (the Game view in the editor), so take
            // off where the top-level GUI origin lands (Origin, set at the start of each OnGUI).
            var sp = new Vector2[pts.Count];
            for (int i = 0; i < pts.Count; i++) sp[i] = GUIUtility.GUIToScreenPoint(pts[i]) - Origin;
            pts = sp;
            if (!line)
            {
                line = new Material(Shader.Find("Hidden/Internal-Colored")) { hideFlags = HideFlags.HideAndDontSave };
                line.SetInt("_ZTest", (int)UnityEngine.Rendering.CompareFunction.Always);
                line.SetInt("_Cull", 0);
            }
            line.SetPass(0);
            GL.PushMatrix();
            GL.LoadPixelMatrix();
            GL.Begin(GL.LINES);
            GL.Color(c);
            float h = Screen.height;
            int step = strip ? 1 : 2;
            for (int i = 0; i + 1 < pts.Count; i += step)
            {
                // Two passes a pixel apart make a line that reads at 4K.
                for (int k = 0; k < 2; k++)
                {
                    GL.Vertex3(pts[i].x + k * 0.6f, h - pts[i].y, 0);
                    GL.Vertex3(pts[i + 1].x + k * 0.6f, h - pts[i + 1].y, 0);
                }
            }
            GL.End();
            GL.PopMatrix();
        }

        public static void Line(Vector2 a, Vector2 b, Color c) => Lines(new[] { a, b }, c, false);

        public static void Box(Rect r, Color c) { if (Event.current.type == EventType.Repaint) GUI.DrawTexture(r, Fill(c)); }

        public static void Frame(Rect r, Color c, float w = 1)
        {
            w *= Mathf.Max(1, U);
            Box(new Rect(r.x, r.y, r.width, w), c); Box(new Rect(r.x, r.yMax - w, r.width, w), c);
            Box(new Rect(r.x, r.y, w, r.height), c); Box(new Rect(r.xMax - w, r.y, w, r.height), c);
        }

        public static void Label(Rect r, string text, GUIStyle s, Color c)
        {
            var old = s.normal.textColor; s.normal.textColor = c; GUI.Label(r, text, s); s.normal.textColor = old;
        }
    }
}
