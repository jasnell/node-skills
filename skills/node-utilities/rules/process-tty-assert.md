# process, tty and assert additions

## `process.addUncaughtExceptionCaptureCallback(fn)` (v25.9.0; Stability 1; not on v24)

Registers one of several capture callbacks. Unlike
`setUncaughtExceptionCaptureCallback`, the callbacks coexist with each other,
with the single `set...` function, and with `node:domain`.

Verified behavior:
- Callbacks run **newest first**. A callback that returns `true` stops the
  chain and skips the default handling. In that case `'uncaughtException'`
  listeners do not fire.
- When every callback returns a falsy value, handling falls through to the
  `'uncaughtException'` listeners. If there are none, the process crashes
  with exit code 1.
- `process.setUncaughtExceptionCaptureCallback(fn)` still works alongside
  it, and `hasUncaughtExceptionCaptureCallback()` returns `true`.
- There is no remove function in the docs. Make your callback check a flag
  if it must be disabled.

Use it in libraries or APMs that need to observe crashes without taking over
`setUncaughtExceptionCaptureCallback`, which throws if another function is
already set.

## `process.ref(x)` / `process.unref(x)` (added v23.6.0, v22.14.0; Stable since v26.11.0)

On v24 these exist but are Stability 1. They call `x[Symbol.for('nodejs.ref')]()`
or `x[Symbol.for('nodejs.unref')]()` when present. This "Refable protocol"
replaces `.ref()`/`.unref()` methods. Timers implement it. Verified: an
interval passed to `process.unref` has `hasRef() === false` and the process
exits. Non-refable values (`{}`, `null`) are ignored without an error. To
make your own handle refable, implement the two symbol methods.

## tty raw modes (v26.8.0, v24.21.0)

| Call | `rawMode` | `isRaw` |
| --- | --- | --- |
| `setRawMode(true)` / `setRawMode('raw')` | `'raw'` | `true` |
| `setRawMode('io')` | `'io'` | `true` |
| `setRawMode(false)` | `false` | `false` |
| initial | `false` | `false` |

The table was verified under a pty on main. Any other string throws
`ERR_INVALID_ARG_VALUE`.

- Per the docs, `'io'` is libuv `UV_TTY_MODE_IO`: input is raw **and
  terminal output processing is off** (for example, newline translation).
  Use it for binary-safe terminal protocols. It is not supported on
  Windows. `'raw'` does not affect output processing.
- **v24.19.0 (before 24.21):** `rawMode` is `undefined`. Any truthy string,
  including `'io'` and `'bogus'`, is accepted without error, and `'io'` gives
  plain raw mode (`isRaw === true`). Gate with
  `'rawMode' in process.stdin`.

## `assert.Assert` class (v24.6.0, v22.19.0)

```js
import { Assert } from 'node:assert';
const a = new Assert({ diff: 'full', strict: true, skipPrototype: false });
```

| Option | Default | Effect |
| --- | --- | --- |
| `diff` | `'simple'` | `'full'` prints full diffs |
| `strict` | `true` | Non-strict methods (`equal`, `deepEqual`) behave strictly. Verified: `new Assert().equal(1, '1')` throws |
| `skipPrototype` (v24.9.0) | `false` | Deep-equality methods ignore prototype and constructor differences. Verified: `deepStrictEqual(new Foo(1), new Bar(1))` passes |

- **Destructured methods lose the options.** Verified:
  `const { deepStrictEqual } = a` falls back to the default behavior.
  Always call them as `a.method()`.
- `util.isDeepStrictEqual(a, b, { skipPrototype: true })` (v24.9.0) is the
  boolean form.
- Related changes:
  - From v26.0.0, assertion messages may be a printf-style format string or
    a function (not verified here).
  - `assert.CallTracker` is removed. Use `mock.fn()` from `node:test`.
