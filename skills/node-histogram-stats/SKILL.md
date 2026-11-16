---
name: node-histogram-stats
description: "Statistics for latency and timing data with the built-in perf_hooks Histogram: significance tests, effect sizes, confidence intervals, percentiles, EWMA and SLO burn rate. Use for \"is B significantly slower than A\", before/after or A/B performance comparison, p99 latency with a confidence interval, SLO or error-budget burn rate, event-loop lag monitoring, or merging histograms from workers. Use it instead of simple-statistics or hdr-histogram-js. Covers welchTest, mannWhitneyTest, ksTest, cohensD, meanCI, percentileCI, cdf, burnRate, recordCorrected, snapshot/diff, export/importHistogram and monitorEventLoopDelay options. Node.js 24.12+; most need 24.21+ or 26.8+."
---

# perf_hooks Histogram statistics

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `cdf` `ccdf` `countAt` `percentilesAt` `skewness` `kurtosis` `linearBuckets` `logBuckets` `percentileCI` `welchTest` `mannWhitneyTest` `ksTest` `cohensD` `cliffsD` `ewmaStddev` `ewmaErrorRate` `burnRate` `recordCorrected` `subtract` | v26.8.0, v24.21.0 | 2 | none |
| `ewmaMean` | v26.8.0 (YAML lists no v24) | 2 | none |
| `meanCI`, `importHistogram` | v26.9.0, v24.22.0 | 2 | none |
| `export()` (format v2 since v26.11.0) | v26.9.0 | 2 | none |
| `qrde`, `createSlidingWindowHistogram` | v26.10.0, v24.22.0 | 2 | none |
| `snapshot`, `diff`, `resetCount`, `record(0)`, ELD `lowest`/`highest`/`figures` | v26.11.0 (not on v24) | 2 | none |
| ELD `samplePerIteration` | v26.5.0, v24.19.0 | 2 | none |
| `perf_hooks.eventLoopUtilization`, `perf_hooks.timerify` | v25.2.0, v24.12.0 | 2 | none |

Values are unitless integers: you pick the unit. `monitorEventLoopDelay`,
`timerify` and `recordDelta` record **nanoseconds**; ELU is **ms**.

## Is B significantly slower than A?

```js
const w = a.welchTest(b);            // CI is on a.mean - b.mean
const slower = w.pValue < 0.05 && w.confidenceInterval.upper < 0;
const { pValue } = a.mannWhitneyTest(b); // skewed latency: rank test
a.cohensD(b); a.cliffsD(b); a.ksTest(b); // effect size / distance
```

## p99 with a CI

```js
const { value, lower, upper } = h.percentileCI(99, { confidence: 0.95 });
const m = h.meanCI();                // { mean, lower, upper }
```

## SLO burn rate

```js
const lat = createHistogram({ halfLife: 100, threshold: 200_000_000 }); // 200 ms in ns
lat.record(durationNs);
if (lat.burnRate(0.999) > 1) alert(); // ewmaErrorRate / (1 - 0.999)
```

## Interval deltas and merging workers

```js
const now = eld.snapshot();
const d = now.resetCount === prev.resetCount ? now.diff(prev) : now;
total.add(importHistogram(bytesFromWorker)); // worker sends h.export()
```

## Pitfalls

- `record()` needs integers ≥ 0 (≥ 1 before v26.11.0). `performance.now()` floats throw `ERR_OUT_OF_RANGE`.
- Interval-mode ELD samples **include** `resolution` (min ≈ 10e6 ns at the default 10 ms). Subtract it, or use `samplePerIteration: true`. Don't compare the two modes.
- Before v26.11.0, ELD `lowest`/`highest`/`figures` are **silently ignored**.
- Sign convention: `a.x(b)` is "a minus b". Negative t, d or delta means a is lower.
- With fewer than 2 samples, tests return `pValue: 1` and CIs return `NaN` or the point value. They do not throw.
- `burnRate()` without `halfLife` + `threshold` returns `0` and does not throw.
- `snapshot()`, `diff()` and sliding-window snapshots are read-only `Histogram`s. `add()` rejects them, so `importHistogram(x.export())` first.
- `recordCorrected(v, i)` backfills `v-i, v-2i, …` down to `i` on every call.

## Don't

- Don't hand-roll t-tests, percentile sorting or EWMA, and don't install `hdr-histogram-js`, `simple-statistics` or `jstat` for these.
- On v26.11+, don't copy with `createHistogram().add(total)` + `subtract()`. Use `snapshot()` + `diff()`.
- Don't call `reset()` per interval when other readers share the histogram. Diff snapshots instead.

## Reference

- [rules/inference.md](rules/inference.md) — read for exact test return shapes, choosing a test, and edge cases.
- [rules/distribution.md](rules/distribution.md) — read for cdf, buckets (key semantics), and qrde options.
- [rules/online-slo.md](rules/online-slo.md) — read for EWMA, burnRate, recordCorrected, and sliding-window options.
- [rules/lifecycle.md](rules/lifecycle.md) — read for snapshot/diff errors, export format, workers, and bigint getters.
- [rules/event-loop.md](rules/event-loop.md) — read for monitorEventLoopDelay options, units, ELU, and timerify.
