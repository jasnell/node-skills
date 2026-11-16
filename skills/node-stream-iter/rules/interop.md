# Interop with classic streams and Web Streams

The adapters were added in v26.1.0 and v24.20.0 and are at Stability 1. They need `--experimental-stream-iter`.

## Classic `stream.Readable` → iter

- `from(readable)` and `pull(readable, ...)` work directly, because `Readable.prototype` implements
  `[Symbol.for('Stream.toAsyncStreamable')]()`. That method yields `Uint8Array[]` batches drained from
  the internal buffer. Object-mode and encoded streams are normalized to bytes.
- `fromReadable(readable)` does the same explicitly. It also accepts duck-typed objects with `read`, `pipe`,
  `destroy`, `on` and `removeListener`, and it caches the result per instance.
- `Readable.prototype[Symbol.for('Stream.toAsyncStreamable')]` exists even **without** the
  flag (observed on v26.13.0 and main). The docs say it requires the flag.

## iter → classic `stream.Readable`

- `toReadable(asyncSource[, { highWaterMark = 65536, signal }])` returns a byte-mode Readable, with each
  chunk pushed separately. Use it to feed `stream.pipeline()`, an HTTP `res`, or any API that expects a
  Readable.
- `toReadableSync(syncSource[, { highWaterMark }])` returns a Readable whose `read()` pulls synchronously.
- A non-Error failure reason is wrapped in an `ERR_FALSY_VALUE_REJECTION` or `ERR_OPERATION_FAILED` error, with
  the original value on `.reason`.

## iter → classic `stream.Writable`

- `fromWritable(writable[, { backpressure }])` returns a Writer for `pipeTo()`. The policies are `'strict'`
  (the default), **`'unbounded'` (recommended with `pipeTo`)** and `'drop-newest'`. `'drop-oldest'` throws
  `ERR_INVALID_ARG_VALUE`. Its sync methods always return `false` or `-1`. Object-mode writables are rejected.
  The result is cached per instance and policy.

## Classic `Writable` API over an iter Writer

- `toWritable(writer)` returns a `stream.Writable` whose `_write` tries `writeSync` and then `write`,
  and whose `_final` tries `endSync` and then `end`. Destroying it early calls `writer.fail()`. Use it to hand a
  `push()` writer or an `fh.writer()` to code that expects a Writable.

## Web Streams

- **A web `ReadableStream` → iter:** pass it to `from()`. It is async iterable, and string chunks are
  encoded.
- **iter → web `ReadableStream`:** use `Readable.toWeb(toReadable(source))`.
- **iter → web `WritableStream`:** any object with `write()` is a Writer:
  ```js
  const w = ws.getWriter();
  await pipeTo(source, { write: (c) => w.write(c), end: () => w.close(), fail: (r) => w.abort(r) });
  ```
  There is no built-in web adapter.

## Protocol symbols (on `Stream`, and as named exports)

| Symbol | Implement it to |
| --- | --- |
| `Symbol.for('Stream.toAsyncStreamable')` | let `from()` convert your object (it may return a string, bytes, an iterable, or a promise of one) |
| `Symbol.for('Stream.toStreamable')` | let `fromSync()` and `from()` convert your object synchronously |
| `Symbol.for('Stream.drainableProtocol')` | make a writer work with `ondrain()` (return `null`, or a promise) |
| `Symbol.for('Stream.broadcastProtocol')` | have `Broadcast.from(obj)` return your BroadcastChannel |
| `Symbol.for('Stream.shareProtocol')`, `Symbol.for('Stream.shareSyncProtocol')` | have `Share.from()`/`SyncShare.fromSync()` return your Share |

Using `Symbol.for(...)` lets a library take part in these protocols without importing `node:stream/iter`, so its
code still loads when the flag is off.
