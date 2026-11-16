# Measurement model and comparing results

## Model

- Each warmup call and each measured call invokes `fn` once with a new
  context. Only the span between `start()` and `end()` is timed. Setup before
  `start()` and checks after `end()` are free.
- Batch inside each sample: run N operations between `start()` and `end(N)` so
  that timer reads and call overhead are amortized. One operation per sample
  measures mostly framework overhead.
- By default the runner yields a macrotask between samples. Turn this off with
  `createRunner({ yieldBetweenSamples: false })`, which also stops timer-based
  abort signals from firing between synchronous samples.
- `warmup` (default 10) does not guarantee a stable optimization tier. Look at
  the raw `samples` for a downward trend and raise `warmup` if early samples
  are slow.
- Variable batch sizes: `summary.mean` weights every sample equally. Pooled
  throughput is `1e9 * Σoperations / Σduration_ns`. Sum the operations as
  bigint.

## GC modes (`gc` option or `--bench-gc`; main only)

- `'none'` (default).
- `'once'`: a full GC after warmup. Garbage from measured samples is still
  collected during measurement.
- `'sample'`: a full GC before every sample. Variance is lower, but
  allocation-heavy code can look faster than it is in production.
- Both forced modes need `--expose-gc`. Without it the benchmark fails with
  "the 'once' gc mode requires the --expose-gc flag" (verified). Forced GC runs
  outside the timed region and outside the timeout.

## Integrity

- Make results observable: validate an aggregate after `end()`, or call
  `doNotOptimize(result)` (main only). Unused local computation is not enough.
- Vary inputs when the work is loop-invariant. `doNotOptimize` does not stop
  hoisting.
- `implausible` in the `spec` table (≥ 1 op/ns) almost always means the work
  was eliminated.
- There is no process isolation within one file. Other work in the process,
  JIT, GC, CPU frequency and load all affect results.

## Comparing A vs B

`node:bench` never names a baseline or gives a pass/fail verdict. Match runs by
`benchId` (source file + namePath + params) and keep the raw samples. To test
significance, convert the samples to integers and use the Histogram statistics
(see the **node-histogram-stats** skill):

```js
import { createHistogram } from 'node:perf_hooks';
const toHist = (samples) => {
  const h = createHistogram();
  for (const s of samples) h.record(Math.max(1, Math.round(Number(s.duration_ns) * 1000 / s.operations))); // ps/op
  return h;
};
const a = toHist(resultA.samples), b = toHist(resultB.samples);
const { pValue, confidenceInterval } = b.welchTest(a); // CI on b - a (ps/op)
const bSlower = pValue < 0.05 && confidenceInterval.lower > 0;
const effect = b.cliffsD(a); // or b.mannWhitneyTest(a) for skewed samples
```

- Histograms only take integers. Record time per op in ns or ps, not
  fractional `rate` values.
- Samples within a run are independent: use Welch or Mann-Whitney. Use a paired
  analysis only for deliberately paired runs.
- When you compare many benchmarks, correct for multiple tests and report the
  effect size next to the p-value.
