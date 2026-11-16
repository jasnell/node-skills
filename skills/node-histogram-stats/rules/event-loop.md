# Event-loop lag and utilization

## `monitorEventLoopDelay([options])` returns an `ELDHistogram` (nanoseconds)

| Option | Versions | Default | Notes |
| --- | --- | --- | --- |
| `resolution` | v11.10.0 | `10` ms | interval sampling; ignored when `samplePerIteration` is set |
| `samplePerIteration` | v26.5.0, v24.19.0 | `false` | one sample per loop turn (prepare/check hooks); does not keep the loop alive |
| `lowest` | v26.11.0 | `1` (per-iteration) or `1000` | ns, > 0 |
| `highest` | v26.11.0 | `2n ** 63n - 1n` | ns, >= 2 * lowest; larger delays only go to `exceeds` |
| `figures` | v26.11.0 | `3` | 1-5; out of range throws `ERR_OUT_OF_RANGE` |

Verified:

- In interval mode samples include the resolution: an idle loop at
  `resolution: 10` reports `min ≈ 10_000_000`. Lag is `value - resolution*1e6`.
  Timer jitter under CPU load can put individual samples slightly below the
  resolution (9.06 ms was observed), so clamp at 0 and don't assert on `min`.
  Set `highest` well above `resolution * 1e6`.
- The two modes give very different numbers. Don't compare or mix them.
- On v24.19.0 to v26.10.x, `lowest`/`highest`/`figures` are **accepted and
  ignored** (`figures: 9` doesn't throw), so don't rely on them there.
- Nothing is sampled until `enable()`. Use `using h = ...` (v24.2.0) to
  disable it on scope exit.

```js
import { monitorEventLoopDelay } from 'node:perf_hooks';
const eld = monitorEventLoopDelay({ samplePerIteration: true });
eld.enable();
setInterval(() => {
  const s = eld.snapshot?.() ?? eld;     // snapshot() needs v26.11.0
  log({ p99ms: s.percentile(99) / 1e6, maxms: s.max / 1e6 });
  if (!eld.snapshot) eld.reset();
}, 10_000).unref();
```

Combine with `snapshot()`/`diff()` from rules/lifecycle.md for per-interval
values without `reset()`.

## Top-level aliases (v25.2.0, v24.12.0)

`import { eventLoopUtilization, timerify } from 'node:perf_hooks'` gives the
same functions as `performance.eventLoopUtilization` and
`performance.timerify` (verified strict equality).

- `eventLoopUtilization([u1[, u2]])` returns `{ idle, active, utilization }`.
  `idle`/`active` are **milliseconds** and `utilization` is in 0-1. Pass a
  previous result to get the delta. Synchronous blocking (`spawnSync`) counts
  as fully active.
- `timerify(fn, { histogram })` records each call's duration into a
  `RecordableHistogram` in **nanoseconds**. A promise-returning `fn` is
  measured until it settles.
