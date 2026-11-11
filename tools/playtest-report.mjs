// Reads a playtest log and prints what a bug hunt needs first: the builds and sessions, every error with where it
// happened, each F8 mark with what led up to it, the rounds and their outcomes, odd clocks, and the last stretch of play.
//
//   node tools/playtest-report.mjs <playtest folder or log.json> [--tail 60] [--before 25] [--json]
//
// The playtest folder is %APPDATA%\Ad Astra\playtest on Windows: log.json, save.json (the latest checkpoint) and
// marks\ (a screenshot and the save at each F8). See README "Playtest log".
import fs from 'node:fs';
import path from 'node:path';

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
  console.log(JSON.stringify({ sessions: log.sessions, errors: log.errors, marks: log.marks }, null, 2));
  process.exit(0);
}

console.log(`# Playtest log ${file}`);
console.log(
  `${log.events.length} events, ${log.calls.length} loop calls, ${log.errors.length} distinct errors, ${log.marks.length} marks\n`,
);

console.log('## Sessions');
for (const s of log.sessions)
  console.log(
    `  s${s.n} ${s.at}  v${s.build?.version ?? '?'} ${s.build?.commit ?? ''} ${s.build?.branch ?? ''}${s.build?.dirty ? ' (uncommitted changes)' : ''}  window ${s.window?.w}x${s.window?.h} dpr ${s.screen?.dpr}  screen ${s.screen?.w}x${s.screen?.h}`,
  );

console.log('\n## Errors (most frequent first)');
if (!log.errors.length) console.log('  none');
for (const e of [...log.errors].sort((a, b) => b.count - a.count)) {
  console.log(`  [${e.kind}] x${e.count}  ${e.message}`);
  console.log(`    first ${when(e.first)}   last ${when(e.last)}`);
  if (e.stack)
    console.log(
      e.stack
        .split('\n')
        .slice(0, 4)
        .map(l => `    | ${l.trim()}`)
        .join('\n'),
    );
}

const before = opt('before', 25);
console.log('\n## Marks (F8)');
if (!log.marks.length) console.log('  none');
for (const m of log.marks) {
  console.log(`  mark ${m.n}  ${when(m)}  scene ${m.scene}  files ${(m.files ?? []).join(', ') || '—'}`);
  console.log(`    objective: ${m.objective ?? ''}`);
  console.log(`    clocks: ${JSON.stringify(m.clocks)}`);
  const lead = [...log.events.filter(e => e.t <= m.t), ...log.calls.filter(e => e.t <= m.t)].sort((a, b) => a.t - b.t);
  for (const e of lead.slice(-before)) console.log(`  ${line(e)}`);
}

console.log('\n## Rounds and outcomes');
for (const e of log.events.filter(e => ['round', 'outcome', 'fix', 'offer', 'newgame', 'load'].includes(e.k)))
  console.log(line(e));

// The game's clock and a mission's should move together: a cruise's hours against the hours since injection.
console.log('\n## Clock checks');
let odd = 0;
for (const e of log.events.filter(e => e.clocks?.lunar)) {
  const L = e.clocks.lunar;
  if (L.h != null && L.sinceInjectionH != null && Math.abs(L.h - L.sinceInjectionH) > 0.5) {
    odd++;
    console.log(`  ${when(e)}  lunar ${L.phase}: ${L.h} h on the plot, ${L.sinceInjectionH} h on the game clock`);
  }
}
if (!odd) console.log('  no mismatches found');

const slow = log.events.filter(e => e.k === 'slow');
if (slow.length) {
  console.log('\n## Slow frames');
  for (const e of slow) console.log(line(e));
}

const tail = opt('tail', 60);
console.log(`\n## Last ${tail} entries`);
for (const e of [...log.events, ...log.calls].sort((a, b) => a.t - b.t).slice(-tail)) console.log(line(e));
