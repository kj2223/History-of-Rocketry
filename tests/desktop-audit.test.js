import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { trimMarks } from '../desktop/mark-retention.js';

function scratch(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-astra-audit-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  return folder;
}

test('mark retention expires the lowest ID and deletes only its screenshot and save', t => {
  const folder = scratch(t);
  for (const file of [
    'mark-960.png',
    'mark-960-save.json',
    'mark-999.png',
    'mark-1000.png',
    'mark-1000-save.json',
    'mark-9600.png',
    'mark-960-notes.txt',
  ])
    fs.writeFileSync(path.join(folder, file), '');

  trimMarks(folder, 3);
  assert.deepEqual(fs.readdirSync(folder).sort(), [
    'mark-1000-save.json',
    'mark-1000.png',
    'mark-960-notes.txt',
    'mark-9600.png',
    'mark-999.png',
  ]);
});

test('a fresh log’s mark-001 outlives older marks with higher numbers', t => {
  const folder = scratch(t);
  const old = new Date(Date.now() - 60000);
  for (const n of [41, 42, 43]) {
    const file = path.join(folder, `mark-0${n}.png`);
    fs.writeFileSync(file, '');
    fs.utimesSync(file, old, old);
  }
  fs.writeFileSync(path.join(folder, 'mark-001.png'), '');
  trimMarks(folder, 3);
  assert.deepEqual(fs.readdirSync(folder).sort(), ['mark-001.png', 'mark-042.png', 'mark-043.png']);
});

test('playtest reports sanitize terminal output and preserve original JSON values', t => {
  const file = path.join(scratch(t), 'log.json');
  const message = 'before\x1b[2J\x9b2J\rafter\x07';
  fs.writeFileSync(
    file,
    JSON.stringify({
      format: 'ad-astra-playtest-log',
      sessions: [],
      events: [],
      calls: [],
      marks: [],
      errors: [
        {
          kind: 'renderer',
          count: 1,
          message,
          first: { t: 0 },
          last: { t: 0 },
        },
      ],
    }),
  );
  const script = fileURLToPath(new URL('../tools/playtest-report.mjs', import.meta.url));
  const output = execFileSync(process.execPath, [script, file], { encoding: 'utf8' });
  assert.match(output, /before.*after/);
  assert.doesNotMatch(output, /[\x00-\x09\x0B-\x1F\x7F-\x9F]/);
  const json = execFileSync(process.execPath, [script, file, '--json'], { encoding: 'utf8' });
  assert.doesNotMatch(json, /[\x00-\x09\x0B-\x1F\x7F-\x9F]/);
  assert.equal(JSON.parse(json).errors[0].message, message);
});
