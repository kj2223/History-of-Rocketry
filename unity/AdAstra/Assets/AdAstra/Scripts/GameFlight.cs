// The flight, as the 3D world shows it: off the tower on the track the truth worked out, a tracking camera that follows
// her up, smoke, and what a failure looks like (no light, a flash and pieces, a flame that goes out early).
// Presentation only: the flight's result was decided in Round.Fly before she left the tower.
using System.Collections.Generic;
using AdAstra.Rules.Flight;
using AdAstra.Truth;
using AdAstra.World;
using UnityEngine;

namespace AdAstra
{
    public sealed partial class Game
    {
        class Fx { public Transform T; public Vector3 V; public float Age, Life, Size; public bool Debris; }
        readonly List<Fx> fx = new List<Fx>();
        int nextCall;
        List<Call> calls;
        bool broke, landed;
        float flashT = -1;
        Transform flash;
        float endWait;

        FlightPath path;
        Vector3 launchBase;

        // lay: the tower's tilt east of vertical (degrees), the same number the tower is drawn at; crossKmh: the
        // crosswind at liftoff, + toward the east.
        void StartFlight(double lay, double crossKmh)
        {
            SetBeat(Beat.Flight);
            flightT = 0; nextCall = 0; broke = false; landed = false; endWait = 0; trailFrom = null; exhaustDebt = groundDebt = 0;
            calls = Wac.CallsFor(flight.Failure, flight.Burn);
            var r = site.Rocket;
            r.SetParent(null, true);
            launchBase = r.position;
            path = FlightPath.Shape(new LaunchSetup
            {
                RailTiltDeg = 0, // the tower is only laid across the range, never downrange
                RailCrossTiltDeg = lay,
                RailLength = Site.TowerHeight - 0.6, // she sits 0.6 m up the tower (Site.ResetRocket)
                AzimuthDeg = 0,
                WindEast = crossKmh / 3.6,
                WindNorth = 0,
                BurnTime = flight.Failure == "ignition" ? 0.8 : flight.Burn,
            }, new FlightTargets { ApogeeKm = flight.Apogee, RangeKm = flight.Range, CrossKm = flight.Cross });
            site.RocketFlame.gameObject.SetActive(true);
            site.RocketLight.intensity = 6;
            Say("vega", Wac.Lift, "go");
            sound.Ignite();
            view.Follow(r.position + Vector3.up * 8, new Vector3(30, 5, -62), 34);
        }

        static Vector3 V(Vec3 v) => new Vector3((float)v.X, (float)v.Y, (float)v.Z);

        void TickFlight(float dt)
        {
            float rate = flightT < 18 ? 1 : 6;
            flightT += dt * rate * Mathf.Max(1, speed);
            var end = (float)path.ImpactT;
            var r = site.Rocket;
            var s = path.At(flightT);
            var p = launchBase + V(s.Pos);
            if (!broke)
            {
                // No smoothing: on the rail she points along the rail, so she leaves the tower at its angle.
                r.position = p;
                r.rotation = Quaternion.FromToRotation(Vector3.up, V(s.Dir));
            }
            bool thrust = flight.Failure == "ignition" ? flightT < 0.8f : flightT < flight.Burn;
            site.RocketFlame.gameObject.SetActive(thrust && !broke);
            site.RocketLight.intensity = thrust && !broke ? 6 : 0;
            var camPos = new Vector3(30, 5, -62);
            sound.Motor(thrust && !broke, (p - camPos).magnitude);
            if (thrust && !broke) Exhaust(p, r, dt);
            // Calls on the net
            while (calls != null && nextCall < calls.Count && calls[nextCall].T <= flightT)
            {
                var c = calls[nextCall++];
                Say(c.Text.StartsWith("A flash") || c.Text.StartsWith("No sustainer") ? "vega" : "morgan", c.Text, c.Tone);
            }
            if (flight.Failure == "weld" && !broke && flightT >= flight.FailAt) Break(p);
            // The tracking camera: from beside the tower, narrowing as she climbs; then the range's long view.
            float dist = (p - camPos).magnitude;
            if (p.y < 6000)
            {
                float fov = Mathf.Clamp(2 * Mathf.Atan2(28f + p.y * 0.02f, dist) * Mathf.Rad2Deg, 2.5f, 40);
                view.Follow(p, camPos, fov);
            }
            else view.Follow(new Vector3(0, 900, 1800), new Vector3(-60, 6, -120), 52);
            if (!landed && flightT >= end)
            {
                landed = true;
                string side = Round.SideText(flight.Cross, " km");
                string where = flight.Landing == "line" ? "inside the cleared strip" : flight.Landing == "wide" ? "outside the cleared strip" : "off the range";
                sound.Thud();
                Say("morgan", $"Impact {flight.Range:0.0} km downrange, {side} of the line: {where}.", flight.Landing == "line" ? "" : "warn", 8);
                if (flight.Failure == null) Say("morgan", $"Radar has her peak at {flight.Radar:0.0} km.", "go", 8);
            }
            if (landed) { endWait += dt; if (endWait > 3.5f) { site.Rocket.gameObject.SetActive(false); SetBeat(Beat.Review); } }
        }

