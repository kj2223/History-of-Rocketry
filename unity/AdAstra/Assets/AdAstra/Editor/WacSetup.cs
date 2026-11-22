// Editor-only setup, so the project opens ready to play: on first load it makes the scene (Assets/AdAstra/WAC.unity),
// opens it and puts it in the build; it keeps the shader variants the code-built world needs (Standard plain and
// emissive, the pixel people's cutout) by saving one material of each into Resources; and it keeps linear fog in
// builds. Menu: Ad Astra > Build Windows player. Batch use: -executeMethod AdAstra.EditorTools.WacSetup.BuildForBot
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

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

        static void KeepVariants()
        {
            if (!AssetDatabase.IsValidFolder(KeepDir))
            {
                Directory.CreateDirectory(KeepDir);
                AssetDatabase.Refresh();
            }
            Save("StandardPlain", Shader.Find("Standard"), null);
            Save("StandardGlow", Shader.Find("Standard"), m =>
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", Color.white);
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            });
            Save("SpriteCutout", Shader.Find("Legacy Shaders/Transparent/Cutout/Diffuse"), null);
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
