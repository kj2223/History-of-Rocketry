// Pixel art drawn in code: the people (32 x 64 sprites, front and back), and the chunky ground and wall textures.
// Original art, in the spirit of the game's own pixel people.
using UnityEngine;

namespace AdAstra.World
{
    public sealed class Look
    {
        public string Shirt, Trousers, Hair, Skin = "#d9a27a", Hat, Accent;
        public bool Skirt, LongHair, Stripes;
    }

    public static class PixelArt
    {
        static Texture2D New(int w, int h, Color fill, bool repeat = false)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = repeat ? TextureWrapMode.Repeat : TextureWrapMode.Clamp,
            };
            var px = new Color[w * h];
            for (int i = 0; i < px.Length; i++) px[i] = fill;
            t.SetPixels(px);
            return t;
        }

        // Draw in top-down coordinates (y = 0 is the top row), like a paint program.
        static void Rect(Texture2D t, string hex, int x, int y, int w = 1, int h = 1)
        {
            var c = Geo.Hex(hex);
            for (int j = 0; j < h; j++)
                for (int i = 0; i < w; i++)
                {
                    int px = x + i, py = t.height - 1 - (y + j);
                    if (px >= 0 && py >= 0 && px < t.width && py < t.height) t.SetPixel(px, py, c);
                }
        }

        // A person, 32 x 64 art pixels: drawn with light from the left, a darker right side, and a one-pixel ink outline,
        // so they hold up as crisp pixel art at 4K.
        public static Texture2D Person(Look l, bool back)
        {
            var t = New(32, 64, new Color(0, 0, 0, 0));
            string sh = l.Shirt, pn = l.Trousers, hr = l.Hair, sk = l.Skin;
            string Dk(string hex, float k) => "#" + ColorUtility.ToHtmlStringRGB(Geo.Hex(hex) * k);
            string shD = Dk(sh, 0.72f), shL = Dk(sh, 1.12f), pnD = Dk(pn, 0.7f), skD = Dk(sk, 0.82f), hrL = Dk(hr, 1.35f);
            // legs, or a skirt and legs
            if (l.Skirt)
            {
                Rect(t, pn, 9, 41, 14, 11); Rect(t, pnD, 18, 41, 5, 11);
                Rect(t, sk, 11, 52, 4, 8); Rect(t, sk, 18, 52, 4, 8); Rect(t, skD, 20, 52, 2, 8);
            }
            else
            {
                Rect(t, pn, 10, 41, 5, 19); Rect(t, pn, 17, 41, 5, 19); Rect(t, pnD, 20, 41, 2, 19); Rect(t, pnD, 15, 41, 2, 3);
            }
            Rect(t, "#1a1410", 9, 59, 7, 3); Rect(t, "#1a1410", 17, 59, 7, 3); Rect(t, "#3a2e24", 9, 59, 3, 1);
            // body, belt, arms, hands
            Rect(t, sh, 8, 21, 16, 20); Rect(t, shD, 19, 21, 5, 20); Rect(t, shL, 9, 22, 3, 16);
            Rect(t, sh, 4, 23, 4, 15); Rect(t, shL, 4, 23, 2, 14); Rect(t, sh, 24, 23, 4, 15); Rect(t, shD, 26, 23, 2, 15);
            if (!l.Skirt) { Rect(t, "#3a2e1e", 8, 39, 16, 2); Rect(t, "#c9a45a", 15, 39, 2, 2); }
            if (!back)
            {
                Rect(t, shD, 13, 21, 6, 2); Rect(t, shL, 12, 21, 2, 3); Rect(t, shL, 18, 21, 2, 3); // collar
                for (int y = 25; y < 38; y += 4) Rect(t, shD, 16, y, 1, 1);                        // buttons
                if (l.Stripes) { Rect(t, "#e8c66a", 4, 27, 4, 1); Rect(t, "#e8c66a", 4, 29, 4, 1); Rect(t, "#e8c66a", 4, 31, 4, 1); }
                if (l.Accent != null) Rect(t, l.Accent, 10, 25, 3, 3);
            }
            Rect(t, sk, 4, 38, 4, 4); Rect(t, sk, 24, 38, 4, 4); Rect(t, skD, 26, 38, 2, 4);
            // neck and head
            Rect(t, skD, 13, 18, 6, 4);
            Rect(t, sk, 10, 5, 12, 14); Rect(t, skD, 19, 6, 3, 13);
            Rect(t, hr, 10, 3, 12, back ? 15 : 4); Rect(t, hr, 9, 5, 2, 8); Rect(t, hr, 21, 5, 2, 8); Rect(t, hrL, 11, 3, 5, 1);
            if (l.LongHair) { Rect(t, hr, 8, 5, 3, 16); Rect(t, hr, 21, 5, 3, 16); if (back) Rect(t, hr, 10, 17, 12, 5); }
            if (!back)
            {
                Rect(t, "#ffffff", 12, 10, 2, 2); Rect(t, "#ffffff", 18, 10, 2, 2);
                Rect(t, "#1e1a16", 13, 10, 1, 2); Rect(t, "#1e1a16", 19, 10, 1, 2);
                Rect(t, Dk(hr, 0.9f), 12, 8, 3, 1); Rect(t, Dk(hr, 0.9f), 17, 8, 3, 1);
                Rect(t, skD, 15, 12, 2, 3); Rect(t, "#9a5e48", 14, 16, 4, 1);
                Rect(t, skD, 9, 10, 1, 3); Rect(t, skD, 22, 10, 1, 3);
            }
            if (l.Hat != null) { Rect(t, l.Hat, 8, 2, 16, 3); Rect(t, l.Hat, 10, 0, 12, 3); Rect(t, Dk(l.Hat, 0.7f), 8, 4, 16, 1); }
            Outline(t);
            t.Apply();
            return t;
        }

        // A one-pixel dark outline round everything drawn.
        static void Outline(Texture2D t)
        {
            var src = t.GetPixels(); var ink = Geo.Hex("#1c1510");
            int w = t.width, h = t.height;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    if (src[y * w + x].a > 0.5f) continue;
                    bool edge = false;
                    for (int k = 0; k < 4 && !edge; k++)
                    {
                        int nx = x + (k == 0 ? 1 : k == 1 ? -1 : 0), ny = y + (k == 2 ? 1 : k == 3 ? -1 : 0);
                        if (nx >= 0 && ny >= 0 && nx < w && ny < h && src[ny * w + nx].a > 0.5f) edge = true;
                    }
                    if (edge) t.SetPixel(x, y, ink);
                }
        }

        // Chunky mottled ground, like the pixel game's painted desert.
        public static Texture2D Mottle(int size, string[] cols, int seed, int blobs, int maxBlob)
        {
            var t = New(size, size, Geo.Hex(cols[0]), true);
            var r = new System.Random(seed);
            for (int i = 0; i < blobs; i++)
            {
                var c = Geo.Hex(cols[1 + r.Next(cols.Length - 1)]);
                int w = 1 + r.Next(maxBlob), h = 1 + r.Next(maxBlob), x = r.Next(size), y = r.Next(size);
                for (int j = 0; j < h; j++) for (int k = 0; k < w; k++) t.SetPixel((x + k) % size, (y + j) % size, c);
            }
            t.Apply();
            return t;
        }

        public static Texture2D Planks(string a, string b)
        {
            var t = New(32, 32, Geo.Hex(a), true);
            for (int y = 0; y < 32; y += 4) for (int x = 0; x < 32; x++) t.SetPixel(x, y, Geo.Hex(b));
            for (int y = 0; y < 32; y += 4) t.SetPixel((y * 7) % 32, y + 1 < 32 ? y + 1 : y, Geo.Hex(b));
            t.Apply();
            return t;
        }

        public static Texture2D Blob()
        {
            var t = new Texture2D(32, 32, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int y = 0; y < 32; y++)
                for (int x = 0; x < 32; x++)
                {
                    float d = new Vector2(x - 15.5f, y - 15.5f).magnitude / 15.5f;
                    t.SetPixel(x, y, new Color(1, 1, 1, Mathf.Clamp01(1 - d * d)));
                }
            t.Apply();
            return t;
        }
    }
}
