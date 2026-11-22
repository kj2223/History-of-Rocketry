// A plain 3D vector in doubles, so the rules never need UnityEngine. The world's axes are Unity's: x east, y up,
// z north. Downrange at White Sands is north.
using System;

namespace AdAstra.Rules.Flight
{
    public readonly struct Vec3
    {
        public readonly double X, Y, Z;
        public Vec3(double x, double y, double z) { X = x; Y = y; Z = z; }
        public static readonly Vec3 Zero = new Vec3(0, 0, 0), Up = new Vec3(0, 1, 0);
        public static Vec3 operator +(Vec3 a, Vec3 b) => new Vec3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
        public static Vec3 operator -(Vec3 a, Vec3 b) => new Vec3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
        public static Vec3 operator *(Vec3 a, double k) => new Vec3(a.X * k, a.Y * k, a.Z * k);
        public static Vec3 operator *(double k, Vec3 a) => a * k;
        public static double Dot(Vec3 a, Vec3 b) => a.X * b.X + a.Y * b.Y + a.Z * b.Z;
        public double Length => Math.Sqrt(X * X + Y * Y + Z * Z);
        public Vec3 Normalized { get { var l = Length; return l > 1e-12 ? this * (1 / l) : Up; } }
        // The angle between two directions, in degrees.
        public static double AngleDeg(Vec3 a, Vec3 b) =>
            Math.Acos(Math.Max(-1, Math.Min(1, Dot(a.Normalized, b.Normalized)))) * 180 / Math.PI;
        // Spherical blend of two unit directions.
        public static Vec3 Slerp(Vec3 a, Vec3 b, double k)
        {
            double cos = Math.Max(-1, Math.Min(1, Dot(a, b)));
            double th = Math.Acos(cos);
            if (th < 1e-6) return (a + (b - a) * k).Normalized;
            double s = Math.Sin(th);
            return (a * (Math.Sin((1 - k) * th) / s) + b * (Math.Sin(k * th) / s)).Normalized;
        }
        public override string ToString() => $"({X:0.###}, {Y:0.###}, {Z:0.###})";
    }
}
