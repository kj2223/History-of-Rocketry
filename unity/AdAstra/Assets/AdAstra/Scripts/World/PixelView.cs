// The camera and the picture, in two layers at the window's full resolution (4K stays 4K):
//   1. the 3D world, rendered and then passed through the HD-2D light (tilt-shift, glow, newsreel grade);
//   2. the pixel people, on their own layer, drawn after the light pass with the world's depth, so they are hidden
//      behind walls and consoles but stay crisp, hard-edged pixel art at any size.
// The camera glides between the views the game asks for; the right mouse button turns it a little and the wheel moves
// it in and out, so the world can be looked at from the side.
// In URP the two layers are a camera stack drawing into Final: the world camera (base, world renderer, which runs the
// HD-2D light pass in HD2DFeature) and the sprite camera (overlay, sprites renderer), which keeps the world's depth.
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace AdAstra.World
{
    public sealed class PixelView
    {
        public const int SpriteLayer = 31;

        public Camera Cam, SpriteCam;
        public RenderTexture Final;
        public Material Post;
        public Rect Screen;          // where the picture lands, GUI coordinates
        public float Fade;
        public float Focus = 0.45f;

        View from, to;
        bool tracking;               // a tracking shot: the wheel narrows the lens instead of moving the camera
        float t = 1, dur = 1.2f;
        float yaw, zoom = 1, yawGoal, zoomGoal = 1;
        Transform sky;
        int w, h;

        public PixelView(Transform skySphere)
        {
            sky = skySphere;
            Cam = new GameObject("World camera").AddComponent<Camera>();
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = Geo.Hex("#cfc9b8");
            Cam.nearClipPlane = 0.5f; Cam.farClipPlane = 9000;
            Cam.allowMSAA = false; Cam.allowHDR = false;
            Cam.cullingMask = ~(1 << SpriteLayer);
            Cam.enabled = false;
            Cam.gameObject.AddComponent<AudioListener>();
            SpriteCam = new GameObject("Sprite camera").AddComponent<Camera>();
            SpriteCam.transform.SetParent(Cam.transform, false);
            SpriteCam.clearFlags = CameraClearFlags.Nothing;
            SpriteCam.cullingMask = 1 << SpriteLayer;
            SpriteCam.nearClipPlane = 0.5f; SpriteCam.farClipPlane = 9000;
            SpriteCam.allowMSAA = false; SpriteCam.allowHDR = false;
            // Renderer 0 is the world renderer, 1 the sprites renderer (WacSetup builds the URP asset).
            var world = Cam.GetUniversalAdditionalCameraData();
            world.SetRenderer(0);
            world.requiresDepthTexture = true; // for the soft edges of the smoke
            var sprites = SpriteCam.GetUniversalAdditionalCameraData();
            sprites.renderType = CameraRenderType.Overlay;
            sprites.SetRenderer(1);
            // shortcut: URP has no public setter for an overlay's Clear Depth (the inspector's toggle); set its field.
            typeof(UniversalAdditionalCameraData).GetField("m_ClearDepth", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                .SetValue(sprites, false);
            world.cameraStack.Add(SpriteCam);
            // An empty camera that is always on, so the Game view has a camera rendering to the display (the picture
            // itself comes from the stack above and is presented by the UI Toolkit world image).
            var screenCam = new GameObject("Screen camera").AddComponent<Camera>();
            screenCam.cullingMask = 0; screenCam.clearFlags = CameraClearFlags.SolidColor; screenCam.backgroundColor = Color.black;
            screenCam.depth = -100; screenCam.allowMSAA = false; screenCam.allowHDR = false;
            Post = new Material(Shader.Find("Hidden/AdAstra/HD2DPost"));
            HD2DFeature.Material = Post;
        }

        void EnsureTargets()
        {
            int sw = UnityEngine.Screen.width, sh = UnityEngine.Screen.height;
            if (Final != null && sw == w && sh == h) return;
            if (Final != null) { Cam.targetTexture = null; Final.Release(); Object.Destroy(Final); }
            w = sw; h = sh;
            Final = new RenderTexture(w, h, 32, RenderTextureFormat.ARGB32) { name = "Final", filterMode = FilterMode.Point };
            Final.Create();
            Cam.targetTexture = Final;
            Cam.enabled = true;
            Screen = new Rect(0, 0, w, h);
        }

        public void Go(View v, bool cut = false, float seconds = 1.4f)
        {
            if (to == v) return;
            from = cut || to == null ? v : Current();
            to = v; t = cut ? 1 : 0; dur = seconds; tracking = false;
            yawGoal = 0; zoomGoal = 1;
            if (cut) { yaw = 0; zoom = 1; }
        }

        public View Target => to;

        View Current()
        {
            var a = Pose();
            return new View(a.pos, a.target, Cam.fieldOfView, Focus);
        }

        (Vector3 pos, Vector3 target) Pose()
        {
            float k = Mathf.SmoothStep(0, 1, t);
            var tgt = Vector3.Lerp(from.Target, to.Target, k);
            var pos = Vector3.Lerp(from.Pos, to.Pos, k);
            if (tracking) return (pos, tgt);
            var off = pos - tgt;
            off = Quaternion.Euler(0, yaw, 0) * off * zoom;
            pos = tgt + off;
            // Never under the floor: the desert, or the floor of the room being looked into.
            float floor = (tgt.y < -100 ? Site.RoomFloor : 0) + 1.2f;
            if (pos.y < floor) pos.y = floor;
            return (pos, tgt);
        }

        public void Follow(Vector3 target, Vector3 pos, float fov)
        {
            to = new View(pos, target, fov, Focus); from = to; t = 1; tracking = true;
        }

        public void Tick(float dt, bool mouse = true)
        {
            EnsureTargets();
            if (to == null) return;
            t = Mathf.Min(1, t + dt / dur);
            if (mouse)
            {
                if (Input.GetMouseButton(1)) yawGoal += Input.GetAxis("Mouse X") * 3f;
                zoomGoal = Mathf.Clamp(zoomGoal - Input.mouseScrollDelta.y * 0.08f, 0.55f, 1.5f);
            }
            yawGoal = Mathf.Clamp(yawGoal, -35, 35);
            yaw = Mathf.Lerp(yaw, yawGoal, 1 - Mathf.Exp(-dt * 6));
            zoom = Mathf.Lerp(zoom, zoomGoal, 1 - Mathf.Exp(-dt * 6));
            var p = Pose();
            Cam.transform.position = p.pos;
            Cam.transform.LookAt(p.target);
            Cam.fieldOfView = Mathf.Lerp(from.Fov, to.Fov, Mathf.SmoothStep(0, 1, t)) * (tracking ? Mathf.Clamp(zoom, 0.55f, 1.5f) : 1);
            SpriteCam.fieldOfView = Cam.fieldOfView;
            Focus = Mathf.Lerp(from.Focus, to.Focus, Mathf.SmoothStep(0, 1, t));
            if (sky) sky.position = Cam.transform.position;
        }

        // Set the light pass for this frame; URP renders the stack after LateUpdate. blur: tilt-shift strength in 1080p
        // pixels.
        public void Render(int frameNo, float film, float bloom, float blur)
        {
            EnsureTargets();
            Post.SetFloat("_Focus", Focus);
            Post.SetFloat("_Band", 0.16f);
            Post.SetFloat("_Blur", blur);
            Post.SetFloat("_Bloom", bloom);
            Post.SetFloat("_Film", film);
            Post.SetFloat("_Fade", Fade);
            Post.SetFloat("_FrameNo", frameNo);
        }

        // Where a point in the world shows on screen (GUI coordinates), and whether it is in front of the camera.
        public bool ToScreen(Vector3 world, out Vector2 gui)
        {
            var v = Cam.WorldToViewportPoint(world);
            gui = new Vector2(Screen.x + v.x * Screen.width, Screen.y + (1 - v.y) * Screen.height);
            return v.z > 0;
        }
    }
}
