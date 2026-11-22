// THE FLIGHT AS THE WORLD SEES IT: where she is and which way she points, second by second, from the moment she
// starts up the rail to impact. The rules decide what a flight achieves (peak, range, where she lands across the line,
// when the motor stops); this turns that into a path a real rocket could fly, so the 3D view never has to invent one.
//
// The model is a point mass with thrust, gravity, air drag and wind:
//   - on the rail she can only move along it, and points along it: an angled launcher means an angled rocket from the
//     first frame, never a rocket that stands up and then leans over;
//   - off the rail a finned rocket points into the air flowing past her (her velocity less the wind), so she
//     weathercocks into a crosswind and noses over smoothly on her way up and down;
//   - thrust pushes along where she points, plus a small fixed misalignment (the dispersion a real round has).
// The thrust and that misalignment are found by calibration so the path reaches exactly the peak, range and cross the
// rules decided. Nothing here draws from a random stream, so it never changes what the rules decide.
using System;
using System.Collections.Generic;

namespace AdAstra.Rules.Flight
{
    public sealed class LaunchSetup
    {
        public double RailTiltDeg;          // the launcher's tilt from vertical, towards downrange (+) or uprange (-)
        public double RailCrossTiltDeg;     // the launcher's tilt across the range, east (+) or west (-)
        public double RailLength = 30;      // metres of rail (the WAC tower: about 31 m)
        public double AzimuthDeg;           // which way downrange is, clockwise from north (White Sands: 0)
        public double WindEast, WindNorth;  // m/s, the wind the air moves with (blowing towards east/north)
        public double BurnTime = 47;        // seconds of thrust, or when the rules cut the motor early
        public double BallisticCoefficient = 3000; // kg/m², mass over drag area: higher means less slowed by the air
        public double Dt = 0.05;
    }

    public sealed class FlightTargets
    {
        public double ApogeeKm, RangeKm, CrossKm; // what the rules decided; cross is + east of the range line
    }

    public struct PathSample
    {
        public double T;
        public Vec3 Pos;       // metres from the launcher's foot
        public Vec3 Dir;       // unit vector: where the nose points
        public double Speed;   // m/s
        public bool OnRail, Thrusting;
    }

    public sealed class FlightPath
    {
        public readonly List<PathSample> Samples = new List<PathSample>();
        public double ApogeeKm, RangeKm, CrossKm, ImpactT, RailExitT;
        public double Thrust, PitchKickDeg, YawKickDeg; // what the calibration settled on
        public bool Calibrated;
        double dt;

        // Where she is at time t, blended between samples; past impact, she stays where she came down.
        public PathSample At(double t)
        {
            if (Samples.Count == 0) return default;
            if (t <= 0) return Samples[0];
            int i = (int)Math.Floor(t / dt);
            if (i >= Samples.Count - 1) return Samples[Samples.Count - 1];
            var a = Samples[i]; var b = Samples[i + 1];
            double k = (t - a.T) / (b.T - a.T);
            return new PathSample
            {
                T = t,
                Pos = a.Pos + (b.Pos - a.Pos) * k,
                Dir = Vec3.Slerp(a.Dir, b.Dir, k),
                Speed = a.Speed + (b.Speed - a.Speed) * k,
                OnRail = a.OnRail,
                Thrusting = a.Thrusting,
            };
        }

        const double G = 9.81;
        const double TurnLag = 0.35;     // seconds for the nose to take up most of a change in the airflow
        const double MaxTurnRate = 30;   // degrees a second, at most

