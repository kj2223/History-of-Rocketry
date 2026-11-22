// What the player can see and say about a WAC Corporal round: the spots on the stage, the test kit, the calls in
// flight, what the wreck shows. Ported from the game's data/kits.js (wac) and truth/round.js (METERS).
using System.Collections.Generic;

namespace AdAstra.Truth
{
    public sealed class Spot
    {
        public string Id, Name, Fault, Sound, Cue;
        public Spot(string id, string name, string fault, string sound, string cue)
        { Id = id; Name = name; Fault = fault; Sound = sound; Cue = cue; }
    }

    public sealed class Meter
    {
        public string Name, Unit;
        public int Minutes;
        public double Limit, SoundLo, SoundHi, BadLo, BadHi;
        public bool Whole, Low;
    }

    public struct Call
    {
        public float T; public string Text; public string Tone;
        public Call(float t, string text, string tone = "") { T = t; Text = text; Tone = tone; }
    }

    public static class Wac
    {
        public const string Name = "WAC Corporal";

        public static readonly Spot[] Spots =
        {
            new Spot("weld-fwd", "Forward tank weld", "weld", "The bead is even all the way round.",
                "A hairline of discolouration runs along part of the seam."),
            new Spot("weld-mid", "Tank girth weld", "weld", "Clean, regular ripples in the bead.",
                "The bead thins out and there is a pinhole you could miss."),
            new Spot("weld-aft", "Aft tank weld", "weld", "Smooth and bright, ground flush.",
                "Spatter and a slight undercut at the edge of the bead."),
            new Spot("fitting", "Acid feed fitting", "leak", "Dry to the touch, safety wire in place.",
                "A faint green stain under the union nut."),
            new Spot("pressure", "Helium pressurisation line", "leak", "Tight, no hiss with the line charged.",
                "You think you hear a faint hiss, but the hangar is noisy."),
            new Spot("fins", "Fin attachment", null, "Rivets tight, fins true.",
                "One fin looks a degree off true by eye."),
        };

        public static Spot SpotById(string id)
        {
            foreach (var s in Spots) if (s.Id == id) return s;
            return null;
        }

        public static readonly Dictionary<string, Meter> Meters = new Dictionary<string, Meter>
        {
            ["leak"] = new Meter { Name = "Pressure-decay test", Minutes = 30, Unit = "bar lost in 10 min", Limit = 0.2,
                SoundLo = 0.02, SoundHi = 0.15, BadLo = 0.3, BadHi = 1.2 },
            ["weld"] = new Meter { Name = "X-ray the seam", Minutes = 45, Unit = "pores per inch", Limit = 2,
                SoundLo = 0, SoundHi = 2, BadLo = 4, BadHi = 9, Whole = true },
            ["default"] = new Meter { Name = "Bench check", Minutes = 30, Unit = "of 10 cycles clean", Limit = 10,
                SoundLo = 10, SoundHi = 10, BadLo = 6, BadHi = 9, Whole = true, Low = true },
        };

        public static Meter MeterFor(Spot s)
        {
            if (s == null || s.Fault == null) return null;
            return Meters.TryGetValue(s.Fault, out var m) ? m : Meters["default"];
        }

        public const string Brief = "Static fire tomorrow. Check the tank welds first, would you?";
        public const string InspectIntro = "The stage lies on its cradle with the panels off. Kowalski hands you a torch.";

        // The red-line card for the stand: chamber pressure, bar.
        public const double PcLo = 17, PcHi = 23;
        // The tank's normal band in the count (bar).
        public const double TankLo = 22, TankHi = 24;

        public static readonly Dictionary<string, string> Short = new Dictionary<string, string>
        {
            ["nominal"] = "a good flight", ["ignition"] = "a rough ignition", ["weld"] = "a weld failure",
            ["leak"] = "a leak", ["unknown"] = "not enough evidence",
        };

        public static readonly Dictionary<string, string> Explanations = new Dictionary<string, string>
        {
            ["nominal"] = "The round flew as planned. Nothing to fix.",
            ["ignition"] = "A rough ignition. The igniter needs reworking.",
            ["weld"] = "A tank weld let go under load.",
            ["leak"] = "A propellant leak starved the motor.",
            ["unknown"] = "Not enough evidence. I want another static firing.",
        };

        public const string Lift = "Liftoff! She's off the tower.";

        public static List<Call> CallsFor(string failure, float burn)
        {
            var l = new List<Call>();
            if (failure == "ignition") { l.Add(new Call(2, "No sustainer light! She's going over!", "bad")); return l; }
            l.Add(new Call(1, "Booster burnout. Sustainer lit.", "go"));
            if (failure == "weld") { l.Add(new Call(14, "A flash! Pieces coming off her!", "bad")); return l; }
            if (failure == "leak")
            {
                l.Add(new Call(10, "Sustainer burning. Track is good."));
                l.Add(new Call(24, "Flame's out early! Burnout at 24 seconds.", "bad"));
                return l;
            }
            l.Add(new Call(10, "Sustainer burning steady. Track is good."));
            l.Add(new Call(burn, $"Burnout at {burn:0} seconds. Coasting.", "go"));
            return l;
        }

        public static readonly Dictionary<string, string[]> Wreck = new Dictionary<string, string[]>
        {
            ["ignition"] = new[] { "The upper stage came down close in, nearly whole.",
                "The injector face is streaked with unburnt propellant.",
                "The igniter housing is scorched on one side only." },
            ["weld"] = new[] { "Pieces are spread over a long strip of the range.",
                "The propellant tank is torn open along a weld seam, the edges peeled outward.",
                "The motor itself looks undamaged." },
            ["leak"] = new[] { "The round came down short of the planned impact.",
                "Green acid staining runs back from the feed fitting along the skin.",
                "The motor shows a clean burn that simply stopped." },
            ["nominal"] = new[] { "The round dug itself a crater well downrange.",
                "The motor nozzle shows an even burn all the way round.",
                "Nothing unusual on what is left of the tank." },
        };

        public static readonly Dictionary<string, string> Found = new Dictionary<string, string>
        { ["weld"] = "weld flaw", ["leak"] = "leak" };
    }
}
