# node:util additions

## `util.debounce(fn, wait[, options])` (v26.10.0, v24.22.0; not on v24.19)

The call returns a **Promise** for the value of `fn`. Every call made in one
window settles with the result of the single invocation, which receives the
**last** call's arguments. Verified: three calls `save(1)`, `save(2)`,
`save(3)` give `fn(3)` once, and all three promises resolve to its result.

| Option | Default | Effect |
| --- | --- | --- |
| `leading` | `false` | The first call of a window invokes `fn` immediately. A trailing invocation happens only if another call arrives within the window (verified: calls 1, 2, 3 invoke `fn(1)` and then `fn(3)`, while a single call invokes only `fn(1)`) |
| `rejectOnCancel` | `false` | Superseded calls reject with `AbortError` instead of sharing the result |
| `signal` | | Aborting rejects pending and future calls with `AbortError`, with the reason in `.cause`. An already-aborted signal makes `debounce()` throw |

Properties of the returned function:

| Member | Effect |
| --- | --- |
| `cancel([reason])` | Rejects the pending promises with `AbortError`, with `cause = reason` |
| `flush()` | Invokes `fn` now if a call is pending |
| `pending` | Promise of the latest call, or `null` |
| `pendingCount` | Number of calls waiting |
| `ref()`, `unref()` | Control whether the timer keeps the loop alive. Both return the function. Verified: after `unref()` the process exits and the pending promise never settles |

`this` inside `fn` is the debounced function. `name` and `length` are
preserved (verified).

## `util.throttle(fn, limit, interval[, options])` (v26.10.0, v24.22.0)

At most `limit` invocations start per `interval` ms. **Extra calls queue by
default and keep their arguments.** Verified: with `limit` 2 and `interval`
100, five calls start at about 0, 0, 100, 100 and 200 ms.

| Option | Default | Effect |
| --- | --- | --- |
| `overflow` | `'queue'` | `'drop'` rejects calls immediately when no capacity is available |
| `maxPending` | `Infinity` | When the queue is full, new calls are rejected (only with `'queue'`) |
| `concurrency` | `Infinity` | Maximum number of unsettled invocations. Capacity is released when the returned value settles |
| `strict` | `false` | Per the docs, uses a rolling window instead of fixed windows (no bursts at window edges) |
| `signal` | | Same as for debounce |

- Rejected calls (`'drop'` or a full `maxPending`) reject with
  `ERR_THROTTLED`. These promises are **already marked handled**, so
  ignoring them does not emit `unhandledRejection`.
- `limit` must be an integer ≥ 1. `throttle(fn, Infinity, ...)` throws
  `ERR_OUT_OF_RANGE` (verified). For "concurrency only", use a large integer
  `limit`.
- Members: `cancel([reason])` (rejects the queued calls, leaves started ones
  alone), `hasImmediateCapacity()`, `pending`, `pendingCount`, `activeCount`,
  `ref()` and `unref()`.
- It does not retry or apply backoff. It only limits when invocations start.

## `util.markPromiseAsHandled(promise)` (v26.10.0, v24.22.0)

Marks the promise so that a rejection does not emit
`process.on('unhandledRejection')`. Verified: the counter stays 0. Returns
`undefined`. This replaces `p.catch(() => {})`, which creates a new promise.

## `util.isPartialDeepStrictEqual(a, b)` (v26.11.0; not on v24)

This is the boolean form of `assert.partialDeepStrictEqual`: only the
properties present in `b` are compared, strictly. Verified:
- `({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } })` gives `true`.
- `({ a: 1 }, { a: '1' })` gives `false`.
- Arrays: `[1, 2, 3]` vs `[1, 3]` gives `true` (ordered subsequence), and vs
  `[3, 1]` gives `false`.
- Sets: `new Set([1, 2])` vs `new Set([2])` gives `true`.

## `util.isDeepStrictEqual(a, b, { skipPrototype })` (v24.9.0)

`skipPrototype: true` ignores prototype and constructor differences.

## `util.convertProcessSignalToExitCode(signal)` (v25.4.0, v24.14.0)

Returns `128 + signal number`, for example `'SIGTERM'` → 143 and `'SIGINT'` →
130. Unknown names and numbers throw `ERR_INVALID_ARG_VALUE`, so pass the
signal **name**. Use it to mirror a child's fate:
`process.exitCode = child.status ?? convertProcessSignalToExitCode(child.signal)`.

## `util.styleText` hex colors (v26.1.0, v24.16.0)

- `styleText('#f00', s)` and `styleText('#ff5733', s)` emit 24-bit
  `ESC[38;2;r;g;bm … ESC[39m`.
- They combine with modifiers: `styleText(['#00f', 'bold'], s)`.
- Only `#RGB` and `#RRGGBB` are accepted. `#ffff` or `#ggg` throws
  `ERR_INVALID_ARG_VALUE`.
- `validateStream` defaults to `true`, which checks `process.stdout` (or
  `options.stream`) and `NO_COLOR`/`FORCE_COLOR`. Verified: when piped
  without `FORCE_COLOR`, the output is plain text, and `FORCE_COLOR=3`
  forces the escapes. An *empty* `FORCE_COLOR=` also forced color in
  testing. Pass `{ validateStream: false }` to always emit.
