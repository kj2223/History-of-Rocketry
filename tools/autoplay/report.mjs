// THE AUTOMATED PLAYTEST'S REPORT: one HTML page beside the screenshots, readable without anything else installed.
import fs from 'node:fs';

const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (x, d = 0) => (x == null ? '–' : Number(x).toFixed(d));
const where = w =>
  !w
    ? ''
    : w.mode === 'flight'
      ? `${w.round ?? ''} ${w.beat ?? ''}`
      : w.mode === 'management'
        ? (w.where ?? `day ${w.day}`)
        : w.mode === 'desk'
          ? `T${w.t}`
          : (w.mode ?? '');

export function writeReport(run, file) {
  const problems = run.problems ?? [];
  const count = s => problems.filter(p => p.severity === s).length;
  const section = (title, body) => `<section><h2>${title}</h2>${body}</section>`;
  const table = (head, rows) =>
    rows.length
      ? `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`
      : '<p class="muted">Nothing.</p>';

  const problemRows = problems.map(p => [
    `<span class="sev ${p.severity}">${p.severity}</span>`,
    esc(p.kind),
    `${esc(p.text)}${p.stack && p.stack !== p.text ? `<details><summary>details</summary><pre>${esc(p.stack.slice(0, 3000))}</pre></details>` : ''}`,
    `${p.count}×<br><span class="muted">${p.places.map(esc).join('<br>')}</span>`,
    p.shot ? `<a href="shots/${esc(p.shot)}"><img src="shots/${esc(p.shot)}" loading="lazy"></a>` : '',
    p.severity === 'bug' ? (p.filed ? esc(p.filed) : `<a href="${esc(p.issue)}">File it</a>`) : '',
  ]);

  const waitRows = (run.waits ?? []).map(s => [
    n(s.wait, 1),
    esc(s.name),
    esc(where(s.where)),
    esc(
      (s.beats ?? [])
        .slice()
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 3)
        .map(b => `${b.beat} ${Math.round(b.seconds)} s`)
        .join(', '),
    ),
  ]);

  const looks = run.looks ?? [];
  const lookRows = looks.map(l => [
    `<a href="shots/${esc(l.file)}"><img src="shots/${esc(l.file)}" loading="lazy"></a>`,
    `${esc(l.name)}<br><span class="muted">${esc(where(l.where))}</span>`,
    `${n(l.frames?.median)} / ${n(l.frames?.p95)} / ${n(l.frames?.worst)} ms`,
    l.audio?.rmsDb != null
      ? `${n(l.audio.rmsDb)} dB (${n(l.audio.quietestDb)} to ${n(l.audio.loudestDb)}), peak ${n(l.audio.peak, 2)}, ${l.audio.alive} live`
      : '<span class="muted">no sound</span>',
    l.diff
      ? `${Math.round(l.changed * 100)}% changed <a href="shots/${esc(l.diff)}">diff</a> <a href="shots/${esc(l.file.replace('.png', '-approved.png'))}">approved</a>`
      : l.newLook
        ? '<span class="muted">no approved look yet</span>'
        : `${n((l.changed ?? 0) * 100)}% changed`,
    l.memoryMb != null ? `${l.memoryMb} MB` : '',
  ]);

  const liftoffs = looks
    .filter(l => l.name === 'liftoff')
    .map(l => [
      esc(where(l.where)),
      l.audio?.loudestDb != null ? `${n(l.audio.loudestDb)} dB` : '–',
      n(l.audio?.peak, 2),
      `<a href="shots/${esc(l.file)}">screen</a>`,
    ]);
  const timings = Object.entries(run.timings ?? {}).map(([k, v]) => [esc(k), `${n(v)} ms`]);
  const manage = (run.manageWeeks ?? []).map(w => [w.week, w.day, esc(w.flown), w.quietDays]);
  const desk = (run.desk ?? []).filter(d => d.verdict).map(d => [esc(d.name), d.verdict.map(esc).join('<br>')]);
  const hands = [
    ...Object.entries(run.handsOn ?? {}).map(([k, v]) => [esc(k), esc(v)]),
    ...(run.emergencies ?? []).map(e => [
      'pad emergency',
      esc(`${e.kind} at ${e.pad}, ${e.minutes} min, ${e.lost ? 'rocket lost' : `slip ${e.slip} d`}, ${e.hurt} hurt`),
    ]),
  ];

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ad Astra playtest ${esc(run.id)}</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;background:#16181c;color:#ddd}
h1{font-weight:500}h2{margin-top:32px;border-bottom:1px solid #333;padding-bottom:4px;font-weight:500}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #2a2d33;padding:6px 8px;text-align:left;vertical-align:top}
th{color:#999;font-weight:500}img{width:220px;border:1px solid #333}pre{white-space:pre-wrap;font-size:12px;color:#bbb}
.muted{color:#888}.sev{padding:1px 6px;border-radius:3px;font-size:12px}.bug{background:#7a2323}.warn{background:#6b5717}.info{background:#2d4a63}
.tiles{display:flex;gap:16px}.tile{background:#202329;padding:12px 18px;border-radius:6px}.tile b{font-size:26px;display:block}
a{color:#8cc4ff}
</style></head><body>
<h1>Ad Astra automated playtest</h1>
<p class="muted">Run ${esc(run.id)} on ${esc(run.build)}, ${esc(run.started)} to ${esc(run.finished)}. Modes: ${esc(run.options.modes.join(', '))}${run.options.to ? `, Flight Director to ${esc(run.options.to)}` : ''}, seed ${esc(run.options.seed)}.</p>
<div class="tiles">
<div class="tile"><b>${count('bug')}</b>bugs</div><div class="tile"><b>${count('warn')}</b>warnings</div><div class="tile"><b>${count('info')}</b>notes</div>
<div class="tile"><b>${looks.length}</b>stops looked at</div><div class="tile"><b>${(run.steps ?? []).length}</b>Flight Director steps</div>
</div>
${section('What it found', table(['', 'kind', 'what', 'seen', 'screenshot', ''], problemRows))}
${section('The longest waits (real seconds at the fastest speed, with nothing to decide)', table(['seconds', 'before', 'where', 'longest beats'], waitRows))}
${section('Loading', table(['what', 'took'], timings))}
${liftoffs.length ? section('Liftoffs, heard live (loudest moment, peak)', table(['flight', 'loudest', 'peak', ''], liftoffs)) : ''}
${manage.length ? section('Management: flights and the quiet days before each', table(['week', 'day', 'flight', 'quiet days'], manage)) : ''}
${desk.length ? section('Desk mode: the verdicts', table(['count', 'verdict'], desk)) : ''}
${hands.length ? section('Hands-on controls worked', table(['what', 'how many'], hands)) : ''}
${section('Every stop: frames (median / 95% / worst), sound, look', table(['screen', 'stop', 'frames', 'sound', 'against the approved look', 'memory'], lookRows))}
<p class="muted">Sound levels are what the game sends to the speakers, measured in the window. A sound being the right one still needs your ear; this finds silence, clipping, sounds that pile up and sound that carries over.</p>
</body></html>`;
  fs.writeFileSync(file, html);
}
