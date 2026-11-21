import fs from 'node:fs';
import path from 'node:path';

export function trimMarks(marks, limit) {
  const filesByMark = new Map();
  for (const file of fs.readdirSync(marks, { withFileTypes: true })) {
    const match = /^mark-(\d{3,5})(?:\.png|-save\.json)$/.exec(file.name);
    if (!match || !file.isFile()) continue;
    const id = Number(match[1]);
    if (!filesByMark.has(id)) filesByMark.set(id, []);
    filesByMark.get(id).push(file.name);
  }
  // Oldest first by file time, not number: a fresh log numbers its marks from 1 again, beside older higher numbers.
  const age = id => Math.max(...filesByMark.get(id).map(f => fs.statSync(path.join(marks, f)).mtimeMs));
  const ids = [...filesByMark.keys()].sort((a, b) => age(a) - age(b) || a - b);
  for (const id of ids.slice(0, Math.max(0, ids.length - limit)))
    for (const file of filesByMark.get(id)) fs.rmSync(path.join(marks, file));
}
