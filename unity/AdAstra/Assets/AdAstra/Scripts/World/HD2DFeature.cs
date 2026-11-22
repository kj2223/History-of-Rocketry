// The HD-2D light pass as a URP renderer feature. It sits on the world renderer only, after the transparents, so it
// runs over the 3D world before the sprite camera (an overlay in the world camera's stack) draws the pixel people on
// top with the world's depth. PixelView owns the material and sets its values each frame.
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.RenderGraphModule;
using UnityEngine.Rendering.RenderGraphModule.Util;
using UnityEngine.Rendering.Universal;

namespace AdAstra.World
{
    public sealed class HD2DFeature : ScriptableRendererFeature
    {
        public static Material Material;
        Pass pass;

        public override void Create() => pass = new Pass { renderPassEvent = RenderPassEvent.AfterRenderingTransparents };

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            if (Material) renderer.EnqueuePass(pass);
        }

        sealed class Pass : ScriptableRenderPass
        {
            public override void RecordRenderGraph(RenderGraph graph, ContextContainer frame)
            {
                var res = frame.Get<UniversalResourceData>();
                if (res.isActiveTargetBackBuffer) return;
                var src = res.activeColorTexture;
                var desc = graph.GetTextureDesc(src);
                desc.name = "HD2D";
                desc.clearBuffer = false;
                var tmp = graph.CreateTexture(desc);
                Material.SetVector("_SrcSize", new Vector4(1f / desc.width, 1f / desc.height, desc.width, desc.height));
                // Through a temporary target: a pass may not read and write the camera colour at once.
                graph.AddBlitPass(new RenderGraphUtils.BlitMaterialParameters(src, tmp, Material, 0), "HD2D light pass");
                graph.AddBlitPass(tmp, src, Vector2.one, Vector2.zero, passName: "HD2D copy back");
            }
        }
    }
}
