#!/usr/bin/env node
// THE AUTOMATED PLAYTEST: plays Ad Astra in the real desktop app, unattended, and writes a report of what went wrong.
//
//   npm run autoplay                      the whole thing: Flight Director 1945 to the end, Management, Desk mode
//   npm run autoplay -- --quick           a short run: the first rounds, a year of Management, the Desk count
//   npm run autoplay -- --modes desk      only some modes (flight, management, desk, comma-separated)
//   npm run autoplay -- --to ma-6        the Flight Director's game up to and including this round
//   npm run autoplay -- --approve         keep this run's screenshots as the approved look for the next runs
//   npm run autoplay -- --file-issues     file each bug it finds as a GitHub issue (needs the gh command, signed in)
//   other options: --seed 1945  --look 1200 (milliseconds watched at each stop)  --headless (no window on screen)
//
// It runs the game from this folder (as npm start does) in its own Electron window, with its own saves in a temporary
// folder, so your games and playtest log are never touched. What it checks, at every stop where a player would act:
//  - bugs: errors in the console, crashes, a game that gets stuck, saves that do not come back after a restart;
//  - waiting: how long a player sits with nothing to do at the fastest speed, and how fast each scene draws;
//  - looks: blank screens, text cut off or off the window, pictures that fail, and changes from the approved screenshots;
//  - sound: silence, clipping, sounds that pile up and never stop, and sound carried over to the title screen.
// The report is playtest-runs/<date and time>/report.html, with report.json beside it for Claude to read.
// Whether a sound or a picture is *right* still needs a person: this finds what is broken, slow or changed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { judgeLook, judgeWaits, judgeMemory, dedupe, isNoise, finding, issueLink, LIMITS } from './checks.mjs';
import { writeReport } from './report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'package.json'));

// ---- Options ----
const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const quick = flag('quick');
const opts = {
  modes: option('modes', 'flight,management,desk').split(','),
  to: option('to', quick ? 'v2-1' : null),
  seed: Number(option('seed', 1945)),
  lookMs: Number(option('look', quick ? 800 : 1200)),
  manageYears: Number(option('years', quick ? 1 : 4)),
  approve: flag('approve'),
  fileIssues: flag('file-issues'),
  headless: flag('headless'),
  saveEvery: Number(option('save-every', 8)),
};

// ---- Where things go ----
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const runDir = path.join(ROOT, 'playtest-runs', stamp);
const shotDir = path.join(runDir, 'shots');
const baseDir = path.join(ROOT, 'playtest-baselines');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-astra-autoplay-'));
fs.mkdirSync(shotDir, { recursive: true });

const log = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- What the run collects ----
const run = {
  id: stamp,
  options: opts,
  build: '',
  started: new Date().toISOString(),
  timings: {},
  looks: [], // every stop: where, frames, sound, the screenshot's look and file, layout problems
  steps: [], // every Flight Director step and how long it waited
  manageWeeks: [],
  desk: [],
  findings: [],
  consoleErrors: [],
};
let where = { mode: 'starting' },
  stepName = '';
const note = f => run.findings.push({ step: stepName, ...f });

// ---- Start the app ----
let playwright;
try {
  playwright = require('playwright-core');
} catch {
  console.error('The playtest needs playwright-core: run npm install first.');
  process.exit(1);
}
const electronPath = require('electron');
const args = [ROOT, `--user-data-dir=${userData}`];
if (process.platform === 'linux' && process.getuid?.() === 0) args.push('--no-sandbox');
if (opts.headless) args.push('--headless=new');

let app, page;
async function launch() {
  const t0 = Date.now();
  app = await playwright._electron.launch({ executablePath: electronPath, args, cwd: ROOT, timeout: 60000 });
  page = await app.firstWindow();
  page.setDefaultTimeout(60000);
  page.on('console', m => {
    const text = m.text();
    if (m.type() !== 'error' || isNoise(text)) return;
    run.consoleErrors.push({ text, where, step: stepName });
    note(finding('console-error', 'bug', where, `Console error: ${text.slice(0, 300)}`, { stack: text }));
  });
  page.on('pageerror', e => {
    note(finding('page-error', 'bug', where, `Uncaught error: ${e.message}`, { stack: e.stack }));
  });
  page.on('crash', () => note(finding('crash', 'bug', where, 'The game window crashed.')));
  app.process().on('exit', code => {
    if (!closing) note(finding('app-exit', 'bug', where, `The app quit by itself (exit code ${code}).`));
  });
  // The ears and stopwatch go in before the game's scripts, so load the page again with them in place.
  await app.context().addInitScript({ path: path.join(ROOT, 'tools', 'autoplay', 'tap.js') });
  await page.waitForFunction(() => window.__site?.g, null, { timeout: 60000 });
  run.timings.launchMs ??= Date.now() - t0;
  await page.reload();
  await page.waitForFunction(() => window.__site?.g && globalThis.__autoplayTap, null, { timeout: 60000 });
  await page.evaluate(() => import('/tools/autoplay/driver.js'));
  return Date.now() - t0;
}
let closing = false;

