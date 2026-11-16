// @node-skills {"added":["v26.10.0","v24.22.0"]}
// cdf/ccdf, batch percentiles, rebucketing and the qrde density estimate.
import { createHistogram } from 'node:perf_hooks';
import assert from 'node:assert/strict';

const h = createHistogram();
for (let v = 1000; v < 1100; v++) for (let k = 0; k < 10; k++) h.record(v);

assert.equal(h.cdf(1049), 0.5); // P(X <= 1049)
assert.equal(h.ccdf(1049), 0.5); // P(X > 1049)
assert.equal(h.countAt(1050), 10);

const p = h.percentilesAt([50, 99]);
assert.ok(p instanceof Map);
assert.equal(p.get(50), h.percentile(50));
assert.equal(p.get(99), h.percentile(99));

// Map keys are inclusive upper bounds: key k counts values in (k - step, k].
const lin = h.linearBuckets(50);
assert.equal(lin.get(1000), 10);
assert.equal(lin.get(1050), 500);
assert.equal(lin.get(1100), 490);
// logBuckets(first, base): first key holds everything <= first.
assert.deepEqual([...h.logBuckets(1000, 2)], [[1000, 10], [2000, 990]]);

assert.equal(typeof h.skewness, 'number');
assert.equal(typeof h.kurtosis, 'number');

// qrde is async (runs on the libuv thread pool).
const q = await h.qrde({ bins: 4 });
assert.ok(q.probabilities instanceof Float64Array);
assert.deepEqual([...q.probabilities], [0, 0.25, 0.5, 0.75, 1]);
assert.equal(q.quantiles.length, 5);
assert.equal(q.densities.length, 4);
assert.equal(q.count, 1000n); // bigint
assert.equal(q.dequantize, 'hdr');
const tail = await h.qrde({ probabilities: [0, 0.9, 0.99, 1] });
assert.equal(tail.densities.length, 3);
