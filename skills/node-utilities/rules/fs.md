# node:fs additions

## Temp directories: `mkdtempDisposable` (v24.4.0)

```js
import { mkdtempDisposable } from 'node:fs/promises';
import { mkdtempDisposableSync } from 'node:fs';
{
  await using dir = await mkdtempDisposable(join(tmpdir(), 'job-'));
  // dir.path, dir.remove(), dir[Symbol.asyncDispose]()
}                                  // directory and contents removed here
{
  using dir = mkdtempDisposableSync(join(tmpdir(), 'job-')); // [Symbol.dispose]
}
```

- Removal is recursive. Verified: nested files are gone afterwards.
  `remove()` can be called more than once.
- `await using` and `using` work on v24.19.0 without flags (verified).
- The random suffix is appended directly to the prefix. Add a trailing
  `sep` or a name stem.
- **Discrepancy (main, v28.0.0-pre):** a `Buffer` prefix or
  `{ encoding: 'buffer' }` throws `ERR_INVALID_ARG_TYPE` from `path.resolve`
  *after* the directory has been created, which leaks it. The docs
  (fs.md:1700, fs.md:6666) say `path` becomes a Buffer. On v24.19.0 and
  v26.13.0 a Buffer prefix returns a string path, and `encoding: 'buffer'`
  throws too. Use string prefixes.
- Plain `fs.mkdtemp*` with a Buffer prefix now returns a Buffer (v27.0.0).

## Temp files: `mkstemp` (v27.0.0; Stability 1; not on v24 or v26)

| Form | Result |
| --- | --- |
| `fsPromises.mkstemp(prefix[, options])` | `{ path, handle }` (a `FileHandle`) |
| `fs.mkstempSync(prefix[, options])` | `{ path, fd }` |
| `fs.mkstemp(prefix[, options], cb)` | `cb(err, { path, fd })` |

- Creating and opening happen in one step, so there is no race. On POSIX the
  mode is `0600` (verified).
- The file is **never removed** automatically, and the result object has no
  `Symbol.asyncDispose`. Only the `FileHandle` does, and disposing it
  closes the file without unlinking it. Put the file inside a
  `mkdtempDisposable` directory to clean up both.
- Avoid trailing `X` characters in the prefix, because BSDs may replace them.

## `fs.Utf8Stream` (v24.6.0; Stability 1)

This is a fast UTF-8 file writer (the sonic-boom design). `new
fs.Utf8Stream({ dest | fd, ... })`, then wait for `'ready'`. Verified:
writes made before `'ready'` are not lost.

| Option | Notes |
| --- | --- |
| `dest` / `fd` | Target path or file descriptor |
| `append` | Default `true` |
| `mkdir` | Create the parent directories (verified) |
| `minLength` | Buffer this many bytes before writing. `0` writes as soon as possible |
| `maxLength` | Writes that would overflow are **dropped**, and `'drop'` fires with the data (verified) |
| `maxWrite` | Default 16384 |
| `sync` | Synchronous writes |
| `fsync` | `fsyncSync` after each write |
| `periodicFlush` | Flush every N ms |
| `contentMode` | `'utf8'` (strings only; a Buffer throws `ERR_INVALID_ARG_TYPE`) or `'buffer'` |
| `retryEAGAIN(err, writeLen, remainingLen)` | Return `true` to retry on `EAGAIN`/`EBUSY` |

- `flush(cb)` is async. `flushSync()` is safe in `process.on('exit')`.
- `reopen(path)` reopens the file after it was renamed, for log rotation
  (verified).
- `end()` flushes and then closes (`'finish'`, then `'close'`).
  `destroy()` closes **without flushing**. `[Symbol.dispose]` calls
  `destroy()`, so `using s = new fs.Utf8Stream(...)` silently loses
  buffered data (verified: the file was empty).
- It is an `EventEmitter`, not a `stream.Writable` (verified), so you cannot `pipe()` into it.

## `glob` options

- `followSymlinks` (v26.1.0, v24.16.0): follows directory symlinks while
  expanding `**`. The default is `false`, which skips the linked directory.
  Cycles are not traversed recursively (verified with a self-loop).
- `maxDepth` (v26.9.0): the cwd has depth 0. Verified: `maxDepth: 1` gives
  only direct children (`['top.js']`), `2` adds one level, and `0` matches
  nothing for `**/*.js`. **v24.19.0 ignores it silently** and returns
  everything.
- Applies to `fs.glob`, `fs.globSync` and `fsPromises.glob`. Negated
  patterns in `exclude` are still not supported.

## `stat` and `lstat`

- `throwIfNoEntry: false` on async `fs.stat` and `fsPromises.stat`
  (documented as v25.7.0 only) resolves to `undefined` for a missing path.
  **It also works on v24.19.0** (verified for both the callback and promise
  forms). `statSync`/`lstatSync` have had it since v14.17.
- `signal` on `stat`, `lstat` and `fstat` (v26.8.0): an aborted signal rejects
  with `AbortError` (verified). v24.19.0 ignores it and resolves.

## `fs.Stats` and Temporal (v26.2.0)

`atimeInstant`, `mtimeInstant`, `ctimeInstant` and `birthtimeInstant` are
`Temporal.Instant` values, which have nanosecond precision when
`{ bigint: true }` is used. Verified:
- `mtimeInstant.epochMilliseconds === Math.trunc(mtimeMs)`.
- With bigint, `mtimeInstant.epochNanoseconds === mtimeNs`.

The getters are lazy: they are missing from `Object.keys` and `JSON` until
first read, and then become own properties. With Temporal disabled
(`--no-harmony-temporal`), reading one throws `ERR_NO_TEMPORAL`. v24 has no
global `Temporal`, and these properties are `undefined` there.

## `fs.openAsBlobSync(path[, { type }])` (v26.10.0)

This is the synchronous form of `fs.openAsBlob()`. It returns a file-backed
`Blob`, for example `blob.size`, `blob.type === 'text/plain'` and
`await blob.text()`.

## Related removals (verified on main; v24 only warns)

- `fs.F_OK`/`R_OK`/`W_OK`/`X_OK` are `undefined` from v25.0.0. Use
  `fs.constants.*`. v24.19.0 still has them and emits DEP0176.
- `fs.rmdir(path, { recursive })` throws `ERR_INVALID_ARG_VALUE` from v25.0.0.
  Use `fs.rm(path, { recursive: true, force: true })`.