const ap = (fn, ...a) => page.evaluate(([fn, a]) => globalThis.__autoplay[fn](...a), [fn, a]);

// ---- Looking: hold the game still, watch and listen, take the screenshot, read the layout ----
let shots = 0;
async function look(name, { quietScene = false, hold = true, liftoff = false, ms = opts.lookMs } = {}) {
  if (hold) await ap('hold');
  await ap('beginWindow');
  await sleep(ms);
  const watched = await ap('endWindow');
  const file = `${String(++shots).padStart(4, '0')}-${slug(name)}.png`;
  const png = await page.screenshot({ path: path.join(shotDir, file) });
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  const image = await page.evaluate(u => globalThis.__autoplay.imageStats(u), dataUrl);
  const layout = await ap('layoutProblems');
  const key = baselineKey(name, watched.where);
  const l = { name, key, file, ...watched, image, layout };
  // Compared with the approved screenshot of the same stop, if there is one.
  const approved = path.join(baseDir, `${key}.png`);
  if (fs.existsSync(approved)) {
    const was = `data:image/png;base64,${fs.readFileSync(approved).toString('base64')}`;
    const cmp = await page.evaluate(([a, b]) => globalThis.__autoplay.compareImages(a, b), [was, dataUrl]);
    l.changed = cmp.changed;
    if (cmp.changed > LIMITS.changed) {
      const diff = file.replace('.png', '-diff.png');
      fs.writeFileSync(path.join(shotDir, diff), Buffer.from(cmp.diff.split(',')[1], 'base64'));
      fs.copyFileSync(approved, path.join(shotDir, file.replace('.png', '-approved.png')));
      l.diff = diff;
      note(
        finding(
          'looks-changed',
          'info',
          watched.where,
          `${Math.round(cmp.changed * 100)}% of the screen differs from the approved look at ${key}.`,
          {
            shot: file,
          },
        ),
      );
    }
  } else l.newLook = true;
  for (const f of judgeLook(l, { quietScene, liftoff })) note({ ...f, shot: file });
  run.looks.push(l);
  if (hold) await ap('release');
  return l;
}
const slug = s =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const baselineKey = (name, w) =>
  slug(
    w.mode === 'flight'
      ? `flight-${w.round}-${name}`
      : w.mode === 'management'
        ? `manage-${name}`
        : w.mode === 'desk'
          ? `desk-${name}`
          : name,
  );

// A bug's moment is marked with the game's own F8, so its screenshot and save go to the playtest folder as a player's
// would, for reading back with tools/playtest-report.mjs.
async function markInGame() {
  try {
    await page.keyboard.press('F8');
    await sleep(400);
  } catch {
    /* the window may be gone */
  }
}

// ---- The title screen ----
async function toTitleFromFlight() {
  await page.click('#game');
  await page.click('[data-act=game-title]');
  await page.waitForSelector('#title:not([hidden])');
}
async function titleNew(mode, { whatIf = false } = {}) {
  const t0 = Date.now();
  if (whatIf) await page.check(`[data-mode=${mode}] [data-whatif]`);
  await page.click(`[data-mode=${mode}] [data-act=new]`);
  const confirm = await page.$(`[data-act=new-go][data-mode=${mode}]`);
  if (confirm) await confirm.click();
  await page.waitForSelector('#title', { state: 'hidden' });
  return Date.now() - t0;
}

