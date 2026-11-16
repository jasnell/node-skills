// @node-skills {"added":["v26.10.0"]}
// glob maxDepth (v26.9.0), fs.openAsBlobSync (v26.10.0), async stat throwIfNoEntry (v25.7.0),
// stat/lstat signal (v26.8.0), fs.Stats *Instant (Temporal) getters (v26.2.0).
import fs from 'node:fs';
import { stat, lstat, glob } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = fs.mkdtempDisposableSync(join(tmpdir(), 'nsk-'));
fs.mkdirSync(join(dir.path, 'a/b'), { recursive: true });
for (const p of ['top.js', 'a/one.js', 'a/b/two.js']) fs.writeFileSync(join(dir.path, p), '');

// maxDepth: cwd is depth 0, so 1 = direct children only (0 matches nothing here).
assert.deepEqual(fs.globSync('**/*.js', { cwd: dir.path, maxDepth: 1 }), ['top.js']);
assert.deepEqual(fs.globSync('**/*.js', { cwd: dir.path, maxDepth: 2 }).sort(), ['a/one.js', 'top.js']);
assert.deepEqual(await Array.fromAsync(glob('**/*.js', { cwd: dir.path, maxDepth: 0 })), []);

// openAsBlobSync: a file-backed Blob without awaiting.
fs.writeFileSync(join(dir.path, 'note.txt'), 'héllo');
const blob = fs.openAsBlobSync(join(dir.path, 'note.txt'), { type: 'text/plain' });
assert.equal(blob.size, 6);
assert.equal(blob.type, 'text/plain');
assert.equal(await blob.text(), 'héllo');

// Async stat can return undefined instead of throwing ENOENT (statSync had this since v14).
assert.equal(await stat(join(dir.path, 'missing'), { throwIfNoEntry: false }), undefined);
await assert.rejects(stat(join(dir.path, 'missing')), { code: 'ENOENT' });

// signal on stat/lstat.
await assert.rejects(lstat(dir.path, { signal: AbortSignal.abort() }), { name: 'AbortError' });

// Stats expose lazy Temporal.Instant getters: absent from Object.keys/JSON until first read.
const st = fs.statSync(join(dir.path, 'note.txt'));
assert.ok(!Object.keys(st).includes('mtimeInstant'));
assert.equal(st.mtimeInstant.constructor.name, 'Instant');
assert.equal(st.mtimeInstant.epochMilliseconds, Math.trunc(st.mtimeMs));
const big = fs.statSync(join(dir.path, 'note.txt'), { bigint: true });
assert.equal(big.mtimeInstant.epochNanoseconds, big.mtimeNs);          // full precision with bigint
