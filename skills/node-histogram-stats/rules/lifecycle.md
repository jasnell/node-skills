# Lifecycle: snapshot, diff, subtract, export/import, workers

## Classes

- `RecordableHistogram` comes from `createHistogram()` or `importHistogram()`.
  It has `record`, `recordDelta`, `recordCorrected`, `add` and `subtract`.
- `ELDHistogram` comes from `monitorEventLoopDelay()`. It has `enable`,
  `disable` and `[Symbol.dispose]` (v24.2.0). Over a MessagePort it is cloned as
  a plain `Histogram`.
- `Histogram` is read-only. `snapshot()`, `diff()` and
  `slidingWindow.snapshot()` return it.

## `snapshot()` / `diff(older)` / `resetCount` (v26.11.0 only)

- `snapshot()` is an independent copy that includes the configuration,
  `exceeds` and the EWMA state. Later `record()`/`reset()` calls do not change
  it. Its cost scales with `lowest`/`highest`/`figures`, not with the count.
- `newer.diff(older)` returns the values recorded in between (`count`,
  `exceeds` and the buckets are differences). It has no EWMA state and its
  `resetCount` is `0`. Errors (verified):
  - `ERR_INVALID_ARG_VALUE`: a different `lowest`/`highest`/`figures`, or the
    wrong order (`older.diff(newer)`).
  - `ERR_INVALID_STATE`: the `resetCount` differs because there was a
    `reset()` or `subtract()` in between.
- `resetCount` is incremented by `reset()` and, on a recordable histogram, by
  `subtract()`.

Periodic reporting without resetting:

```js
let prev = h.snapshot();
setInterval(() => {
  const cur = h.snapshot();
  const d = cur.resetCount === prev.resetCount ? cur.diff(prev) : cur;
  emit(d.percentile(99));
  prev = cur;
}, 10_000).unref();
```

## `add` / `subtract`

- `add(other)` (v17.4.0) accepts only a `RecordableHistogram`. Passing a
  snapshot throws `ERR_INVALID_ARG_TYPE`. Observed: a different `figures`
  setting is accepted silently, so keep configurations identical yourself.
- `subtract(other)` (v26.8.0, v24.21.0) mutates the histogram. Negative bucket
  counts clamp to 0, and `resetCount` goes up by one.

## `export()` (v26.9.0; format v2 since v26.11.0) / `importHistogram(bytes)` (v26.9.0, v24.22.0)

- `export()` returns a `Uint8Array` with a CBOR map of integer keys: 0 version
  (2), 1 lowest, 2 highest, 3 figures, 4 count, 5 min, 6 max, 7 normalizing
  offset, 8 conversion ratio, 9 counts length, 10 sparse delta counts, and 11
  EWMA state (omitted when disabled). The size scales with the number of
  distinct values.
- `importHistogram()` returns a **RecordableHistogram** with the buckets,
  configuration and EWMA restored. It accepts v1 (v26.9.0 output, strict keys)
  and v2 (unknown keys are ignored). Other versions are rejected.
- The YAML lists `export()` only for v26.9.0, while `importHistogram` also
  lists v24.22.0. Feature-detect `typeof h.export === 'function'` on v24.

## Merging from workers

Histograms are cloneable over `postMessage`. Verified: a
`RecordableHistogram` arrives as a `RecordableHistogram`, so you can post it
directly. To send it across processes or store it, post `h.export()` and call
`total.add(importHistogram(bytes))` on the receiving side. Use one shared
`{ lowest, highest, figures }` configuration on every worker.

## bigint variants

`countBigInt`, `minBigInt`, `maxBigInt`, `exceedsBigInt`,
`percentileBigInt(p)` and `percentilesBigInt` exist (v17.4.0). `record()` and
`recordCorrected()` accept bigint. The new statistics methods take and return
numbers only. `qrde().count` is a bigint.
