// A fix the team made still counts on a round the history makes likelier to go wrong (playtest, 11 November 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { initProgramme, adopt, withSeasonRisk } from '../js/world/programme.js';
import { DEFAULT_PROGRAMME } from '../js/truth/round.js';

test('a season risk applies in full before any fix', () => {
  const p = withSeasonRisk(initProgramme(), { j2Risk: 0.5, seg51Risk: 0.6, cold: true }, DEFAULT_PROGRAMME);
  assert.equal(p.j2Risk, 0.5);
  assert.equal(p.seg51Risk, 0.6);
  assert.equal(p.cold, true);
});

test('a fix made earlier cuts a later season risk by the same share', () => {
  const prog = initProgramme();
  adopt(prog, 'j2'); // after Apollo 6: j2Risk x0.2
  const p = withSeasonRisk(prog, { j2Risk: 0.5 }, DEFAULT_PROGRAMME);
  assert.ok(Math.abs(p.j2Risk - 0.1) < 1e-9, `j2Risk ${p.j2Risk}`);
  adopt(prog, 'computer'); // after Gemini 4: computerRisk x0.3
  assert.ok(Math.abs(withSeasonRisk(prog, { computerRisk: 0.3 }, DEFAULT_PROGRAMME).computerRisk - 0.09) < 1e-9);
});

test('the season figure never touches the standing programme', () => {
  const prog = initProgramme();
  withSeasonRisk(prog, { pogoRisk: 0.75 }, DEFAULT_PROGRAMME);
  assert.equal(prog.pogoRisk, 0.5);
});
