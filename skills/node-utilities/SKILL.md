---
name: node-utilities
description: "Small built-ins added since Node.js 24 that replace common npm packages. Use for debounce/throttle, temp files and directories with automatic cleanup, URL pattern matching or routing, an in-process mutex (Web Locks), Web Workers, partial deep-equality checks, UTF-8 byte length or fs.glob depth limits, or when about to install lodash.debounce, p-throttle, tmp or urlpattern-polyfill. Covers util.debounce/throttle, isPartialDeepStrictEqual, markPromiseAsHandled, Buffer.stringLength, fs.mkdtempDisposable, fs.mkstemp, openAsBlobSync, Utf8Stream, URLPattern, navigator.locks, the global Worker, addUncaughtExceptionCaptureCallback and tty raw modes. Node.js 24+."
---

# Utilities since v24

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `util.debounce`, `throttle`, `markPromiseAsHandled` | v26.10.0, v24.22.0 | 2 | |
| `util.isPartialDeepStrictEqual`, `Buffer.stringLength`, `isLatin1` | v26.11.0 | 2 | |
| `util.convertProcessSignalToExitCode`; `streamConsumers.bytes` | v25.4.0; v25.6.0; both v24.14.0 | 2 | |
| `styleText('#rrggbb')`, `glob({ followSymlinks })` | v26.1.0, v24.16.0 | 2 | |
| `fs.mkdtempDisposable[Sync]` | v24.4.0 | 2 | |
| `fs.mkstemp[Sync]` | v27.0.0 | 1 | |
| `fs.Utf8Stream` | v24.6.0 | 1 | |
| `glob({ maxDepth })`; `fs.openAsBlobSync` | v26.9.0; v26.10.0 | 2 | |
| async `stat({ throwIfNoEntry })` | v25.7.0 (also v24.19.0) | 2 | |
| `stat`/`lstat` `signal`; `allocUnsafe(n, alignment)` | v26.8.0 | 2 | |
| `Stats` `*Instant` (Temporal) | v26.2.0 | 2 | |
| `blob.textStream()`, `ReadableStreamTee` | v26.5.0, v24.19.0 | 2, 1 | |
| `URLPattern` global | v24.0.0 | 1 | |
| `navigator.locks`, `worker_threads.locks` | v24.5.0 | 1 | |
| `ErrorEvent`; `QuotaExceededError` | v25.0.0; v26.0.0 | 2 | |
| Global Web `Worker` | v26.9.0, default-on in main | 1 | `--experimental-web-worker` |
| `process.addUncaughtExceptionCaptureCallback` | v25.9.0 | 1 | |
| `process.ref`/`unref` Stable | v26.11.0 (added v23.6.0, v22.14.0) | 2 | |
| tty `setRawMode('raw'\|'io')`, `rawMode` | v26.8.0, v24.21.0 | 2 | |
| `stream.compose` Stable | v26.2.0, v24.19.0 | 2 | |
| `assert.Assert`; `skipPrototype` | v24.6.0, v22.19.0; v24.9.0 | 2 | |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Patterns

```js
import { debounce, throttle } from 'node:util';
const save = debounce(async (doc) => write(doc), 300); // all callers get the last result
save.cancel(); // pending reject with AbortError
const get = throttle((id) => load(id), 2, 1000); // 2 starts/s; extras queue

await using dir = await fsp.mkdtempDisposable(join(tmpdir(), 'job-')); // rm -r at scope exit
const { path, handle } = await fsp.mkstemp(join(dir.path, 'f-')); // 27+, mode 0600
await using h = handle; // the result is not disposable

new URLPattern({ pathname: '/users/:id(\\d+)' }).exec(url)?.pathname.groups.id;
await navigator.locks.request('cache', () => refresh()); // resolves with refresh()'s value
```

## Pitfalls

- Older versions ignore new args silently: `allocUnsafe(n, 3)`, `glob({ maxDepth })`; `setRawMode('io')` acts as raw.
- `mkdtempDisposable(Buffer)` throws on main after creating the directory.
- `using` on `fs.Utf8Stream` calls `destroy()` and drops buffered data. Call `end()`.
- Locks are per process. A queued request does not keep a worker alive.
- `new Worker('./w.js')` resolves against `cwd`; pass a `URL`.

## Don't

- `lodash.debounce`/`throttle`, `p-throttle` → `util.debounce`/`throttle`.
- `tmp`/`tmp-promise` → `mkdtempDisposable`/`mkstemp`; `sonic-boom` → `Utf8Stream`.
- `urlpattern-polyfill` → `URLPattern`; in-process `async-mutex` → `navigator.locks` (not `proper-lockfile`: cross-process).
- `chalk.hex()` → `styleText('#hex')`; `128 + signals[s]` → `convertProcessSignalToExitCode`.

## Reference

- [rules/util.md](rules/util.md): debounce/throttle options, other util.
- [rules/fs.md](rules/fs.md): temp files, Utf8Stream, glob, stat.
- [rules/buffer-and-streams.md](rules/buffer-and-streams.md): Buffer, web streams.
- [rules/globals-and-workers.md](rules/globals-and-workers.md): URLPattern, locks, Web Worker.
- [rules/process-tty-assert.md](rules/process-tty-assert.md): process, tty, `Assert`.
