// @node-skills {"added":["v26.11.0"]}
// snapshot/diff/resetCount, subtract/add, export/importHistogram, worker merge.
import { createHistogram, importHistogram } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import assert from 'node:assert/strict';

const live = createHistogram({ halfLife: 5 });
live.record(1);
const s1 = live.snapshot();
live.record(2);
live.record(3);
const s2 = live.snapshot();
assert.equal(s2.constructor.name, 'Histogram'); // read-only: no record()/add()
assert.equal(typeof s2.record, 'undefined');

const delta = s2.diff(s1); // newer.diff(older)
assert.equal(delta.count, 2);
assert.equal(delta.min, 2);
assert.equal(delta.resetCount, 0);
assert.equal(delta.ewmaMean, 0); // diff has no EWMA state
assert.ok(s2.ewmaMean > 0); // snapshot keeps EWMA state
assert.throws(() => s1.diff(s2), { code: 'ERR_INVALID_ARG_VALUE' }); // wrong order
assert.throws(() => s2.diff(createHistogram({ figures: 2 }).snapshot()), { code: 'ERR_INVALID_ARG_VALUE' });

live.reset();
assert.equal(live.resetCount, 1);
assert.throws(() => live.snapshot().diff(s2), { code: 'ERR_INVALID_STATE' });

// subtract() mutates and bumps resetCount; add() needs a RecordableHistogram.
const t = createHistogram();
for (let i = 1; i <= 10; i++) t.record(i);
const u = createHistogram();
u.record(1);
u.record(2);
t.subtract(u);
assert.equal(t.count, 8);
assert.equal(t.resetCount, 1);
assert.throws(() => t.add(s2), { code: 'ERR_INVALID_ARG_TYPE' });

// record(0) is allowed since v26.11.0.
const z = createHistogram();
z.record(0);
assert.equal(z.min, 0);

// export(): CBOR Uint8Array (format v2); importHistogram() -> RecordableHistogram.
const bytes = live.snapshot().export();
assert.ok(bytes instanceof Uint8Array);
assert.equal(bytes[0] >> 5, 5); // CBOR major type 5 (map)
const h = createHistogram({ halfLife: 10, threshold: 200 });
for (let i = 1; i <= 1000; i++) h.record(i);
const back = importHistogram(h.export());
assert.equal(back.constructor.name, 'RecordableHistogram');
assert.equal(back.count, 1000);
assert.equal(back.percentile(99), h.percentile(99));
assert.equal(back.ewmaErrorRate, h.ewmaErrorRate);
back.record(5); // still recordable

// Merge histograms from workers: post export() bytes (or the histogram itself).
const src = `
const { createHistogram } = require('node:perf_hooks');
const { parentPort, workerData } = require('node:worker_threads');
const h = createHistogram();
for (let i = 1; i <= 100; i++) h.record(i * workerData);
parentPort.postMessage(h.export());`;
const total = createHistogram();
await Promise.all([1, 2].map((n) => new Promise((resolve, reject) => {
  const w = new Worker(src, { eval: true, workerData: n });
  w.once('message', (data) => { total.add(importHistogram(data)); resolve(); });
  w.once('error', reject);
})));
assert.equal(total.count, 200);
assert.equal(total.max, 200);
