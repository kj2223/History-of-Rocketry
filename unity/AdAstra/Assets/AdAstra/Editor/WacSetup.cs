// Editor-only setup, so the project opens ready to play: on first load it makes the scene (Assets/AdAstra/WAC.unity),
// opens it and puts it in the build; it makes the URP asset and its two renderers (Assets/AdAstra/Settings) and sets
// them in Graphics and Quality; it keeps the shader variants the code-built world needs (URP Lit plain and emissive,
// the pixel people's alpha-clipped Simple Lit) by saving one material of each into Resources; and it keeps linear fog
// in builds. Menu: Ad Astra > Build Windows player. Batch use: -executeMethod AdAstra.EditorTools.WacSetup.BuildForBot
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace AdAstra.EditorTools
{
    [InitializeOnLoad]
    public static class WacSetup
    {
        const string ScenePath = "Assets/AdAstra/WAC.unity";
        const string KeepDir = "Assets/AdAstra/Resources/Keep";
        public const string PlayerPath = "Build/AdAstraWAC.exe";

        static WacSetup() { EditorApplication.delayCall += () => Prepare(true); }

        public static void Prepare(bool openScene)
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            Pipeline();
            KeepVariants();
            KeepFog();
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, ScenePath);
                AssetDatabase.Refresh();
            }
            if (EditorBuildSettings.scenes.Length == 0 || EditorBuildSettings.scenes[0].path != ScenePath)
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            if (openScene && EditorSceneManager.GetActiveScene().path != ScenePath && !Application.isBatchMode)
                EditorSceneManager.OpenScene(ScenePath);
            PlayerSettings.productName = "Ad Astra WAC (Unity prototype)";
            PlayerSettings.companyName = "Ad Astra";
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.defaultIsNativeResolution = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.resizableWindow = true;
        }

        const string SettingsDir = "Assets/AdAstra/Settings";

        // The URP asset: renderer 0 draws the world and runs the HD-2D light pass, renderer 1 draws the pixel people
        // (the sprite camera, an overlay in the world camera's stack). Values match the old built-in look: 260 m of
        // two-cascade shadows at 4096, soft shadows, lamp shadows, no MSAA or HDR, the depth texture for soft smoke,
        // 32-bit depth.
        static void Pipeline()
        {
            string assetPath = $"{SettingsDir}/AdAstra URP.asset";
            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(assetPath);
            if (!asset)
            {
                if (!AssetDatabase.IsValidFolder(SettingsDir)) AssetDatabase.CreateFolder("Assets/AdAstra", "Settings");
                var world = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(world, $"{SettingsDir}/World Renderer.asset");
                var post = ScriptableObject.CreateInstance<World.HD2DFeature>();
                post.name = "HD2D light pass";
                AssetDatabase.AddObjectToAsset(post, world);
                world.rendererFeatures.Add(post);
                // The renderer keeps a map of its features' file ids too (the inspector adds it; by script it is ours).
                AssetDatabase.SaveAssets();
                AssetDatabase.TryGetGUIDAndLocalFileIdentifier(post, out _, out long postId);
                var wso = new SerializedObject(world);
                var map = wso.FindProperty("m_RendererFeatureMap");
                map.arraySize = 1; map.GetArrayElementAtIndex(0).longValue = postId;
                wso.ApplyModifiedPropertiesWithoutUndo();
                var sprites = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(sprites, $"{SettingsDir}/Sprites Renderer.asset");
                foreach (var r in new[] { world, sprites })
                {
                    r.depthAttachmentFormat = DepthFormat.Depth_32_Stencil_8;
                    EditorUtility.SetDirty(r);
                }
                asset = UniversalRenderPipelineAsset.Create(world);
                AssetDatabase.CreateAsset(asset, assetPath);
                var so = new SerializedObject(asset);
                var list = so.FindProperty("m_RendererDataList");
                list.arraySize = 2;
                list.GetArrayElementAtIndex(1).objectReferenceValue = sprites;
                void Set(string name, System.Action<SerializedProperty> set)
                {
                    var p = so.FindProperty(name);
                    if (p == null) Debug.LogWarning($"Ad Astra URP setup: no {name} on the URP asset");
                    else set(p);
                }
                Set("m_RequireDepthTexture", p => p.boolValue = true);
                Set("m_SupportsHDR", p => p.boolValue = false);
                Set("m_MSAA", p => p.intValue = 1);
                Set("m_ShadowDistance", p => p.floatValue = 260);
                Set("m_ShadowCascadeCount", p => p.intValue = 2);
                Set("m_MainLightShadowsSupported", p => p.boolValue = true);
                Set("m_MainLightShadowmapResolution", p => p.intValue = 4096);
                Set("m_AdditionalLightsRenderingMode", p => p.intValue = (int)LightRenderingMode.PerPixel);
                Set("m_AdditionalLightShadowsSupported", p => p.boolValue = true);
                Set("m_AdditionalLightsShadowmapResolution", p => p.intValue = 2048);
                Set("m_SoftShadowsSupported", p => p.boolValue = true);
                so.ApplyModifiedPropertiesWithoutUndo();
                AssetDatabase.SaveAssets();
            }
            if (GraphicsSettings.defaultRenderPipeline != asset) GraphicsSettings.defaultRenderPipeline = asset;
            int was = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                if (QualitySettings.GetRenderPipelineAssetAt(i) == asset) continue;
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = asset;
            }
            QualitySettings.SetQualityLevel(was, false);
            AssetDatabase.SaveAssets();
        }

        static void KeepVariants()
        {
            if (!AssetDatabase.IsValidFolder(KeepDir))
            {
                Directory.CreateDirectory(KeepDir);
                AssetDatabase.Refresh();
            }
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            Save("LitPlain", lit, null);
            Save("LitGlow", lit, m =>
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", Color.white);
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            });
            Save("SpriteCutout", Shader.Find("Universal Render Pipeline/Simple Lit"), m =>
            {
                m.SetFloat("_AlphaClip", 1); m.EnableKeyword("_ALPHATEST_ON");
                m.renderQueue = (int)RenderQueue.AlphaTest;
            });
        }

        static void Save(string name, Shader s, System.Action<Material> setup)
        {
            string path = $"{KeepDir}/{name}.mat";
            if (!s || File.Exists(path)) return;
            var m = new Material(s);
            setup?.Invoke(m);
            m.mainTexture = Texture2D.whiteTexture;
            AssetDatabase.CreateAsset(m, path);
            AssetDatabase.SaveAssets();
        }

        static void KeepFog()
        {
            var gs = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset");
            if (gs == null || gs.Length == 0) return;
            var so = new SerializedObject(gs[0]);
            var strip = so.FindProperty("m_FogStripping");
            var keep = so.FindProperty("m_FogKeepLinear");
            if (strip == null || keep == null) return;
            if (strip.intValue == 1 && keep.boolValue) return;
            strip.intValue = 1; keep.boolValue = true;
            so.ApplyModifiedProperties();
        }

        [MenuItem("Ad Astra/Build Windows player")]
        public static void BuildMenu()
        {
            Prepare(false);
            Build();
            EditorUtility.RevealInFinder(PlayerPath);
        }

        // For the test run: build the player, exit with 0 on success, 1 on failure.
        public static void BuildForBot()
        {
            Prepare(false);
            bool ok = Build();
            EditorApplication.Exit(ok ? 0 : 1);
        }

        static bool Build()
        {
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = PlayerPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            });
            Debug.Log($"Ad Astra build: {r.summary.result}, {r.summary.totalErrors} errors, {r.summary.totalSize / 1048576} MB");
            return r.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded;
        }
    }
}
