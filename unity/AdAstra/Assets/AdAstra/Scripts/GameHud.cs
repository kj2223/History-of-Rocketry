// First UI Toolkit slice: the title and top bar. The world/plots and remaining clipboard stay in IMGUI for now.
// The panel renders at display resolution after the world; only actual controls intercept pointer input.
using AdAstra.Truth;
using AdAstra.UI;
using UnityEngine;
using UnityEngine.UIElements;

namespace AdAstra
{
    public sealed partial class Game
    {
        Image hudWorld;
        PanelSettings hudSettings;
        VisualElement hudRoot, titleHud, topHud;
        Label hudDate, hudObjective, hudHours;
        readonly Button[] speedButtons = new Button[3];

        void BuildHud()
        {
            var document = GetComponent<UIDocument>();
            if (document == null) document = gameObject.AddComponent<UIDocument>();
            if (hudSettings == null)
            {
                hudSettings = Instantiate(Resources.Load<PanelSettings>("UI/FieldPanel"));
                hudSettings.scaleMode = PanelScaleMode.ConstantPixelSize;
                hudSettings.sortingOrder = 10;
            }
            document.panelSettings = hudSettings;
            hudRoot = document.rootVisualElement;
            hudRoot.Clear();
            hudRoot.name = "ad-astra-hud";
            hudRoot.style.position = Position.Absolute;
            hudRoot.style.left = hudRoot.style.right = hudRoot.style.top = hudRoot.style.bottom = 0;
            hudRoot.pickingMode = PickingMode.Ignore;
            hudRoot.style.unityFont = Ui.Font;
            hudRoot.style.color = Ui.Cream;

            hudWorld = new Image { name = "world-picture", pickingMode = PickingMode.Ignore, scaleMode = ScaleMode.StretchToFill };
            hudWorld.style.position = Position.Absolute;
            hudWorld.style.left = hudWorld.style.right = hudWorld.style.top = hudWorld.style.bottom = 0;
            hudRoot.Add(hudWorld);

            titleHud = new VisualElement { name = "title", pickingMode = PickingMode.Ignore };
            titleHud.style.position = Position.Absolute;
            titleHud.style.left = titleHud.style.right = 0;
            titleHud.style.top = Length.Percent(30);
            titleHud.style.height = 300;
            titleHud.style.backgroundColor = new Color(0.07f, 0.07f, 0.05f, 0.72f);
            hudRoot.Add(titleHud);
            var title = HudLabel("AD ASTRA", 54, Ui.Accent);
            title.style.unityFontStyleAndWeight = FontStyle.Bold;
            PlaceHud(title, 0, 20, null, 80); title.style.right = 0; titleHud.Add(title);
            var subtitle = HudLabel("The WAC Corporal programme · White Sands Proving Ground, 1945–1946", 24, Ui.Cream);
            PlaceHud(subtitle, 0, 100, null, 40); subtitle.style.right = 0; titleHud.Add(subtitle);
            var note = HudLabel("An HD-2D prototype: a 3D world, pixel people, light and film over it", 18, Ui.Accent);
            PlaceHud(note, 0, 142, null, 40); note.style.right = 0; titleHud.Add(note);
            var begin = HudButton("Begin the season", () => Later(() => NewSeason(gameSeed)));
            begin.name = "begin-season";
            PlaceHud(begin, 0, 205, 400, 56);
            begin.style.left = Length.Percent(50); begin.style.marginLeft = -200;
            titleHud.Add(begin);
            var help = HudLabel("Right-drag turns the camera a little; the wheel moves it in and out.", 18, Ui.Cream);
            help.name = "camera-help";
            PlaceHud(help, 0, 0, null, 30); help.style.right = 0;
            help.style.top = StyleKeyword.Auto; help.style.bottom = 30;
            hudRoot.Add(help);

            topHud = new VisualElement { name = "top-bar", pickingMode = PickingMode.Ignore };
            PlaceHud(topHud, 0, 0, null, 54); topHud.style.right = 0;
            topHud.style.backgroundColor = Ui.OliveDark;
            hudRoot.Add(topHud);
            hudDate = HudLabel("", 20, Ui.Accent);
            hudDate.style.backgroundColor = Ui.Hex("#1d1a10");
            PlaceHud(hudDate, 14, 8, 430, 38); topHud.Add(hudDate);
            hudObjective = HudLabel("", 17, Ui.Cream);
            hudObjective.style.unityTextAlign = TextAnchor.MiddleLeft;
            hudObjective.style.whiteSpace = WhiteSpace.Normal;
            PlaceHud(hudObjective, 460, 6, null, 42); hudObjective.style.right = 780;
            topHud.Add(hudObjective);
            hudHours = HudLabel("", 17, Ui.Accent);
            PlaceHud(hudHours, 0, 14, 460, 30); hudHours.style.left = StyleKeyword.Auto; hudHours.style.right = 310;
            topHud.Add(hudHours);
            for (int i = 0; i < speedButtons.Length; i++)
            {
                float rate = i == 0 ? 1 : i == 1 ? 4 : 16;
                var button = HudButton($"{rate}×", () => Later(() => speed = rate));
                button.name = $"speed-{rate}";
                PlaceHud(button, 0, 9, 84, 36); button.style.left = StyleKeyword.Auto; button.style.right = 206 - i * 92;
                speedButtons[i] = button; topHud.Add(button);
            }
            RefreshHud();
        }