// ---- Restart: save, close the window's page, load it again, and check the game comes back where it was ----
async function restartCheck(mode, expected, actual) {
  const t0 = Date.now();
  await page.reload();
  await page.waitForFunction(() => window.__site?.g, null, { timeout: 60000 });
  await page.evaluate(() => import('/tools/autoplay/driver.js'));
  await page.waitForSelector('#title:not([hidden])');
  const card = await page.textContent(`[data-mode=${mode}]`);
  if (!/Your game:/.test(card)) {
    note(finding('save-lost', 'bug', where, `After a restart the title screen shows no saved ${mode} game.`));
    return false;
  }
  await page.click(`[data-mode=${mode}] [data-act=continue]`);
  await page.waitForSelector('#title', { state: 'hidden' });
  run.timings[`continue-${mode}-ms`] = Date.now() - t0;
  const got = await actual();
  const problems = Object.entries(expected).filter(([k, v]) => !sameish(v, got[k]));
  if (problems.length)
    note(
      finding(
        'save-mismatch',
        'bug',
        where,
        `After a restart the ${mode} game came back different: ${problems.map(([k, v]) => `${k} was ${JSON.stringify(v)}, now ${JSON.stringify(got[k])}`).join('; ')}.`,
      ),
    );
  else log(`  restart check (${mode}) passed`);
  return true;
}
// Numbers may drift by what the game plays between the restart and the check: a day of Management, half a minute of the
// Desk count (it runs on as soon as it is back).
const sameish = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 30 : a === b);

// ---- The Flight Director's game ----
const KEY_STEPS = /liftoff|round-start|static-fire|count|console-|flight|recovery|review|scene|probe|lunar|season-end/;
async function playFlight() {
  log('Flight Director: a new game');
  where = { mode: 'flight' };
  run.timings.newFlightMs = await titleNew('flight');
  await ap('reseed', opts.seed);
  await look('first-morning');
  await ap('startCampaign', opts.to);
  let rounds = 0,
    stuck = 0;
  for (let n = 0; n < 5000; n++) {
    const s = await ap('step');
    where = s.where ?? where;
    if (s.error) {
      stepName = 'stuck';
      log(`  STUCK at ${where.round} ${where.beat}: ${s.error.split('\n')[0]}`);
      const l = await look('stuck', { hold: false });
      note(
        finding('stuck', 'bug', where, `The game got stuck: ${s.error.split('\n')[0]}`, {
          stack: s.error,
          shot: l.file,
        }),
      );
      await markInGame();
      // Carry on from the next round, as the dev menu's jump would, so one stuck round does not end the run.
      if (++stuck > 3) break;
      const next = await page.evaluate(async seed => {
        const { SEASON } = await import('/js/data/campaign.js');
        const { skipWithRetries } = await import('/js/dev/skip.js');
        const { g } = await import('/js/game.js');
        const i = SEASON.findIndex((r, k) => k > g.roundIndex && (r.path ?? 'nasa') !== 'jpl');
        if (i < 0) return null;
        skipWithRetries(SEASON[i].id, { seed });
        return SEASON[i].id;
      }, opts.seed);
      if (!next) break;
      log(`  jumped on to ${next}`);
      await ap('startCampaign', opts.to);
      continue;
    }
    stepName = s.name;
    run.steps.push({ name: s.name, after: run.steps.at(-1)?.name, wait: s.wait, beats: s.beats, where: s.where });
    if (s.done) break;
    if (s.name === 'round-start') {
      rounds++;
      log(`  ${s.where.round} (${s.where.day ? `day ${s.where.day}` : ''})`);
      if (opts.saveEvery && rounds % opts.saveEvery === 0) {
        await look('round-start'); // lets the game save its morning
        const saved = await ap('savedFlight');
        if (saved)
          await restartCheck('flight', { round: saved.round, day: saved.day }, async () => {
            const w = await ap('whereNow');
            return { round: w.round, day: w.day };
          });
        await ap('startCampaign', opts.to);
        continue;
      }
    }
    if (!quick || KEY_STEPS.test(s.name)) {
      // The bot answers from wherever it stands; a player goes to the room their call is waiting in, so look from there.
      const call = await page.$('#waiting.call:not([hidden])');
      if (call) await call.click().catch(() => {});
      if (s.name === 'liftoff') {
        // Live: the game runs at normal speed while the runner watches and listens to the first seconds of the flight.
        await ap('live');
        await look('liftoff', { hold: false, liftoff: true, ms: Math.max(4000, opts.lookMs) });
      } else await look(s.name);
    }
  }
  // The hands-on controls (HANDS-ON-GAMEPLAY.md): the firing panel, the grease pencil and the test kit were worked.
  run.handsOn = await page.evaluate(() => ({ ...globalThis.__autoplay.handsOn }));
  if (!run.handsOn.switches)
    note(finding('hands-on-unused', 'warn', where, 'No round offered the firing panel’s switches to throw.'));
  log('Flight Director: back to the title screen');
  stepName = 'to-title';
  await toTitleFromFlight();
  const t = await look('title-after-flight', { hold: false });
  const before = run.looks.find(l => l.name === 'title');
  if (
    t.audio?.rmsDb != null &&
    before?.audio?.rmsDb != null &&
    t.audio.rmsDb - before.audio.rmsDb > LIMITS.carriedOverDb
  )
    note(
      finding(
        'sound-carried-over',
        'bug',
        t.where,
        `The title screen is ${Math.round(t.audio.rmsDb - before.audio.rmsDb)} dB louder after a game than at the start: a game's sound kept playing.`,
      ),
    );
}

