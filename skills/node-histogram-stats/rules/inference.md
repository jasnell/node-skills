# Inference: comparing two histograms

All methods take another `Histogram` (a `RecordableHistogram`, an
`ELDHistogram`, or a snapshot). Results are null-prototype objects. Signs always
mean **this minus other**.

| Method | Versions | Returns |
| --- | --- | --- |
| `welchTest(other[, { confidence = 0.95 }])` | v26.8.0, v24.21.0 | `{ tStatistic, degreesOfFreedom, pValue, confidenceInterval: { lower, upper } }` |
| `mannWhitneyTest(other)` | v26.8.0, v24.21.0 | `{ uStatistic, zScore, pValue }` |
| `ksTest(other)` | v26.8.0, v24.21.0 | number D in [0, 1]; 0 means identical |
| `cohensD(other)` | v26.8.0, v24.21.0 | number; positive means this mean is higher |
| `cliffsD(other)` | v26.8.0, v24.21.0 | number in [-1, 1]; P(this > other) - P(other > this) |
| `meanCI([{ confidence = 0.95 }])` | v26.9.0, v24.22.0 | `{ mean, lower, upper }` (Student's t) |
| `percentileCI(p[, { confidence = 0.95 }])` | v26.8.0, v24.21.0 | `{ value, lower, upper }` (exact binomial) |

Verified behavior (main and v26.13.0):

- `welchTest`: `pValue` is two-tailed. `confidenceInterval` bounds the
  difference of means (`this.mean - other.mean`). If `upper < 0`, this is
  significantly lower. If `lower > 0`, it is significantly higher.
  `degreesOfFreedom` is Welch-Satterthwaite.
- `mannWhitneyTest`: `uStatistic` counts pairs where this > other (ties count
  half). `zScore < 0` means this tends to be lower. It uses the normal
  approximation with tie correction.
- With fewer than 2 values in either histogram, `welchTest` returns
  `{ tStatistic: 0, degreesOfFreedom: 0, pValue: 1, confidenceInterval: { lower: 0, upper: 0 } }`
  and `cohensD` returns `0`.
- An empty `meanCI()` returns `{ mean: NaN, lower: NaN, upper: NaN }`. With one
  value, `lower` and `upper` are `NaN`. When all values are equal, both equal
  `mean`.
- With fewer than 2 values, `percentileCI` returns `lower === upper === value`,
  and an empty histogram gives all `0`. `value` equals `percentile(p)`.
- `confidence` must be in (0, 1).

## Choosing

- Latency is usually right-skewed and multimodal. Use `mannWhitneyTest` or
  `ksTest` first. Use `welchTest` for means of many roughly normal samples,
  such as per-run throughput.
- Always report an effect size (`cohensD` or `cliffsD`) next to a p-value. With
  thousands of samples, tiny differences become "significant".
- When comparing many benchmarks, correct for multiple tests (for example,
  Bonferroni: `pValue < 0.05 / n`).
- HDR buckets quantize values to `figures` significant digits (default 3), and
  the stats run on the bucket values, not the raw values.

## Feeding benchmark results

Benchmark rates are floats, so record an integer unit, for example ns per
operation: `h.record(Math.round(Number(s.duration_ns) / s.operations))`.
See the `node-bench` skill for where the samples come from.
