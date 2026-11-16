# Sources

All of these need `--experimental-stream-iter`. They were added in v25.9.0 and v24.20.0 unless a section says otherwise.
The `node:` prefix is optional (`require('stream/iter')` also works).
The functions are named exports and are also available on the `Stream` namespace export. The adapters and
the `Broadcast`/`Share`/`SyncShare` helpers are named exports only.

## `from(input)` → `AsyncIterable<Uint8Array[]>`

`input` may be any of the following (`null` and `undefined` throw):

- a string (UTF-8 encoded), an `ArrayBuffer`, or an `ArrayBufferView` (wrapped as a `Uint8Array`);
- an `Iterable` or `AsyncIterable`, including arrays, generators, classic `Readable`s, and web
  `ReadableStream`s (which are async iterable). Nested arrays and iterables are flattened, and string
  chunks are encoded;
- an object with `[Symbol.for('Stream.toAsyncStreamable')]()` or
  `[Symbol.for('Stream.toStreamable')]()`. The first takes precedence over the second, and both take precedence over iteration.
  `stream.Readable` implements `toAsyncStreamable`, so `from(readable)` takes the batched fast path.

Values may be re-batched into implementation-defined, bounded batches.

## `fromSync(input)` → `Iterable<Uint8Array[]>`

This is the synchronous form of `from()`. It rejects async iterables and promises, and it ignores `toAsyncStreamable`
(only `toStreamable` and `Symbol.iterator` are used). `fromSync(null)` throws
`ERR_INVALID_ARG_TYPE`.

## `filehandle.pull([...transforms][, options])` → `AsyncIterable<Uint8Array[]>` (fs/promises)

| Option | Default | Meaning |
| --- | --- | --- |
| `autoClose` | `false` | Close the FileHandle when iteration ends, errors, or breaks |
| `start` | current position | Positioned reads (`pread`) from this offset |
| `limit` | until EOF | Stop after this many bytes |
| `chunkSize` | `131072` | Read buffer size |
| `signal` | none | `AbortSignal` |

- The transforms are applied as if through `pull()`, for example `fh.pull(decompressGzip(), { autoClose: true })`.
- The handle is locked from the first read until iteration ends. An iterable that is never read does
  not lock it.
- `filehandle.pullSync([...transforms][, options])` is the same with synchronous I/O and sync transforms,
  and it has no `signal`.

## `filehandle.writer([options])` → Writer

| Option | Default | Meaning |
| --- | --- | --- |
| `autoClose` | `false` | Close the handle on `end()` or `fail()` |
| `start` | current position | Positioned writes |
| `limit` | none | A byte cap. Async writes past it reject with `ERR_OUT_OF_RANGE`, and sync writes return `false` |
| `chunkSize` | `131072` | Writes up to this size can complete synchronously. Match the reader's `chunkSize` |

Methods: `write(chunk[, { signal }])`, `writev(chunks)` (a single `writev` syscall),
`writeSync`, `writevSync`, `end()` (returns a Promise of the total bytes and is idempotent), `endSync()` (returns the bytes, or `-1`),
and `fail(reason)` (synchronous). It supports `await using w = fh.writer()`: async dispose calls `fail()` if
`end()` was never called. With plain `using`, dispose always calls `fail()`.
Unawaited `write()` calls are serialized in the order they were made, so they never interleave in the file.

There is no `filehandle.writerSync`. A writer that is not `autoClose` leaves the handle open, so call
`await w.end(); await fh.close()`.

## Making your own objects streamable

```js
class Report {
  [Symbol.for('Stream.toAsyncStreamable')]() { return this.render(); } // may return a string, bytes, or an (async) iterable
  [Symbol.for('Stream.toStreamable')]() { return this.renderSync(); }   // used by fromSync
}
await text(from(new Report()));
```