// ---- Management ----
async function playManagement() {
  log('Management: a new game');
  where = { mode: 'management' };
  stepName = 'new';
  run.timings.newManagementMs = await titleNew('management');
  await page.waitForFunction(() => globalThis.__manage?.state);
  await look('base');
  const m = () => page.evaluate(() => globalThis.__manage.state);
  const bar = () =>
    page.evaluate(() => [...document.querySelectorAll('.mg-bar button')].map(b => b.textContent.trim()).join(' | '));
  const weeks = Math.round(opts.manageYears * 52);
  let quietDays = 0,
    lastFlown = 0,
    lastBar = await bar();
  for (let w = 1; w <= weeks; w++) {
    stepName = `week-${w}`;
    // A week, a day at a time, stopping to watch any day a rocket flies.
    for (let d = 0; d < 7; d++) {
      await page.evaluate(() => globalThis.__manage.jump(1));
      // A pad emergency: send all three crews at once, as a director should, and watch it to the end.
      if ((await m()).emergency) {
        stepName = `emergency-${w}`;
        await page.evaluate(() => ['safety', 'pad', 'fire'].forEach(c => globalThis.__manage.order(c, 'pad')));
        await look('emergency', { hold: false });
        await page.evaluate(() => globalThis.__manage.runEmergency(120));
        const done = (await m()).emergencies.at(-1);
        run.emergencies = [...(run.emergencies ?? []), done];
        if ((await m()).emergency)
          note(finding('emergency-stuck', 'bug', where, 'A pad emergency was still running after 120 minutes.'));
        stepName = `week-${w}`;
      }
      const s = await m();
      where = { mode: 'management', day: s.day, where: s.where };
      quietDays++;
      // Launch day: watch the rocket go up from its pad at noon, as the base view shows it.
      if (/^Today:/.test((await page.textContent('#manage .mg-next').catch(() => '')) ?? '')) {
        await page.evaluate(() => (globalThis.__manage.part = 0.62));
        await look('launch-day', { hold: false });
      }
      if (s.flown.length > lastFlown) {
        lastFlown = s.flown.length;
        run.manageWeeks.push({ week: w, day: s.day, quietDays, flown: s.flown.at(-1)?.id });
        if (quietDays * (10 / 16) > LIMITS.longWait)
          note(
            finding(
              'long-wait',
              'warn',
              where,
              `${quietDays} days (${Math.round(quietDays * (10 / 16))} s at the fastest speed) with no flight before ${s.flown.at(-1)?.id}.`,
              { value: quietDays * (10 / 16) },
            ),
          );
        quietDays = 0;
        await look(`report-${s.flown.at(-1)?.id ?? lastFlown}`, { hold: false });
      }
    }
    const b = await bar();
    if (b !== lastBar) quietDays = Math.min(quietDays, 0);
    lastBar = b;
    // Each quarter: open every panel, read it, and make the decisions waiting in it.
    if (w % 13 === 1) {
      for (const panel of ['programmes', 'build', 'budget', 'people', 'reports']) {
        stepName = `panel-${panel}`;
        await page.click(`.mg-bar [data-act=${panel}]`);
        await sleep(150);
        if (panel === 'people') {
          const appoint = await page.$('[data-act=appoint]');
          if (appoint) await appoint.click();
        }
        if (panel === 'build' && w > 1) {
          const build = await page.$('[data-act=build-on]');
          if (build) await build.click();
        }
        await look(`panel-${panel}`, { hold: false });
        const open = await page.$(`.mg-bar [data-act=${panel}].on`);
        if (open) await open.click();
      }
    }
    if (w === Math.round(weeks / 2)) {
      stepName = 'restart';
      await page.click('.mg-bar [data-act=pause]');
      await sleep(300);
      const day = await page.evaluate(() => JSON.parse(localStorage.getItem('aa-manage'))?.checkpoint?.day);
      await restartCheck('management', { day }, async () => {
        await page.waitForFunction(() => globalThis.__manage?.state);
        return { day: (await m()).day };
      });
    }
    if (w % 4 === 0) await look(`week-${w}`, { hold: false });
  }
  stepName = 'to-title';
  await page.click('.mg-bar [data-act=title]');
  await page.waitForSelector('#title:not([hidden])');
}

