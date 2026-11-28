// Golden traces for Mission Control's console panel (js/site/draw.js consolePanelModel, flightSteps and the clocks;
// js/site/console-hud.js the panel, clocks and steps HTML): the tests' bot plays the campaign (as campaign.mjs does),
// and at sampled moments while g.console is up what your console shows is written down. ad-astra's
// AdAstra.Rules/Flow/ConsolePanel.cs must show the same at the same moments (ConsolePanelGoldenTests.cs).
//
// The moments are taken after a game tick, so the call the bot is about to answer is on the panel. game.js gives no
// hook for that, so while this part loads it wraps game.js's tick() as it is read (a Node module hook; the file on disk
// is untouched): tick(dt) runs the game's own tick, then globalThis.__goldenAfterTick. The C# has the same hook,
// Game.AfterTick. The hook only takes effect if game.js has not been loaded yet, so console-panel.mjs runs this in a fresh Node process.
//
// A tick is sampled when the console is new, when the panel's state, ask or buttons change, and every EVERY ticks
// besides. Writes console-panel-<seed>.json: { seed, every, end, ticks, samples: [{ i, tick, roundId, day, clock,
// model, steps, clocks, panelHtml, clocksHtml, stepsHtml }] }.
import { register } from 'node:module';

const LOADER = `export async function load(url, context, nextLoad) {
  const r = await nextLoad(url, context);
  if (!url.endsWith('/js/game.js')) return r;
  const src = String(r.source);
  const head = 'export function tick(dt) {';
  if (!src.includes(head)) throw new Error('console-panel golden: game.js has no "' + head + '"');
  return { ...r, source: src.replace(head, 'export function tick(dt) {\\n  tick$body(dt);\\n  globalThis.__goldenAfterTick?.();\\n}\\nfunction tick$body(dt) {') };
}`;
register('data:text/javascript,' + encodeURIComponent(LOADER));

const bot = await import('../../js/dev/bot.js');
const game = await import('../../js/game.js');
const { SEASON } = await import('../../js/data/campaign.js');
const { consolePanelModel, flightSteps, countClock, missionClock, siteClock } = await import('../../js/site/draw.js');
const { consoleHud } = await import('../../js/site/console-hud.js');

export const PANEL_SEEDS = [1945, 7];
export const EVERY = 400;

// console-hud.js writes its HTML into #mc-panel, #mc-clocks and #mc-steps, and only when it changed; a stand-in
// document, kept from call to call (as the page's elements are) but in globalThis only while it runs.
const els = {};
function hudHtml(g) {
  const had = 'document' in globalThis,
    old = globalThis.document;
  globalThis.document = {
    getElementById: id => (els[id] ??= { innerHTML: '', hidden: false, classList: { toggle() {} } }),
  };
  try {
    consoleHud(g, true);
  } finally {
    if (had) globalThis.document = old;
    else delete globalThis.document;
  }
  return {
    panelHtml: els['mc-panel'].innerHTML,
    clocksHtml: els['mc-clocks'].innerHTML,
    stepsHtml: els['mc-steps'].innerHTML,
  };
}

function playCampaign(seed) {
  const samples = [];
  let ticks = 0,
    lastConsole = null,
    lastKey = null;
  globalThis.__goldenAfterTick = () => {
    const g = game.g,
      c = g.console;
    if (!c) return;
    ticks++;
    const model = consolePanelModel(c, g);
    const key = JSON.stringify([model.state, model.ask, model.buttons]);
    const fresh = c !== lastConsole || key !== lastKey;
    lastConsole = c;
    lastKey = key;
    if (!fresh && ticks % EVERY) return;
    // flightSteps before the HTML, which calls it again (it keeps the step a phase without one leaves shown).
    const steps = flightSteps(c);
    const clocks = [countClock(c), missionClock(c), siteClock(g)];
    samples.push({
      i: samples.length,
      tick: ticks,
      roundId: SEASON[g.roundIndex].id,
      day: g.day,
      clock: g.clock,
      model,
      steps,
      clocks,
      ...hudHtml(g),
    });
  };
  let end;
  try {
    bot.campaignTo(seed, SEASON[SEASON.length - 1].id);
    end = 'last round';
  } catch (e) {
    end = String(e.message).slice(0, 300);
  } finally {
    globalThis.__goldenAfterTick = undefined;
  }
  if (!ticks) throw new Error('console-panel golden: the tick hook never ran (game.js was loaded before this part)');
  return { seed, every: EVERY, end, ticks, samples };
}

export function record(write) {
  for (const seed of PANEL_SEEDS) write(`console-panel-${seed}.json`, playCampaign(seed));
}