        static Label HudLabel(string text, int size, Color color)
        {
            var label = new Label(text) { pickingMode = PickingMode.Ignore };
            label.style.fontSize = size; label.style.color = color;
            label.style.unityTextAlign = TextAnchor.MiddleCenter;
            label.style.marginLeft = label.style.marginRight = label.style.marginTop = label.style.marginBottom = 0;
            return label;
        }

        static Button HudButton(string text, System.Action action)
        {
            var button = new Button(action) { text = text };
            button.style.fontSize = 20; button.style.unityFontStyleAndWeight = FontStyle.Bold;
            button.style.color = Ui.Cream; button.style.backgroundColor = Ui.Olive;
            button.style.borderLeftWidth = button.style.borderRightWidth = button.style.borderTopWidth = button.style.borderBottomWidth = 0;
            button.style.borderTopLeftRadius = button.style.borderTopRightRadius = button.style.borderBottomLeftRadius = button.style.borderBottomRightRadius = 0;
            button.style.marginLeft = button.style.marginRight = button.style.marginTop = button.style.marginBottom = 0;
            button.RegisterCallback<MouseEnterEvent>(_ => button.style.color = Ui.Accent);
            button.RegisterCallback<MouseLeaveEvent>(_ => button.style.color = Ui.Cream);
            return button;
        }

        static void PlaceHud(VisualElement element, float left, float top, float? width, float height)
        {
            element.style.position = Position.Absolute;
            element.style.left = left; element.style.top = top; element.style.height = height;
            if (width.HasValue) element.style.width = width.Value;
        }

        void RefreshHud()
        {
            var document = GetComponent<UIDocument>();
            if (document == null || !document.isActiveAndEnabled) return;
            if (hudRoot != document.rootVisualElement || hudRoot.childCount == 0) { BuildHud(); return; }
            hudWorld.image = view.Final;
            // Same height-based scale as IMGUI; the panel always covers the full physical display.
            hudSettings.scale = Screen.height / 1080f;
            bool title = beat == Beat.Title;
            titleHud.style.display = title ? DisplayStyle.Flex : DisplayStyle.None;
            hudRoot.Q<Label>("camera-help").style.display = title ? DisplayStyle.Flex : DisplayStyle.None;
            topHud.style.display = title ? DisplayStyle.None : DisplayStyle.Flex;
            if (title) return;
            hudDate.text = $"{DateText()} · {ClockText()}";
            hudObjective.text = objective;
            hudHours.text = slot != null && beat != Beat.RoundEnd && beat != Beat.SeasonEnd
                ? $"Crew hours left: {Slot.HoursText(slot.Left)} of {Slot.HoursText(slot.Budget)}" : "";
            hudHours.style.color = slot != null && slot.Left <= 0 ? Ui.Hex("#ff8a6a") : Ui.Accent;
            for (int i = 0; i < speedButtons.Length; i++)
                speedButtons[i].style.backgroundColor = Mathf.Approximately(speed, i == 0 ? 1 : i == 1 ? 4 : 16) ? Ui.Hex("#7a5a1e") : Ui.Olive;
        }

        void OnDestroy()
        {
            if (hudSettings != null) Destroy(hudSettings);
        }
    }
}
