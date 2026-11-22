// The flight's path: it flies what the rules decided, and an angled launcher means an angled rocket from the first
// frame, with no snap back to vertical as she leaves the rail (Aaron, 22 Nov 2026).
using System;
using AdAstra.Rules.Flight;
using NUnit.Framework;

namespace AdAstra.Rules.Tests
{
    public class FlightPathTests
    {
        static readonly object[] Cases =
        {
            // name, rail tilt, cross tilt, wind east, wind north, burn, apogee, range, cross
            new object[] { "WAC good round", 3.0, 0.0, 0.0, 0.0, 47.0, 70.0, 18.0, 0.0 },
            new object[] { "WAC in a crosswind", 3.0, 0.0, 8.0, 0.0, 47.0, 66.0, 16.0, 2.5 },
            new object[] { "WAC laid west against an east wind", 3.0, -1.5, 9.0, -3.0, 47.0, 70.0, 20.0, -1.0 },
            new object[] { "WAC motor cut early", 3.0, 0.0, 0.0, 0.0, 9.0, 9.0, 3.0, 0.4 },
            new object[] { "V-2 good round", 2.0, 0.0, 4.0, 2.0, 65.0, 170.0, 50.0, -3.0 },
            new object[] { "Aerobee", 4.0, 0.0, 0.0, 5.0, 40.0, 114.0, 30.0, 1.0 },
        };

        static FlightPath Shape(double tilt, double crossTilt, double we, double wn, double burn, double ap, double rg, double cr) =>
            FlightPath.Shape(
                new LaunchSetup { RailTiltDeg = tilt, RailCrossTiltDeg = crossTilt, WindEast = we, WindNorth = wn, BurnTime = burn },
                new FlightTargets { ApogeeKm = ap, RangeKm = rg, CrossKm = cr });

        [TestCaseSource(nameof(Cases))]
        public void FliesWhatTheRulesDecided(string name, double tilt, double crossTilt, double we, double wn, double burn, double ap, double rg, double cr)
        {
            var p = Shape(tilt, crossTilt, we, wn, burn, ap, rg, cr);
            Assert.That(p.Calibrated, Is.True, name);
            Assert.That(p.ApogeeKm, Is.EqualTo(ap).Within(ap * 0.01), name + " peak");
            Assert.That(p.RangeKm, Is.EqualTo(rg).Within(0.05), name + " range");
            Assert.That(p.CrossKm, Is.EqualTo(cr).Within(0.05), name + " cross");
            // A misalignment a real round could have, not a steering hand.
            Assert.That(Math.Abs(p.PitchKickDeg), Is.LessThan(15), name + " pitch kick");
            Assert.That(Math.Abs(p.YawKickDeg), Is.LessThan(15), name + " yaw kick");
        }

        [TestCaseSource(nameof(Cases))]
        public void PointsAlongTheRailFromTheFirstFrameAndNeverSnaps(string name, double tilt, double crossTilt, double we, double wn, double burn, double ap, double rg, double cr)
        {
            var p = Shape(tilt, crossTilt, we, wn, burn, ap, rg, cr);
            var first = p.Samples[0];
            Assert.That(Vec3.AngleDeg(first.Dir, Vec3.Up), Is.GreaterThan(0.5).Or.EqualTo(0).Within(1e-9).And.LessThan(Math.Max(tilt, 0.1) + Math.Abs(crossTilt) + 0.01), name + " starts along the rail");
            Assert.That(first.OnRail, Is.True);
            // No turn of more than 2.5 degrees in any 1/20 s while climbing under thrust (a snap back to vertical
            // would be several degrees in one frame).
            for (int i = 1; i < p.Samples.Count; i++)
            {
                var a = p.Samples[i - 1]; var b = p.Samples[i];
                if (!b.Thrusting) break;
                Assert.That(Vec3.AngleDeg(a.Dir, b.Dir), Is.LessThan(2.5), $"{name}: turn at t={b.T:0.00}");
            }
            // In still air she keeps leaning the way the rail leaned as she leaves it. (A wind can turn her, but only
            // gradually, which the turn check above covers: a tailwind stands her up a little, as it would.)
            if (we != 0 || wn != 0) return;
            var exit = p.At(p.RailExitT + 0.5);
            Assert.That(Vec3.AngleDeg(exit.Dir, Vec3.Up), Is.GreaterThan(Vec3.AngleDeg(first.Dir, Vec3.Up) * 0.5), name + " still leaning just off the rail");
        }

        [Test]
        public void AStraightUpRailInStillAirGoesStraightUp()
        {
            var p = FlightPath.Fly(new LaunchSetup { BurnTime = 47 }, 40, 0, 0);
            Assert.That(Math.Abs(p.RangeKm), Is.LessThan(1e-6));
            Assert.That(Math.Abs(p.CrossKm), Is.LessThan(1e-6));
            Assert.That(p.ApogeeKm, Is.GreaterThan(10));
        }

        [Test]
        public void ACrosswindTurnsHerIntoTheWind()
        {
            // Wind blowing towards the east: air flows past her from the east, so the nose swings east (into it).
            var p = FlightPath.Fly(new LaunchSetup { RailTiltDeg = 0, BurnTime = 47, WindEast = -10 }, 40, 0, 0);
            var s = p.At(p.RailExitT + 1);
            Assert.That(s.Dir.X, Is.GreaterThan(0.01), "nose turned into a wind from the east");
        }

        [Test]
        public void TheNoseFollowsHerOverTheTop()
        {
            var p = Shape(3, 0, 0, 0, 47, 70, 18, 0);
            var top = p.Samples[0];
            foreach (var s in p.Samples) if (s.Pos.Y > top.Pos.Y) top = s;
            Assert.That(Math.Abs(top.Dir.Y), Is.LessThan(0.2), "near level at the peak");
            var fall = p.At(p.ImpactT - 1);
            Assert.That(fall.Dir.Y, Is.LessThan(-0.5), "nose down coming in");
        }
    }
}
