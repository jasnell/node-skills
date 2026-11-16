// @node-skills {"added":["v26.9.0","v24.22.0"]}
// "Is B significantly slower than A?" plus p99/mean confidence intervals.
import { createHistogram } from 'node:perf_hooks';
import assert from 'node:assert/strict';

// Deterministic pseudo-random latencies in nanoseconds (integers only).
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const a = createHistogram();
const b = createHistogram();
for (let i = 0; i < 500; i++) {
  a.record(1_000_000 + Math.floor(rand() * 200_000)); // ~1.1 ms
  b.record(1_150_000 + Math.floor(rand() * 200_000)); // ~1.25 ms
}

// Welch: CI is on (this.mean - other.mean); negative => `a` is faster.
const w = a.welchTest(b);
assert.deepEqual(Object.keys(w), ['tStatistic', 'degreesOfFreedom', 'pValue', 'confidenceInterval']);
assert.ok(w.pValue < 0.05);
assert.ok(w.tStatistic < 0 && w.confidenceInterval.upper < 0);
assert.ok(a.welchTest(b, { confidence: 0.99 }).confidenceInterval.lower < w.confidenceInterval.lower);

// Mann-Whitney (rank based, no normality assumption).
const mw = a.mannWhitneyTest(b);
assert.deepEqual(Object.keys(mw), ['uStatistic', 'zScore', 'pValue']);
assert.ok(mw.pValue < 0.05 && mw.zScore < 0);

// Effect sizes and distribution distance: sign is "this minus other".
assert.ok(a.cohensD(b) < -0.8); // large effect, a lower
assert.ok(a.cliffsD(b) < 0 && a.cliffsD(b) >= -1);
assert.ok(a.ksTest(b) > 0.5 && a.ksTest(b) <= 1);
assert.equal(a.ksTest(a), 0);

// p99 with a 95% CI (exact binomial) and the mean with a Student's t CI.
const p99 = a.percentileCI(99);
assert.deepEqual(Object.keys(p99), ['value', 'lower', 'upper']);
assert.equal(p99.value, a.percentile(99));
assert.ok(p99.lower <= p99.value && p99.value <= p99.upper);
const m = a.meanCI({ confidence: 0.99 });
assert.deepEqual(Object.keys(m), ['mean', 'lower', 'upper']);
assert.equal(m.mean, a.mean);

// Too few samples: no exception, "not significant" values instead.
const one = createHistogram();
one.record(5);
assert.equal(one.welchTest(a).pValue, 1);
assert.equal(one.cohensD(a), 0);
assert.ok(Number.isNaN(one.meanCI().lower));
assert.equal(one.percentileCI(99).lower, 5);

// Values must be integers; floats (e.g. performance.now() ms) throw.
assert.throws(() => a.record(1.5), { code: 'ERR_OUT_OF_RANGE' });