        // Find the thrust and misalignment that fly the rules' result, then fly it.
        public static FlightPath Shape(LaunchSetup s, FlightTargets target)
        {
            // Thrust first, for the peak, with no misalignment; then all three together by Newton's method.
            double lo = G * 1.05, hi = G * 60, thrust = lo;
            for (int i = 0; i < 50; i++)
            {
                thrust = 0.5 * (lo + hi);
                var trial = Fly(s, thrust, 0, 0, record: false);
                if (trial.ApogeeKm < target.ApogeeKm) lo = thrust; else hi = thrust;
                if (Math.Abs(trial.ApogeeKm - target.ApogeeKm) < 1e-4 * Math.Max(1, target.ApogeeKm)) break;
            }
            double[] x = { thrust, 0, 0 };
            double[] Err(double[] p)
            {
                var f = Fly(s, p[0], p[1], p[2], record: false);
                return new[] { f.ApogeeKm - target.ApogeeKm, f.RangeKm - target.RangeKm, f.CrossKm - target.CrossKm };
            }
            bool done = false;
            var e = Err(x);
            for (int iter = 0; iter < 25 && !done; iter++)
            {
                double[] steps = { Math.Max(1e-3, x[0] * 1e-4), 0.01, 0.01 };
                var J = new double[3, 3];
                for (int j = 0; j < 3; j++)
                {
                    var xp = (double[])x.Clone(); xp[j] += steps[j];
                    var ep = Err(xp);
                    for (int r = 0; r < 3; r++) J[r, j] = (ep[r] - e[r]) / steps[j];
                }
                var d = Solve3(J, new[] { -e[0], -e[1], -e[2] });
                if (d == null) break;
                // Damped step: never more than 5 degrees of kick or 20% of thrust at once.
                double scale = 1;
                scale = Math.Min(scale, 5 / Math.Max(1e-9, Math.Abs(d[1])));
                scale = Math.Min(scale, 5 / Math.Max(1e-9, Math.Abs(d[2])));
                scale = Math.Min(scale, 0.2 * x[0] / Math.Max(1e-9, Math.Abs(d[0])));
                var xn = new[] { Math.Max(G * 1.01, x[0] + d[0] * scale), x[1] + d[1] * scale, x[2] + d[2] * scale };
                var en = Err(xn);
                if (Norm(en) < Norm(e) || scale < 1) { x = xn; e = en; }
                else break;
                done = Math.Abs(e[0]) < 0.01 * Math.Max(1, target.ApogeeKm) * 0.1
                       && Math.Abs(e[1]) < 0.02 && Math.Abs(e[2]) < 0.02;
            }
            var path = Fly(s, x[0], x[1], x[2], record: true);
            path.Calibrated = done;
            return path;
        }

        static double Norm(double[] v) => Math.Sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

        static double[] Solve3(double[,] a, double[] b)
        {
            double det = a[0, 0] * (a[1, 1] * a[2, 2] - a[1, 2] * a[2, 1])
                       - a[0, 1] * (a[1, 0] * a[2, 2] - a[1, 2] * a[2, 0])
                       + a[0, 2] * (a[1, 0] * a[2, 1] - a[1, 1] * a[2, 0]);
            if (Math.Abs(det) < 1e-15) return null;
            var r = new double[3];
            for (int c = 0; c < 3; c++)
            {
                var m = (double[,])a.Clone();
                for (int i = 0; i < 3; i++) m[i, c] = b[i];
                r[c] = (m[0, 0] * (m[1, 1] * m[2, 2] - m[1, 2] * m[2, 1])
                      - m[0, 1] * (m[1, 0] * m[2, 2] - m[1, 2] * m[2, 0])
                      + m[0, 2] * (m[1, 0] * m[2, 1] - m[1, 1] * m[2, 0])) / det;
            }
            return r;
        }

        // Air density by height (an exponential atmosphere, scale height 8.5 km).
        static double Rho(double h) => 1.225 * Math.Exp(-Math.Max(0, h) / 8500);

