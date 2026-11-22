// How the team builds rounds now, and what it has learned. Ported from world/programme.js and world/slot.js (WAC only).
using System;
using System.Collections.Generic;
using System.Linq;

namespace AdAstra.Truth
{
    public sealed class FlownRound
    {
        public string Id, Name, Failure;
        public double? Apogee;
        public double Load;
        public bool Late, Hidden;
        public List<PathPoint> Trace;
    }

    public sealed class Programme
    {
        public double WeldRisk = 0.55, LeakRisk = 0.45;
        public string Igniter = "r1";
        public List<string> Adopted = new List<string>();
        public List<FlownRound> Flights = new List<FlownRound>();
        public Dictionary<string, int> Batch = new Dictionary<string, int>();
        public int Standing;

        public const int LotRounds = 2;

        public bool InLot(string cause) => Batch.ContainsKey(cause);
        public double RiskFor(string cause, double risk) => InLot(cause) ? Math.Min(0.9, risk * 1.6) : risk;

        public static readonly Dictionary<string, string> FixText = new Dictionary<string, string>
        {
            ["ignition"] = "Every WAC upper stage now gets the reworked igniter as standard.",
            ["weld"] = "Every tank seam is now X-rayed before the stage leaves the shop.",
            ["leak"] = "Every fitting is now pressure-tested and safety-wired before rollout.",
        };

        public string Adopt(string cause)
        {
            if (!FixText.ContainsKey(cause) || Adopted.Contains(cause)) return null;
            if (cause == "ignition") Igniter = "r3";
            if (cause == "weld") WeldRisk *= 0.4;
            if (cause == "leak") LeakRisk *= 0.4;
            Adopted.Add(cause);
            Batch.Remove(cause);
            return FixText[cause];
        }

        public void Record(FlownRound f)
        {
            Flights.Add(f);
            foreach (var c in Batch.Keys.ToList()) if (--Batch[c] <= 0) Batch.Remove(c);
            if (f.Failure != null && !f.Hidden && !Adopted.Contains(f.Failure)) Batch[f.Failure] = LotRounds;
        }

        public double RangeRecord => Flights.Where(f => f.Apogee.HasValue).Select(f => f.Apogee.Value).DefaultIfEmpty(0).Max();

        // The drawing office's estimate for a propellant load. Each good flight pulls it toward what the radar saw.
        static double LoadFactor(double load) => Math.Pow(0.55 + 0.45 * load, 2);
        public (int low, int high, int flights) Estimate(double load)
        {
            const double paper = 62, spread0 = 0.18;
            var seen = Flights.Where(f => f.Apogee.HasValue).Select(f => f.Apogee.Value / LoadFactor(f.Load)).ToList();
            double full = (paper + seen.Sum()) / (1 + seen.Count);
            double spread = spread0 / (1 + 0.8 * seen.Count);
            double mid = full * LoadFactor(load);
            return ((int)Math.Round(mid * (1 - spread)), (int)Math.Round(mid * (1 + spread)), seen.Count);
        }

        // Two of your last three rounds flown late costs a point.
        public bool LateMark()
        {
            var last = Flights.Skip(Math.Max(0, Flights.Count - 3)).ToList();
            return last.Count(f => f.Late) >= 2;
        }
    }

    // THE RANGE SLOT: a few hours of crew time before the round's slot on the range. Run past them and the range gives the
    // slot away: the round waits a day for each working day over.
    public sealed class Slot
    {
        public const double WacHours = 6, RebuildHours = 2, MinHours = 3, DayHours = 8;
        public double Budget, Spent;
        public List<(string what, double hours)> Items = new List<(string, double)>();

        public Slot(double shortBy) { Budget = Math.Max(MinHours, WacHours - shortBy); }
        public void Spend(double h, string what) { if (h <= 0) return; Spent = Math.Round((Spent + h) * 100) / 100; Items.Add((what, h)); }
        public double Left => Math.Max(0, Math.Round((Budget - Spent) * 100) / 100);
        public double Overrun => Math.Max(0, Spent - Budget);
        public int DaysOver => (int)Math.Max(0, Math.Ceiling(Overrun / DayHours - 1e-9));

        public static string HoursText(double h)
        {
            int m = (int)Math.Round(h * 60);
            if (m < 60) return $"{m} min";
            return m % 60 != 0 ? $"{m / 60} h {m % 60} min" : $"{m / 60} h";
        }
    }

    public sealed class RoundDef
    {
        public string Id, Name;
        public DateTime Start;
        public string[] Between;
    }

    public static class Campaign
    {
        // White Sands, the player's first season: the WAC Corporal (first flights 11 October 1945). Dates marked provisional
        // in the game are a plausible round in that stretch.
        public static readonly RoundDef[] Season =
        {
            new RoundDef { Id = "wac-1", Name = "the first WAC Corporal round", Start = new DateTime(1945, 10, 9),
                Between = new[] { "White Sands Proving Ground, New Mexico. JPL's WAC Corporal team has come out from Pasadena with the first rounds.",
                                  "You are the junior engineer on the stage. Ellis runs the firing; Sgt. Kowalski and Pvt. Delgado are your crew." } },
            new RoundDef { Id = "wac-2", Name = "the second WAC Corporal round", Start = new DateTime(1945, 10, 23),
                Between = new[] { "The rest of the October rounds kept the crew busy. You were not on them." } },
            new RoundDef { Id = "wac-3", Name = "a spring 1946 WAC Corporal round", Start = new DateTime(1946, 5, 14),
                Between = new[] { "Winter on the range: the WAC team went back to Pasadena to rework the design, and you went with the drawings.",
                                  "Over the winter the Army assembled V-2s from the captured parts that came by rail last year. On 16 April 1946 they launched the first from their own pad down the range." } },
            new RoundDef { Id = "wac-b", Name = "the first WAC-B, the improved WAC Corporal", Start = new DateTime(1946, 12, 3),
                Between = new[] { "Summer and autumn 1946: the V-2 firings carried on through the year. About half went wrong one way or another: a pump, the controls, the radio.",
                                  "The WAC-B is the improved round: lighter, with the lessons of the 1945 flights built in." } },
        };
    }
}
