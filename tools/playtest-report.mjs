// Reads a playtest log and prints what a bug hunt needs first: the builds and sessions, every error with where it
// happened, each F8 mark with what led up to it, the rounds and their outcomes, odd clocks, and the last stretch of play.
//
//   node tools/playtest-report.mjs <playtest folder or log.json> [--tail 60] [--before 25] [--json]
//
// The playtest folder is %APPDATA%\Ad Astra\playtest on Windows: log.json, save.json (the latest checkpoint) and
// marks\ (a screenshot and the save at each F8). See README "Playtest log".
import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const target = args.find(
  (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--tail') && !args[i - 1]?.startsWith('--before'),
);
if (!target) {
  console.error(
    'usage: node tools/playtest-report.mjs <playtest folder or log.json> [--tail 60] [--before 25] [--json]',
  );
  process.exit(2);
}
const file = fs.statSync(target).isDirectory() ? path.join(target, 'log.json') : target;
const log = JSON.parse(fs.readFileSync(file, 'utf8'));
if (log.format !== 'ad-astra-playtest-log') throw new Error(`${file} is not an Ad Astra playtest log`);

const day0 = Date.UTC(1945, 0, 1);
const date = d => (Number.isFinite(d) ? new Date(day0 + d * 864e5).toISOString().slice(0, 10) : '—');
const hhmm = c =>
  Number.isFinite(c)
    ? `${String(Math.floor((c % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(c % 60)).padStart(2, '0')}`
    : '';
const when = e =>
  `${new Date(e.t).toISOString().slice(11, 19)} s${e.s} ${date(e.d)} ${hhmm(e.c)} ${e.r ?? '-'}/${e.b ?? '-'}`;
const rest = e => {
  const { t, s, d, c, r, b, k, ...fields } = e;
  return Object.keys(fields).length ? JSON.stringify(fields) : '';
};
const line = e => `  ${when(e)}  ${e.k ?? 'call'}  ${e.k ? rest(e) : `${e.who}: ${e.text}`}`;

if (args.includes('--json')) {
  const json = JSON.stringify({ sessions: log.sessions, errors: log.errors, marks: log.marks }, null, 2);
  console.log(json.replace(/[\x7F-\x9F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
  process.exit(0);
}

const print = text => console.log(stripVTControlCharacters(text).replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ''));

print(`# Playtest log ${file}`);
print(
  `${log.events.length} events, ${log.calls.length} loop calls, ${log.errors.length} distinct errors, ${log.marks.length} marks\n`,
);

print('## Sessions');
for (const s of log.sessions)
  print(
    `  s${s.n} ${s.at}  v${s.build?.version ?? '?'} ${s.build?.commit ?? ''} ${s.build?.branch ?? ''}${s.build?.dirty ? ' (uncommitted changes)' : ''}  window ${s.window?.w}x${s.window?.h} dpr ${s.screen?.dpr}  screen ${s.screen?.w}x${s.screen?.h}`,
  );

print('\n## Errors (most frequent first)');
if (!log.errors.length) print('  none');
for (const e of [...log.errors].sort((a, b) => b.count - a.count)) {
  print(`  [${e.kind}] x${e.count}  ${e.message}`);
  print(`    first ${when(e.first)}   last ${when(e.last)}`);
  if (e.stack)
    print(
      e.stack
        .split('\n')
        .slice(0, 4)
        .map(l => `    | ${l.trim()}`)
        .join('\n'),
    );
}

const before = opt('before', 25);
print('\n## Marks (F8)');
if (!log.marks.length) print('  none');
for (const m of log.marks) {
  print(`  mark ${m.n}  ${when(m)}  scene ${m.scene}  files ${(m.files ?? []).join(', ') || '—'}`);
  print(`    objective: ${m.objective ?? ''}`);
  print(`    clocks: ${JSON.stringify(m.clocks)}`);
  const lead = [...log.events.filter(e => e.t <= m.t), ...log.calls.filter(e => e.t <= m.t)].sort((a, b) => a.t - b.t);
  for (const e of lead.slice(-before)) print(`  ${line(e)}`);
}

print('\n## Rounds and outcomes');
for (const e of log.events.filter(e => ['round', 'outcome', 'fix', 'offer', 'newgame', 'load'].includes(e.k)))
  print(line(e));

// The game's clock and a mission's should move together: a cruise's hours against the hours since injection.
print('\n## Clock checks');
let odd = 0;
for (const e of log.events.filter(e => e.clocks?.lunar)) {
  const L = e.clocks.lunar;
  if (L.h != null && L.sinceInjectionH != null && Math.abs(L.h - L.sinceInjectionH) > 0.5) {
    odd++;
    print(`  ${when(e)}  lunar ${L.phase}: ${L.h} h on the plot, ${L.sinceInjectionH} h on the game clock`);
  }
}
if (!odd) print('  no mismatches found');

const slow = log.events.filter(e => e.k === 'slow');
if (slow.length) {
  print('\n## Slow frames');
  for (const e of slow) print(line(e));
}

const tail = opt('tail', 60);
print(`\n## Last ${tail} entries`);
for (const e of [...log.events, ...log.calls].sort((a, b) => a.t - b.t).slice(-tail)) print(line(e));
