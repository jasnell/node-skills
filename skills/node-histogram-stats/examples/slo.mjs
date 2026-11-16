// @node-skills {"added":["v26.10.0","v24.22.0"]}
// SLO burn rate with EWMA, coordinated-omission correction, sliding windows.
import { createHistogram, createSlidingWindowHistogram } from 'node:perf_hooks';
import assert from 'node:assert/strict';

// threshold uses the unit you record (here ns: 200 ms); halfLife is in samples.
const lat = createHistogram({ halfLife: 10, threshold: 200_000_000 });
for (let i = 0; i < 100; i++) lat.record(100_000_000);
assert.equal(lat.ewmaErrorRate, 0);
assert.equal(lat.burnRate(0.999), 0);
for (let i = 0; i < 10; i++) lat.record(300_000_000); // one half-life of errors
assert.ok(Math.abs(lat.ewmaErrorRate - 0.5) < 1e-9);
assert.ok(Math.abs(lat.burnRate(0.99) - 50) < 1e-6); // 0.5 / (1 - 0.99)
assert.ok(lat.ewmaStddev > 0);
assert.throws(() => lat.burnRate(1), { code: 'ERR_OUT_OF_RANGE' });
// Without halfLife+threshold it does not throw: it returns 0.
assert.equal(createHistogram().burnRate(0.999), 0);

// recordCorrected(v, interval) also records v - interval, v - 2*interval, ...
// down to interval (HdrHistogram semantics), independent of earlier values.
const rc = createHistogram();
rc.recordCorrected(1000, 100);
assert.equal(rc.count, 10);
assert.equal(rc.min, 100);
rc.recordCorrected(50, 100); // below interval: recorded once
assert.equal(rc.count, 11);

// Count-based sliding window: 2 chunks x 2 records; over-`highest` values count.
const win = createSlidingWindowHistogram({ chunks: 2, recordsPerChunk: 2, highest: 100 });
for (const v of [1, 1000, 2, 1000, 3]) win.record(v);
const snap = win.snapshot(); // a plain Histogram; the window itself has no stats
assert.equal(snap.constructor.name, 'Histogram');
assert.equal(snap.count, 2);
assert.equal(snap.exceeds, 1);
assert.equal(typeof win.percentile, 'undefined');
assert.throws(() => createSlidingWindowHistogram({ chunks: 3 }), { code: 'ERR_INVALID_ARG_VALUE' });

// Time-based window: chunkDuration is in milliseconds; rotation is lazy.
const tw = createSlidingWindowHistogram({ chunks: 2, chunkDuration: 20 });
tw.record(5);
assert.equal(tw.snapshot().count, 1);
await new Promise((r) => setTimeout(r, 60));
assert.equal(tw.snapshot().count, 0);
