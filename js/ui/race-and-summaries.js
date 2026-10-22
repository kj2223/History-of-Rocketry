// THE RACE panel (historical firsts and what intelligence expects next), the Phase One summary, and the run-log viewer.
import { FIRSTS, RIVAL, HISTORICAL_US_FIRSTS } from '../data/history.js';
import { S, today, formatDate } from '../core/state.js';
import { programmeProgress } from '../rules/economy.js';
import { intelligenceEstimate, sovietProgress } from '../rules/race.js';
import { $, setHTML } from './dom.js';

const FIRST_STATUS = { us: ['ok', 'US FIRST'], second: ['wn', 'SECOND'], them: ['bad', 'SOVIET FIRST'] };
export function renderRace() {
  const estimate = intelligenceEstimate(), ours = programmeProgress(), theirs = sovietProgress();
  const bars = `<div class="rbars"><div class="r"><span>Your programme <span class="d">(estimate)</span></span><b>${Math.round(ours * 100)}%</b></div><div class="bar us"><i style="width:${ours * 100}%"></i></div><div class="r"><span>Soviet programme <span class="d">(intelligence estimate)</span></span><b>${theirs.done ? (S.nasa ? 'COSMONAUT IN ORBIT' : 'SATELLITE IN ORBIT') : `${Math.round(theirs.lo * 100)}–${Math.round(theirs.hi * 100)}%`}</b></div><div class="bar su"><i style="width:${theirs.lo * 100}%"></i><u style="left:${theirs.lo * 100}%;width:${(theirs.hi - theirs.lo) * 100}%"></u></div><div class="m">Progress toward ${S.nasa ? 'a human in space' : 'an artificial satellite'}.</div></div>`;
  // After NASA, only the orbit and the human-in-space firsts are still listed.
  const firsts = FIRSTS.filter(first => !S.nasa || first.id == 'f_orbit' || first.id == 'f_human').map(first => {
    const status = FIRST_STATUS[S.fs[first.id]];
    return `<div class="first"><span>${first.name}${first.rivalEvent ? ' <span class="d">(contested)</span>' : ''}</span><b class="${status ? status[0] : 'd'}">${status ? status[1] : 'open'}</b></div>`;
  }).join('');
  setHTML($('#race'), bars + firsts + `<div class="m" style="margin-top:8px">${RIVAL.filter(event => S.rvd[event.id]).map(event => `<div class="bad">Soviet: ${event.short} (achieved)</div>`).join('')}${estimate ? `Intelligence expects ${estimate.what} between ${estimate.lo} and ${estimate.hi}.` : 'The Soviet programme has achieved everything we were tracking.'}</div>`);
}

// END-OF-PHASE SUMMARY: your timeline, and your firsts against the Soviets and the real US programme.
export function showPhaseOneSummary() {
  const sovietDate = id => {
    const first = FIRSTS.find(candidate => candidate.id == id);
    return first && first.rivalEvent && S.rvd[first.rivalEvent] ? formatDate(S.rv[first.rivalEvent]) : '—';
  };
  $('#sum').innerHTML = `<div class="sumbox"><h1>PHASE ONE COMPLETE</h1><div class="d">From sounding rockets to ${S.fs.f_orbit ? 'orbit' : 'the edge of space'} • ${today()}</div>
<div class="sumg"><div><h2>YOUR PROGRAMME</h2>${S.hist.map(entry => `<div class="first"><span>${entry.t}</span><b class="d">${formatDate(entry.d)}</b></div>`).join('') || '<div class="m">No milestones recorded.</div>'}</div>
<div><h2>FIRSTS: YOU, THE SOVIETS, HISTORY</h2><div class="tw"><table><tr><th>First</th><th>You</th><th>Soviets</th><th>Real US</th></tr>${FIRSTS.map(first => `<tr><td>${first.name.replace(/^First /, '')}</td><td class="${S.fs[first.id] == 'us' ? 'ok' : S.fs[first.id] == 'second' ? 'wn' : 'd'}">${S.fsd[first.id] != null ? formatDate(S.fsd[first.id]) : '—'}</td><td>${sovietDate(first.id)}</td><td class="d">${HISTORICAL_US_FIRSTS[first.id] || ''}</td></tr>`).join('')}</table></div>
<div class="m">Records: ${Math.round(S.hi).toLocaleString()} m altitude, ${Math.round(S.hs).toLocaleString()} m/s, ${Math.round((S.hd || 0) / 1000)} km downrange. ${S.ok} successful flights.</div></div></div>
<button data-a="closesum">CONTINUE PLAYING</button></div>`;
  $('#sum').hidden = false;
}

// THE RUN LOG viewer: key moments by play time, plus the whole log as JSON to copy.
const minutesSeconds = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const KEY_MOMENT = /DIRECTIVE FULFILLED|HISTORIC FIRST|America answers|BREAKTHROUGH|Milestone|CONTRACT|\[BASE\]|LAUNCH CREW\] .* takes|PERSONNEL\]|\[WIRE\]|Published blueprint|WASHINGTON|RECORD\] New altitude|DEAD END/;
export function showRunLog() {
  const runLog = S.dev || { ps: 0, ev: [], snap: [], fl: 0 }, moments = runLog.ev.filter(event => event.m && KEY_MOMENT.test(event.m));
  $('#sum').innerHTML = `<div class="sumbox"><h1>RUN LOG</h1><div class="d">Play time ${minutesSeconds(runLog.ps)} • ${today()} • ${runLog.fl} flights • ${runLog.ev.length} events, ${runLog.snap.length} snapshots</div>
<div class="tw" style="margin:14px 0"><table><tr><th>Play time</th><th>Date</th><th>Event</th></tr>${moments.map(event => `<tr><td>${minutesSeconds(event.t)}</td><td class="d">${formatDate(event.d)}</td><td>${event.m.replace(/</g, '&lt;')}</td></tr>`).join('') || '<tr><td colspan="3" class="d">Nothing recorded yet.</td></tr>'}</table></div>
<div class="two"><button data-a="copylog">COPY FULL RUN LOG (JSON)</button><button data-a="closesum">CLOSE</button></div><div class="m" id="copymsg">Paste the copied log into the chat to have the run analysed.</div><textarea id="logjson" readonly hidden style="width:100%;height:160px;margin-top:6px;font:11px monospace;background:var(--bg);color:var(--ink);border:1px solid var(--ln)"></textarea></div>`;
  $('#sum').hidden = false;
}
// Copy the run log to the clipboard; where that is blocked, show it selected for Ctrl+C.
export function copyRunLog() {
  const text = JSON.stringify({ game: 'Project Vanguard', saved: new Date().toISOString(), ...S.dev }), box = $('#logjson');
  box.value = text;
  const fallback = () => {
    box.hidden = false;
    box.focus();
    box.select();
    $('#copymsg').textContent = 'Copying was blocked here. The log is selected below: press Ctrl+C.';
  };
  try {
    navigator.clipboard.writeText(text).then(() => {
      $('#copymsg').textContent = `Copied ${Math.round(text.length / 1024)} KB to the clipboard.`;
    }, fallback);
  } catch (error) {
    fallback();
  }
}