// ---- Desk mode ----
async function playDesk({ whatIf = false } = {}) {
  const name = whatIf ? 'desk-what-if' : 'desk';
  log(`Desk mode${whatIf ? ' (what if)' : ''}: a new count`);
  where = { mode: 'desk' };
  stepName = 'new';
  run.timings[`new-${name}-ms`] = await titleNew('desk', { whatIf });
  await page.waitForFunction(() => globalThis.__desk?.desk);
  await look(`${name}-start`, { hold: false });
  const pace = await page.evaluate(async () => {
    const v = await import('/js/desk/view.js');
    return { top: Math.max(...v.SPEEDS), TERMINAL: v.TERMINAL ?? -200, LAST_MINUTE: v.LAST_MINUTE ?? -200 };
  });
  let idle = 0,
    restarted = false;
  for (let n = 0; n < 400; n++) {
    stepName = `${name}-${n}`;
    const s = await ap('deskStep', 60);
    if (s.error) {
      note(finding('stuck', 'bug', where, `Desk mode: ${s.error}`));
      break;
    }
    where = { mode: 'desk', t: Math.round(s.t), done: s.done };
    // Real seconds at the fastest speed the desk allows there: its top speed, 10x in the terminal count, and the last
    // minute is the liftoff, watched rather than waited through.
    idle += s.t > pace.LAST_MINUTE ? 0 : s.t > pace.TERMINAL ? s.ran / 10 : s.ran / pace.top;
    run.desk.push({ name, t: s.t, said: s.said, idle });
    if (s.said.length || s.firstAsk != null) {
      if (idle > LIMITS.longWait)
        note(
          finding(
            'long-wait',
            'warn',
            where,
            `${Math.round(idle)} s with nothing to do at the fastest speed before ${s.said[0] ?? 'the next call'}.`,
            {
              value: idle,
            },
          ),
        );
      idle = 0;
      await look(`${name}-${s.said[0] ?? 'ask'}`, { hold: false });
    } else if (n % 15 === 0) await look(`${name}-T${Math.round(s.t)}`, { hold: false });
    if (!restarted && !whatIf && s.t > -5000) {
      restarted = true;
      stepName = 'restart';
      // Paused, so the count stands still while the desk saves (every five seconds); then what was saved is what must
      // come back.
      await page.click('#desk [data-act=pause]');
      await sleep(5500);
      const t = await page.evaluate(() => JSON.parse(localStorage.getItem('aa-desk'))?.checkpoint?.t);
      await restartCheck('desk', { t }, async () => {
        await page.waitForFunction(() => globalThis.__desk?.desk);
        return { t: await page.evaluate(() => globalThis.__desk.desk.t) };
      });
    }
    if (s.done) {
      if (idle > LIMITS.longWait)
        note(
          finding(
            'long-wait',
            'warn',
            where,
            `${Math.round(idle)} s with nothing to do in the terminal count before liftoff.`,
            { value: idle },
          ),
        );
      run.desk.push({ name, verdict: s.verdict });
      await look(`${name}-verdict`, { hold: false });
      break;
    }
  }
  await page.click('#desk [data-act=back]');
  await page.waitForSelector('#title:not([hidden])');
}