        // Fly once with a given thrust (m/s² while burning) and misalignment (degrees, pitch downrange / yaw across).
        public static FlightPath Fly(LaunchSetup s, double thrust, double pitchKickDeg, double yawKickDeg, bool record = true)
        {
            double az = s.AzimuthDeg * Math.PI / 180;
            var down = new Vec3(Math.Sin(az), 0, Math.Cos(az));   // horizontal, downrange
            var across = new Vec3(Math.Cos(az), 0, -Math.Sin(az)); // horizontal, to the right of downrange
            double tp = s.RailTiltDeg * Math.PI / 180, tc = s.RailCrossTiltDeg * Math.PI / 180;
            var rail = (Vec3.Up + down * Math.Tan(tp) + across * Math.Tan(tc)).Normalized;
            var wind = new Vec3(s.WindEast, 0, s.WindNorth);
            double kp = pitchKickDeg * Math.PI / 180, ky = yawKickDeg * Math.PI / 180;

            var f = new FlightPath { dt = s.Dt, Thrust = thrust, PitchKickDeg = pitchKickDeg, YawKickDeg = yawKickDeg };
            var pos = Vec3.Zero; var vel = Vec3.Zero; var dir = rail;
            double t = 0, apogee = 0, alongRail = 0;
            bool onRail = true;
            f.RailExitT = -1;
            int guard = (int)(3600 / s.Dt);
            for (int n = 0; n < guard; n++)
            {
                bool burning = t < s.BurnTime;
                if (record) f.Samples.Add(new PathSample { T = t, Pos = pos, Dir = dir, Speed = vel.Length, OnRail = onRail, Thrusting = burning });

                if (onRail)
                {
                    // Along the rail only: thrust, less the part of gravity along the rail. She cannot slide back down.
                    double a = (burning ? thrust : 0) - G * Vec3.Dot(Vec3.Up, rail);
                    double speed = Math.Max(0, Vec3.Dot(vel, rail) + a * s.Dt);
                    alongRail += speed * s.Dt;
                    vel = rail * speed;
                    pos = rail * alongRail;
                    dir = rail;
                    if (alongRail >= s.RailLength) { onRail = false; f.RailExitT = t + s.Dt; }
                    if (!burning && speed <= 0) { f.ImpactT = t; break; } // never left the rail
                }
                else
                {
                    // She turns to point into the air flowing past her, but not instantly: a rocket has weight to swing,
                    // so the nose follows with a short lag and a capped turn rate, never a snap.
                    var air = vel - wind;
                    if (air.Length > 1)
                    {
                        var want = air.Normalized;
                        double angle = Vec3.AngleDeg(dir, want);
                        if (angle > 1e-6)
                        {
                            double turn = Math.Min(angle * Math.Min(1, s.Dt / TurnLag), MaxTurnRate * s.Dt);
                            dir = Vec3.Slerp(dir, want, turn / angle);
                        }
                    }
                    // Misalignment: a fixed small turn of the thrust, in the downrange and across directions.
                    var thrustDir = (dir + down * Math.Tan(kp) + across * Math.Tan(ky)).Normalized;
                    var acc = new Vec3(0, -G, 0);
                    if (burning) acc += thrustDir * thrust;
                    double rho = Rho(pos.Y);
                    acc += air * (-0.5 * rho * air.Length / s.BallisticCoefficient);
                    // Semi-implicit Euler is plenty at 20 steps a second.
                    vel += acc * s.Dt;
                    pos += vel * s.Dt;
                }
                t += s.Dt;
                if (pos.Y > apogee) apogee = pos.Y;
                if (!onRail && pos.Y <= 0 && vel.Y < 0)
                {
                    pos = new Vec3(pos.X, 0, pos.Z);
                    f.ImpactT = t;
                    if (record) f.Samples.Add(new PathSample { T = t, Pos = pos, Dir = dir, Speed = vel.Length, OnRail = false, Thrusting = false });
                    break;
                }
            }
            f.ApogeeKm = apogee / 1000;
            f.RangeKm = Vec3.Dot(pos, down) / 1000;
            f.CrossKm = Vec3.Dot(pos, across) / 1000;
            return f;
        }
    }
}
