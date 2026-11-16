# Online stats: EWMA, burn rate, coordinated omission, sliding windows

## EWMA options on `createHistogram`

`createHistogram({ halfLife, threshold })`. The YAML has no `changes:` entry
for these options. They ship with the EWMA getters (v26.8.0; v24.21.0 for most
getters).

- `halfLife` is in **samples**, not time. After `halfLife` recordings, a value
  has 50% influence. The default `0` disables EWMA.
- `threshold` uses the same unit as the recorded values (for example 200 ms as
  `200_000_000` ns). It needs `halfLife`.
- `ewmaMean` (YAML: v26.8.0 only), `ewmaStddev`, `ewmaErrorRate` (v26.8.0,
  v24.21.0). They are `0` when disabled or when no values are recorded.
- `burnRate(sloTarget)` (v26.8.0, v24.21.0) is
  `ewmaErrorRate / (1 - sloTarget)`. `sloTarget` must be in (0, 1), otherwise
  it throws `ERR_OUT_OF_RANGE`. A value above 1 means the error budget burns
  faster than allowed. **Verified:** without `halfLife` and `threshold` it
  returns `0` and does not throw.

Verified: with `halfLife: 10`, 100 records of 100 followed by 10 records of 300
give `ewmaMean === 200` and `ewmaErrorRate ≈ 0.5`, with the threshold at 200.

EWMA state survives `snapshot()` and `export()`/`importHistogram()`. `diff()`
results have no EWMA state.

## `recordCorrected(val, expectedInterval)` (v26.8.0, v24.21.0)

This is HdrHistogram coordinated-omission correction. **Verified behavior:**
each call records `val`, then `val - i`, `val - 2i`, … while the value is
`>= i`. It does not depend on earlier records:

- `recordCorrected(1000, 100)` records 10 values (1000, 900, …, 100).
- `recordCorrected(950, 100)` then `recordCorrected(1000, 100)` records 19.
- A value below `expectedInterval` is recorded once.

Use it when a load generator sends at a fixed rate and a stall delays
measurement. `expectedInterval` is the intended send interval, in the same unit.

## `createSlidingWindowHistogram(options)` (v26.10.0, v24.22.0)

- `chunks` is 1-1024. Pass **exactly one** of `chunkDuration` (ms) and
  `recordsPerChunk`. Passing both or neither throws `ERR_INVALID_ARG_VALUE`.
  `lowest`, `highest` and `figures` work as in `createHistogram`.
- Methods: `record(val)`, `snapshot()` → `Histogram`, and `reset()`. There are
  no stats on the window itself, so always use `snapshot()`. The window cannot
  be constructed directly (`ERR_ILLEGAL_CONSTRUCTOR`) or sent over a MessagePort.
- Rotation is lazy and uses no timer. A time window keeps a value for between
  `(N-1)*D` and `N*D` ms. A count window keeps between `(N-1)*C+1` and `N*C`
  attempts, and attempts above `highest` count toward rotation (verified: they
  show up in `snapshot().exceeds`).

```js
const win = createSlidingWindowHistogram({ chunks: 6, chunkDuration: 10_000 }); // ~last 60 s
win.record(latencyNs);
const s = win.snapshot();
report(s.percentile(99), s.ccdf(slo));
```
