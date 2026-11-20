// DESK MODE: the EECOM desk, looked down on (Aaron, 19 Nov 2026: "a kinda desk view with papers on it and a teletype
// for information"). The console along the top holds the desk's own displays, the event lights and the loop keys;
// on the desk below are the teletype's paper, the headset (what you heard), the procedures stack and the comms stack.
// The count runs on its own clock; pause stops it. Flight asking EECOM something drops the speed to 1x.
import { LOOPS, PEOPLE, PROCEDURES, TASKS, MAX_UP } from './data.js';
import { tickDesk, act, callOptions, toggleLoop, readings, eventLights, count, wall } from './model.js';

export const SPEEDS = [1, 10, 60];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LOOP_ORDER = ['flight', 'ssr', 'launch', 'ag'];

export function startDeskView(el, d, { back, save }) {
  let speed = 10,
    paused = false,
    papers = false,
    last = performance.now(),
    lastSave = last,
    open = openAsks(d),
    stopped = false;
  const cache = {};
  el.innerHTML = `<div class="dk">
    <div class="dk-bar">
      <button data-act="back" title="Back to the title screen (the desk is saved)">Leave the desk</button>
      <span class="dk-title">Apollo 11 · EECOM · launch day</span>
      <span class="dk-part" data-part="clock"></span>
      <span class="dk-speed" data-part="speed"></span>
    </div>
    <section class="dk-console">
      <div class="dk-crt" data-part="crt"></div>
      <div class="dk-lights" data-part="lights"></div>
      <div class="dk-keys" data-part="keys"></div>
    </section>
    <section class="dk-top">
      <div class="dk-paper dk-tty"><h3>Teletype</h3><div data-part="tty"></div></div>
      <div class="dk-headset"><h3>On your headset</h3><div data-part="heard"></div></div>
      <div class="dk-stacks">
        <div class="dk-paper dk-procs" data-act="papers" title="Pick up the procedures"><h3>Procedures</h3><div data-part="next"></div><p class="dk-hint">Pick them up (P)</p></div>
        <div class="dk-paper dk-comms"><h3>What you can say</h3><div data-part="comms"></div></div>
      </div>
    </section>
    <div class="dk-sheet" data-part="sheet" hidden></div>
    <div class="dk-sheet dk-verdict" data-part="verdict" hidden></div>
  </div>`;
  const part = name => el.querySelector(`[data-part="${name}"]`);
  const put = (name, html) => {
    if (cache[name] === html) return;
    cache[name] = html;
    part(name).innerHTML = html;
    if (name === 'tty' || name === 'heard') part(name).parentElement.scrollTop = 1e9; // the newest line in view
  };

  function render() {
    const r = readings(d),
      w = wall(d);
    put(
      'clock',
      `<b class="dk-count">${count(d.t)}</b> <span>${w.edt} EDT · ${w.gmt} GMT</span>${d.hold ? ' <span class="dk-hold">HOLDING</span>' : ''}${d.fault ? ' <span class="dk-whatif" title="A fault added to the real count: not historical">WHAT IF</span>' : ''}`,
    );
    put(
      'speed',
      `<button data-act="pause" class="${paused ? 'on' : ''}" title="Pause (Space)">❚❚</button>` +
        SPEEDS.map(
          s =>
            `<button data-act="speed" data-speed="${s}" class="${!paused && s === speed ? 'on' : ''}">${s}×</button>`,
        ).join(''),
    );
    const row = (k, v, u = '') => `<tr><th>${k}</th><td>${v}</td><td>${u}</td></tr>`;
    put(
      'crt',
      `<table>
        ${row('CABIN P', r.cabin.toFixed(2), 'PSIA')}
        ${row('SUIT P', r.suit == null ? '--.--' : r.suit.toFixed(2), 'PSIA')}
        ${row('O2 TK 1 / 2', `${r.o2p[0]} / ${r.o2p[1]}`, 'PSIA')}
        ${row('O2 QTY 1 / 2', `${r.o2q[0].toFixed(1)} / ${r.o2q[1] > 102 ? 'OFF HI' : r.o2q[1].toFixed(1)}`, '%')}
        ${row('H2 TK 1 / 2', `${r.h2p[0]} / ${r.h2p[1]}`, 'PSIA')}
        ${row('H2 QTY 1 / 2', `${r.h2q[0].toFixed(1)} / ${r.h2q[1].toFixed(1)}`, '%')}
        ${row('FC 1 / 2 / 3', r.fc.map(x => x.toFixed(1)).join(' / '), 'AMP')}
        ${row('MAIN BUS A / B', `${r.busA.toFixed(1)} / ${r.busB.toFixed(1)}`, 'VDC')}
        ${row('BAT A / B', r.bat.map(x => x.toFixed(1)).join(' / '), 'AMP')}
        ${row('POWER', r.power)}
      </table>`,
    );
    put(
      'lights',
      Object.entries(eventLights(d))
        .map(([k, on]) => `<span class="dk-lamp ${on ? 'on' : ''}">${k}</span>`)
        .join(''),
    );
    const lit = l => d.lights[l] != null && d.clock - d.lights[l] < Math.max(15, speed * 3);
    put(
      'keys',
      LOOP_ORDER.map(
        (l, i) =>
          `<button data-act="loop" data-loop="${l}" class="dk-key ${d.up.includes(l) ? 'up' : ''} ${lit(l) ? 'lit' : ''}" title="${esc(LOOPS[l].what)} (${i + 1})"><i></i>${LOOPS[l].name}<small>${d.up.includes(l) ? 'MONITOR' : 'OFF'}</small></button>`,
      ).join('') +
        `<p class="dk-hint">Two loops at most in your headset. A key lights when someone talks on a loop you are not on.</p>`,
    );
    put(
      'tty',
      d.tty
        .slice(-14)
        .map(l => `<div>${esc(l.text)}</div>`)
        .join(''),
    );
    put(
      'heard',
      d.log
        .filter(l => l.heard)
        .slice(-9)
        .map(
          l =>
            `<p class="${l.who === 'eecom' ? 'me' : ''}"><b>${count(l.t)} ${LOOPS[l.loop].name}</b> ${esc(PEOPLE[l.who] ?? l.who)}: ${esc(l.text)}</p>`,
        )
        .join('') || '<p class="dk-hint">Nothing heard yet.</p>',
    );
    const due = Object.entries(TASKS).filter(([id, t]) => !d.tasks[id] && d.t >= t.from - 900);
    put(
      'next',
      due.length
        ? due.map(([, t]) => `<p><b>${t.title}</b> ${d.t >= t.from ? '(now)' : '(soon)'}</p>`).join('')
        : '<p class="dk-hint">Nothing scheduled for the next fifteen minutes.</p>',
    );
    const opts = callOptions(d);
    put(
      'comms',
      opts.length
        ? opts
            .map(
              o =>
                `<button data-act="say" data-id="${o.id}" class="${o.answer ? 'answer' : ''}"><small>${o.to === 'capcom' ? 'TO CAPCOM' : 'TO FLIGHT'}</small>${esc(o.text)}</button>`,
            )
            .join('')
        : '<p class="dk-hint">Nothing to say.</p>',
    );
    put('sheet', papers ? procedures() : '');
    part('sheet').hidden = !papers;
    put('verdict', d.done ? writeUp() : '');
    part('verdict').hidden = !d.done;
  }

  const procedures = () => `<h2>Procedures: pre-launch count</h2>
    <ol>${PROCEDURES.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
    <h3>Scheduled for EECOM</h3>
    <ul>${Object.entries(TASKS)
      .map(
        ([id, t]) =>
          `<li><b>${t.title}.</b> ${esc(t.paper)} ${d.tasks[id] ? `<em>(${d.tasks[id].result === 'done' ? 'done' : d.tasks[id].result})</em>` : ''}</li>`,
      )
      .join('')}</ul>
    <p class="dk-hint">Times and readings in these papers are close to the real ones, not taken from them.${d.fault ? ' This is a what-if count: one fault in it never happened on Apollo 11.' : ''}</p>
    <button data-act="papers">Put them down</button>`;

  const writeUp = () => `<h2>Liftoff</h2>
    <p class="muted">From the Flight Director, after the count:</p>
    ${d.verdict.lines.map(l => `<p>${esc(l)}</p>`).join('')}
    ${d.fault ? `<p class="dk-hint">This was a what-if count. The ${d.fault === 'leak' ? 'cabin leak' : 'O2 quantity probe'} never happened on Apollo 11.</p>` : '<p class="dk-hint">This was the real count, as it ran on 16 July 1969.</p>'}
    <p class="dk-hint">The next part of the flight, from liftoff to orbit, is not built yet.</p>
    <button data-act="back">Back to the title screen</button>`;

  function doSave() {
    lastSave = performance.now();
    save(d);
  }

  function frame(now) {
    if (stopped) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused && !papers && !d.done) {
      tickDesk(d, dt * speed);
      const nowOpen = openAsks(d);
      if (nowOpen > open || (d.t > -200 && speed > 1)) speed = 1; // Flight asked you something; the terminal count
      open = nowOpen;
      if (d.done) doSave();
    }
    if (now - lastSave > 5000) doSave();
    render();
    requestAnimationFrame(frame);
  }

  el.onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'back') {
      doSave();
      return back();
    } else if (a === 'pause') paused = !paused;
    else if (a === 'speed') {
      speed = +b.dataset.speed;
      paused = false;
    } else if (a === 'loop') toggleLoop(d, b.dataset.loop);
    else if (a === 'papers') papers = !papers;
    else if (a === 'say') {
      act(d, b.dataset.id);
      open = openAsks(d);
    }
    render();
  };
  const onKey = e => {
    if (e.key === ' ') {
      paused = !paused;
      e.preventDefault();
    } else if (/^[1-4]$/.test(e.key)) toggleLoop(d, LOOP_ORDER[+e.key - 1]);
    else if (e.key === 'p' || e.key === 'P') papers = !papers;
    else if (e.key === 'Escape') papers = false;
    else return;
    render();
  };
  window.addEventListener('keydown', onKey);
  el.hidden = false;
  render();
  requestAnimationFrame(frame);
  return {
    desk: d,
    stop() {
      stopped = true;
      window.removeEventListener('keydown', onKey);
    },
    // Test hooks: run the count on, and read the state.
    run(seconds) {
      tickDesk(d, seconds);
      render();
    },
    say(id) {
      const ok = act(d, id);
      render();
      return ok;
    },
    get speed() {
      return speed;
    },
    maxUp: MAX_UP,
  };
}

const openAsks = d => Object.values(d.asks).filter(a => !a.result).length;

export function stopDeskView(el, view) {
  view?.stop();
  el.hidden = true;
  el.onclick = null;
  el.innerHTML = '';
}
