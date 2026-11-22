// The test bot. Off unless the game is started with "-autoshot <folder>": then it plays the whole season itself (look at
// every spot, fire on the stand, answer the count from the gauge, fly, call the cause), saves a screenshot at each beat
// and writes bot-log.txt, and quits. Used to check a build without a person at the keyboard; the mouse camera is off
// while it runs.
using System;
using System.Collections;
using System.IO;
using System.Linq;
using AdAstra.Truth;
using UnityEngine;

namespace AdAstra
{
    public sealed partial class Game
    {
        string botDir;
        int shotNo;
        StreamWriter botLog;
        bool BotRunning => botDir != null;

        void BotAwake()
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, "-autoshot");
            if (i < 0 || i + 1 >= args.Length) return;
            botDir = args[i + 1];
            Directory.CreateDirectory(botDir);
            botLog = new StreamWriter(Path.Combine(botDir, "bot-log.txt")) { AutoFlush = true };
            BotSay($"Screen {Screen.width}x{Screen.height}");
            Application.logMessageReceived += (msg, stack, type) =>
            {
                if (type == LogType.Error || type == LogType.Exception) BotSay($"[{type}] {msg}\n{stack}");
            };
            StartCoroutine(BotPlay());
        }

        void BotSay(string s) => botLog?.WriteLine($"{Time.realtimeSinceStartup,7:0.0}  {s}");

        IEnumerator Shot(string name, float wait = 1.6f)
        {
            yield return new WaitForSeconds(wait);
            yield return new WaitForEndOfFrame();
            string f = Path.Combine(botDir, $"{++shotNo:00}-{name}.png");
            ScreenCapture.CaptureScreenshot(f);
            BotSay($"shot {f} (beat {beat})");
            yield return null;
        }

        IEnumerator BotPlay()
        {
            yield return Shot("title", 3);
            NewSeason(1945);
            for (int r = 0; r < Campaign.Season.Length; r++)
            {
                bool full = r == 0;   // screenshots of every beat in the first round, the key beats after
                BotSay($"Round {r + 1}: {def.Name}");
                if (full) yield return Shot("arrive");
                SetBeat(Beat.Brief);
                if (full) yield return Shot("brief");
                FinishPlan(r == 1 ? "kowalski" : "you", 1);
                if (beat == Beat.Hangar)
                {
                    if (full) yield return Shot("hangar");
                    foreach (var s in Wac.Spots)
                    {
                        LookAt(s.Id);
                        if (round.Cues[s.Id]) { MeterSpot(s.Id); if (metered.TryGetValue(s.Id, out var rd) && rd.Out) ToggleFlag(s.Id); }
                    }
                    if (full) yield return Shot("hangar-looked", 0.6f);
                    FinishInspection();
                }
                else { if (full) yield return Shot("crew-inspect"); ToStand(); }
                if (full) yield return Shot("stand");
                Fire();
                yield return new WaitForSeconds(3);
                if (full) yield return Shot("stand-firing", 0);
                yield return new WaitForSeconds(6);
                bool lowPc = trace.Any(p => p.T >= 0.7f && p.T <= 6.8f && (p.Pc < Wac.PcLo || p.Pc > Wac.PcHi));
                if (lowPc) { BotSay("Pc out of the red lines: rework"); ReworkIgniter(); }
                if (full) yield return Shot("stand-traces", 0.2f);
                RollOut();
                yield return Shot($"r{r + 1}-morning");
                for (int attempt = 0; attempt < 4 && beat == Beat.Morning; attempt++)
                {
                StartCount();
                if (full && attempt == 0) yield return Shot("blockhouse");
                speed = 16;
                float guard = 0;
                while (beat == Beat.Count && guard < 240)
                {
                    guard += Time.deltaTime;
                    var c = count;
                    if (c == null) break;
                    if (c.Poll != null)
                    {
                        if (full && c.Poll == "final") { speed = 1; yield return Shot("count-poll", 0.4f); speed = 16; }
                        Answer(TankNow >= Wac.TankLo);
                    }
                    else if (c.Held && c.Busy <= 0 && decay == null) Resume();
                    else if (c.AwaitFire) { speed = 1; FireRound(); }
                    yield return null;
                }
                speed = 1;
                BotSay($"Count over: beat {beat}");
                }
                if (beat == Beat.Flight)
                {
                    yield return Shot($"r{r + 1}-liftoff", 1.2f);
                    BotSay($"Liftoff: tower {Vector3.SignedAngle(Vector3.up, site.Tower.up, Vector3.back):0.0}° east, rocket {Vector3.SignedAngle(Vector3.up, site.Rocket.up, Vector3.back):0.0}° east at t={flightT:0.0}s; rail exit {path.RailExitT:0.00}s, path calibrated {path.Calibrated}");
                    if (full) yield return Shot("climb", 2.5f);
                    while (beat == Beat.Flight) yield return null;
                }
                if (beat == Beat.Review)
                {
                    BotSay($"Flight: failure {flight.Failure ?? "none"}, range {flight.Range:0.0} km, landing {flight.Landing}");
                    if (full) yield return Shot("review");
                    MakeCall(flight.Failure ?? "nominal");
                    yield return Shot($"r{r + 1}-review-called", 0.8f);
                    CloseRound();
                }
                if (full) yield return Shot("round-end");
                if (beat != Beat.RoundEnd) { BotSay($"Unexpected beat {beat} at the end of the round"); break; }
                NextRound();
            }
            yield return Shot("season-end");
            BotSay("Done.");
            botLog.Close();
            Application.Quit();
        }
    }
}
