// @node-skills {"added":["v26.9.0"],"flags":["--experimental-bench","--no-warnings","--expose-gc"]}
// Version-dependent pieces: doNotOptimize, the gc option, and end()/record() defaults.
import * as bench from 'node:bench';
import assert from 'node:assert/strict';

const r = bench.createRunner();
r.bench('gc', { samples: 2, warmup: 1, gc: 'once' }, (b) => { b.start(); b.end(1); });
r.bench('default-ops', { samples: 1, warmup: 0 }, (b) => { b.start(); b.end(); });
const plan = {};
const done = {};
for await (const { type, data } of r.run()) {
  if (type === 'bench:plan') plan[data.name] = data;
  if (type === 'bench:complete') done[data.name] = data;
}

if (typeof bench.doNotOptimize === 'function') {
  // main (added: REPLACEME): doNotOptimize, `gc` option, end() defaults to 1 operation.
  assert.equal(bench.doNotOptimize(42), 42);
  assert.equal(plan.gc.gc, 'once');
  assert.equal(done['default-ops'].samples[0].operations, 1);
} else {
  // v26.13.0: no doNotOptimize, `gc` is silently ignored, operations are required.
  assert.equal(plan.gc.gc, undefined);
  assert.match(done['default-ops'].error.message, /"operations" argument must be of type number/);
}
