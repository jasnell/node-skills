// @node-skills {"added":["v26.9.0"],"flags":["--experimental-bench","--no-warnings"]}
// Measurement model, suites, hooks, record()/done(), failures, result shape.
import { createRunner } from 'node:bench';
import assert from 'node:assert/strict';

const order = [];
const r = createRunner(); // explicit runner: nothing runs until r.run()
r.suite('parse', { tags: ['JSON'] }, () => {
  r.before(() => order.push('before'));
  r.beforeEach(({ name }) => order.push(`beforeEach:${name}`)); // per benchmark, not per sample
  r.after(() => order.push('after'));
  r.bench('small', { samples: 5, warmup: 2, params: { size: 10 } }, (b) => {
    const input = JSON.stringify({ a: [1, 2, 3] }); // setup: outside the timed region
    const ops = 1000;
    let total = 0;
    b.start();
    for (let i = 0; i < ops; i++) total += JSON.parse(input).a.length;
    b.end(ops); // pass operations explicitly (required on v26.13.0)
    assert.equal(total, 3 * ops); // keep the result observable
  });
  r.bench('external', { samples: 3, warmup: 0 }, (b) => {
    b.record({ operations: 2, duration_ns: 1000n }); // externally measured
  });
  r.bench('adaptive', { samples: 100, warmup: 0 }, (b) => {
    b.start();
    b.end(1);
    if (b.index === 2) b.done(); // stop after this sample
  });
  r.bench('broken', { samples: 2, warmup: 0 }, (b) => b.start()); // never calls end()
  r.bench.skip('later', (b) => {});
});

const seen = {};
const results = {};
let summary;
for await (const { type, data } of r.run()) {
  seen[type] = (seen[type] ?? 0) + 1;
  if (type === 'bench:complete') results[data.name] = data;
  if (type === 'bench:summary') summary = data;
}
assert.deepEqual(order, ['before', 'beforeEach:small', 'beforeEach:external', 'beforeEach:adaptive', 'beforeEach:broken', 'after']);
assert.equal(seen['bench:plan'], 5);

const small = results.small;
assert.deepEqual(small.namePath, ['parse', 'small']);
assert.deepEqual(small.tags, ['json']); // lowercased
assert.equal(small.samples.length, 5); // warmups are not reported
const [s0] = small.samples;
assert.equal(typeof s0.duration_ns, 'bigint');
assert.equal(s0.operations, 1000);
assert.ok(Math.abs(s0.rate - 1e9 * 1000 / Number(s0.duration_ns)) < 1e-3 * s0.rate); // ops/second
for (const k of ['mean', 'median', 'min', 'max', 'stddev', 'coefficientOfVariation', 'confidenceInterval', 'medianConfidenceInterval', 'skewness']) {
  assert.ok(k in small.summary, k);
}
assert.equal(results.external.samples[0].rate, 2e6);
assert.equal(results.adaptive.samples.length, 3);
assert.match(results.broken.error.message, /did not call end\(\)/);
assert.equal(results.later.skip, true);
assert.deepEqual({ ...summary.counts }, { completed: 3, failed: 1, skipped: 1, total: 5 });
assert.equal(summary.success, false);
assert.equal(process.exitCode, undefined); // explicit runners leave the exit code alone
assert.throws(() => r.run(), { code: 'ERR_INVALID_STATE' }); // single use
