// @node-skills {"added":["v26.9.0"],"flags":["--experimental-bench","--no-warnings"]}
// Compare two benchmarks statistically: samples -> Histogram -> welchTest/mannWhitneyTest.
import { createRunner } from 'node:bench';
import { createHistogram } from 'node:perf_hooks';
import assert from 'node:assert/strict';

const r = createRunner();
const arr = Array.from({ length: 2000 }, (_, i) => i);
let sink = 0;
r.bench('for-loop', { samples: 30, warmup: 5 }, (b) => {
  b.start();
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  b.end(arr.length);
  sink += s;
});
r.bench('slow-sum', { samples: 30, warmup: 5 }, (b) => {
  b.start();
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += JSON.parse(String(arr[i])); // deliberately slower
  b.end(arr.length);
  sink += s;
});

const hist = {};
for await (const { type, data } of r.run()) {
  if (type !== 'bench:complete' || data.error) continue;
  // Histograms need integers: record picoseconds per operation, not float rates.
  const h = createHistogram();
  for (const s of data.samples) h.record(Math.max(1, Math.round(Number(s.duration_ns) * 1000 / s.operations)));
  hist[data.name] = h;
}
assert.ok(sink > 0);
const a = hist['for-loop'];
const b = hist['slow-sum'];
const w = b.welchTest(a); // CI on b.mean - a.mean (ps/op)
assert.ok(w.pValue < 0.05 && w.confidenceInterval.lower > 0, 'slow-sum should be slower');
assert.ok(b.mannWhitneyTest(a).pValue < 0.05);
assert.ok(b.cliffsD(a) > 0.5);