        void Break(Vector3 at)
        {
            broke = true;
            site.Rocket.gameObject.SetActive(false);
            flashT = 0;
            if (!flash)
            {
                flash = Geo.Ball(null, site.Flash, at, Vector3.one).transform;
                flash.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            flash.position = at; flash.gameObject.SetActive(true);
            for (int i = 0; i < 9; i++)
            {
                var d = Geo.Box(null, site.Debris, at, Vector3.one * Random.Range(0.4f, 1.4f)).transform;
                fx.Add(new Fx { T = d, V = Random.insideUnitSphere * 40 + Vector3.up * 20, Life = 30, Debris = true });
            }
            for (int i = 0; i < 70; i++) plumes.Fire(at + Random.insideUnitSphere * 3, Random.insideUnitSphere * 28, 7, 1.1f);
            for (int i = 0; i < 26; i++) plumes.Smoke(at + Random.insideUnitSphere * 5, Random.insideUnitSphere * 14, 7, 16, Plumes.Wreck);
            for (int i = 0; i < 30; i++) plumes.Smoke(at + Random.insideUnitSphere * 4, Random.insideUnitSphere * 9, 6, 14, Plumes.Acid);
            sound.StopAll();
            sound.Boom((at - view.Cam.transform.position).magnitude);
        }

        float exhaustDebt, groundDebt;
        Vector3? trailFrom;
        // The exhaust: fire at the nozzle, then the trail. In the first seconds the booster's white cloud boils out
        // across the pad; after that the sustainer leaves its thin rust-brown acid trail.
        void Exhaust(Vector3 p, Transform r, float dt)
        {
            var noz = p - r.up * 1.2f;
            var down = -r.up;
            var wind = new Vector3((float)(count?.Balloon ?? lastBalloon) / 3.6f * 0.4f, 0, 0);
            float near = Mathf.Clamp01(1 - p.y / 3000f);
            for (int i = 0; i < 3; i++) plumes.Fire(noz + down * Random.Range(0, 2.5f), down * Random.Range(25, 45) + Random.insideUnitSphere * 3, 1.6f + p.y / 900f, 0.22f);
            if (p.y > 6000) { trailFrom = null; return; }
            bool booster = flightT < 1.2f;
            float size = (booster ? 3.2f : 2.2f) + p.y / 500f;
            // Lay the trail along the whole stretch she covered this frame, a puff every half a puff's width, so the
            // trail stays a trail even when the clock runs fast.
            var from = trailFrom ?? p;
            float seg = (p - from).magnitude;
            exhaustDebt += booster ? dt * 90 : Mathf.Min(45, seg / (size * 0.5f) + dt * 20 * near);
            int made = 0;
            while (exhaustDebt >= 1 && made < 45)
            {
                exhaustDebt -= 1; made++;
                var at = Vector3.Lerp(from, p, Random.value) + down * 3 + Random.insideUnitSphere * 0.8f;
                plumes.Smoke(at, wind + down * Random.Range(2, 6) + Random.insideUnitSphere * 1.2f, size, booster ? 14 : 18, booster ? Plumes.Booster : Plumes.Acid);
            }
            exhaustDebt = Mathf.Min(exhaustDebt, 1);
            trailFrom = p;
            // The ground cloud: the blast hits the pad and rolls out across the desert.
            if (p.y < 60)
            {
                groundDebt += dt * 70 * (1 - p.y / 60f);
                while (groundDebt >= 1)
                {
                    groundDebt -= 1;
                    var dir = Random.insideUnitCircle.normalized;
                    var v = new Vector3(dir.x, 0, dir.y) * Random.Range(6, 16) + Vector3.up * Random.Range(0.5f, 2.5f);
                    plumes.Smoke(Site.TowerAt + new Vector3(dir.x, 0.8f, dir.y) * 2, v + wind, Random.Range(3.5f, 5.5f), Random.Range(12, 18), flightT < 1.2f ? Plumes.Booster : Plumes.Dust);
                }
            }
        }

        public void Puff(Vector3 at, Vector3 vel, float size, float life) => plumes.Smoke(at, vel, size, life, Plumes.Acid);

        void TickFx(float dt)
        {
            for (int i = fx.Count - 1; i >= 0; i--)
            {
                var f = fx[i];
                f.Age += dt;
                if (f.Debris)
                {
                    f.V += Vector3.down * 9.8f * dt;
                    f.T.position += f.V * dt;
                    f.T.Rotate(f.V * dt * 3);
                }
                else
                {
                    f.T.position += f.V * dt;
                    f.V *= 1 - dt * 0.4f;
                    float g = 1 + 2.5f * Mathf.Sqrt(f.Age / f.Life);
                    f.T.localScale = Vector3.one * f.Size * g;
                    if (f.T.position.y < f.Size * g * 0.4f) f.T.position = new Vector3(f.T.position.x, f.Size * g * 0.4f, f.T.position.z);
                }
                if (f.Age >= f.Life || (f.Debris && f.T.position.y < 0))
                {
                    Destroy(f.T.gameObject);
                    fx.RemoveAt(i);
                }
            }
            // The flash ramps in and out, never a strobe (DESIGN.md: no flicker).
            if (flashT >= 0 && flash)
            {
                flashT += dt;
                float k = flashT < 0.25f ? flashT / 0.25f : Mathf.Max(0, 1 - (flashT - 0.25f) / 1.2f);
                flash.localScale = Vector3.one * (8 + 30 * flashT);
                site.Flash.color = new Color(1f, 0.85f, 0.6f, k * 0.8f);
                if (k <= 0 && flashT > 0.3f) { flash.gameObject.SetActive(false); flashT = -1; }
            }
        }

        public void ClearFx()
        {
            foreach (var f in fx) if (f.T) Destroy(f.T.gameObject);
            fx.Clear();
            plumes.Clear();
            sound.StopAll();
            exhaustDebt = groundDebt = 0; trailFrom = null;
        }
    }
}
