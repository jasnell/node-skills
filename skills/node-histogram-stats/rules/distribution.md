# Distribution queries

| API | Versions | Returns |
| --- | --- | --- |
| `cdf(v)` | v26.8.0, v24.21.0 | P(X <= v), a number in [0, 1] |
| `ccdf(v)` | v26.8.0, v24.21.0 | P(X > v) = `1 - cdf(v)` |
| `countAt(v)` | v26.8.0, v24.21.0 | count in the HDR bucket equivalent to `v` |
| `percentilesAt([p...])` | v26.8.0, v24.21.0 | `Map<p, value>` computed in one pass |
| `skewness`, `kurtosis` (excess) | v26.8.0, v24.21.0 | number getters |
| `linearBuckets(step)` | v26.8.0, v24.21.0 | `Map<upperBound, count>` |
| `logBuckets(first, base)` | v26.8.0, v24.21.0 | `Map<upperBound, count>`, `base > 1` |
| `qrde([options])` | v26.10.0, v24.22.0 | `Promise<object>` |

- The query arguments are **numbers**. A bigint passed to `cdf` throws
  `ERR_INVALID_ARG_TYPE`.
- Bucket map keys are **inclusive upper bounds** (verified). With step 50,
  key `1050` counts values in (1000, 1050], and the first key is `step`. In
  `logBuckets`, the first key `first` holds every value `<= first`, and each
  later key multiplies the previous one by `base`.
- An empty histogram: `cdf()` returns `0`, `mean` is `NaN`, `min` is
  `9223372036854776000`, and `max` is `0`. Check `count` first.

## `qrde` (Harrell-Davis quantile-respectful density estimate)

Options: `bins` (1-1000, default 100) **or** `probabilities` (2-1001 strictly
increasing values from `0` to `1`); `dequantize` `'none' | 'hdr' | 'all'`
(default `'hdr'`); `cache` (default `false`, reuse the expanded snapshot while
the histogram is unchanged).

Result: `{ probabilities: Float64Array, quantiles: Float64Array (n + 1),
densities: Float64Array (n), count: bigint, bucketCount, corrections,
dequantize }`. It runs on the libuv thread pool. Memory grows quickly with
`figures` (about 1.7 MiB at peak for `figures: 3` and about 185 MiB for
`figures: 5`), so lower `highest` or `figures` for large histograms. To focus
on the tail, pass `probabilities: [0, 0.9, 0.99, 0.999, 1]`.

An empty histogram returns the requested `probabilities` with empty
`quantiles`/`densities`.