// ---- The run ----
async function main() {
  log(`Ad Astra automated playtest ${stamp}. Saves in ${userData}; report in ${runDir}`);
  await launch();
  run.build = await app.evaluate(({ app }) => `v${app.getVersion()}`);
  try {
    run.build += ` ${fs
      .readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8')
      .trim()
      .replace('ref: refs/heads/', '')}`;
  } catch {
    /* no git folder */
  }
  where = { mode: 'title' };
  stepName = 'title';
  // A real click first: sound waits for one, as it does for a player.
  await page.mouse.click(20, 200);
  await look('title', { hold: false });
  for (const mode of opts.modes) {
    try {
      if (mode === 'flight') await playFlight();
      else if (mode === 'management') await playManagement();
      else if (mode === 'desk') {
        await playDesk();
        if (!quick) await playDesk({ whatIf: true });
      }
    } catch (e) {
      log(`  ${mode} stopped: ${e.message}`);
      note(
        finding(
          'runner-stopped',
          'bug',
          where,
          `The playtest could not carry on in ${mode}: ${e.message.split('\n')[0]}`,
          { stack: e.stack },
        ),
      );
      try {
        await page.screenshot({ path: path.join(shotDir, `stopped-${mode}.png`) });
        await page.reload();
        await page.waitForFunction(() => window.__site?.g, null, { timeout: 60000 });
        await page.evaluate(() => import('/tools/autoplay/driver.js'));
      } catch {
        await launch().catch(() => {});
      }
    }
  }
  closing = true;
  await app.close().catch(() => {});
  finish();
}

function finish() {
  // The game's own playtest log, kept in the run's temporary saves folder: its errors are bugs too.
  const ptDir = path.join(userData, 'playtest');
  try {
    const gameLog = JSON.parse(fs.readFileSync(path.join(ptDir, 'log.json'), 'utf8'));
    run.gameLog = {
      sessions: gameLog.sessions?.length ?? 0,
      events: gameLog.events?.length ?? 0,
      errors: gameLog.errors ?? [],
    };
    for (const e of (gameLog.errors ?? []).filter(e => !isNoise(String(e.message))))
      note(
        finding(
          'logged-error',
          'bug',
          { mode: 'flight' },
          `The game logged an error (${e.kind}): ${String(e.message).slice(0, 200)}`,
          { stack: e.stack },
        ),
      );
    fs.cpSync(ptDir, path.join(runDir, 'game-playtest-log'), { recursive: true });
  } catch (e) {
    run.gameLog = { missing: String(e.message) };
    note(finding('playtest-log-missing', 'warn', {}, 'The game wrote no playtest log in this run.'));
  }
  const { waits, findings } = judgeWaits(run.steps);
  run.waits = waits.slice(0, 25);
  run.findings.push(...findings, ...judgeMemory(run.looks));
  run.problems = dedupe(run.findings);
  for (const p of run.problems) p.issue = issueLink(p, run);
  run.finished = new Date().toISOString();
  if (opts.approve) {
    fs.mkdirSync(baseDir, { recursive: true });
    for (const l of run.looks) fs.copyFileSync(path.join(shotDir, l.file), path.join(baseDir, `${l.key}.png`));
    log(`Approved ${run.looks.length} screenshots as the look to compare with.`);
  }
  if (opts.fileIssues) fileIssues(run.problems.filter(p => p.severity === 'bug'));
  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(run, null, 2));
  writeReport(run, path.join(runDir, 'report.html'));
  fs.rmSync(userData, { recursive: true, force: true });
  const count = s => run.problems.filter(p => p.severity === s).length;
  log(
    `Done: ${count('bug')} bugs, ${count('warn')} warnings, ${count('info')} notes. Report: ${path.join(runDir, 'report.html')}`,
  );
  process.exitCode = count('bug') ? 1 : 0;
}

function fileIssues(bugs) {
  const gh = spawnSync('gh', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (gh.status !== 0)
    return log('Not filing issues: the gh command is not installed. The report has a "File it" link for each.');
  for (const b of bugs) {
    const url = new URL(b.issue);
    const r = spawnSync(
      'gh',
      [
        'issue',
        'create',
        '--repo',
        'kj2223/History-of-Rocketry',
        '--title',
        url.searchParams.get('title'),
        '--body',
        url.searchParams.get('body'),
      ],
      { encoding: 'utf8', shell: false },
    );
    b.filed = r.status === 0 ? r.stdout.trim() : `failed: ${r.stderr.trim()}`;
    log(`  issue: ${b.filed}`);
  }
}

main().catch(e => {
  console.error(e);
  note(finding('runner-stopped', 'bug', where, `The playtest stopped: ${e.message}`, { stack: e.stack }));
  closing = true;
  app?.close().catch(() => {});
  try {
    finish();
  } catch (e2) {
    console.error(e2);
  }
  process.exitCode = 2;
});
