---
name: node-stream-iter
description: "Experimental iterable-first streams API, node:stream/iter (behind --experimental-stream-iter). Use only when the user asks for stream/iter or that flag, or explicitly accepts an experimental API for async-iterable stream pipelines with backpressure. Without that opt-in, prefer classic node:stream for production code. Covers from/pull/pipeTo/push/duplex/broadcast/share, text/bytes/array consumers, transforms, filehandle.pull/writer, fromReadable/toReadable interop and node:zlib/iter compressGzip/decompressZstd. Node.js 24.20+ or 25.9+; behavior differs before 26.12."
---

# node:stream/iter (iterable streams)

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:stream/iter` | v25.9.0, v24.20.0 | 1 | `--experimental-stream-iter` |
| `filehandle.pull`, `pullSync`, `writer` | v25.9.0, v24.20.0 | 1 | same |
| `node:zlib/iter` (`compress*`/`decompress*`, `*Sync`) | v25.9.0, v24.20.0 (the docs list only v25.9.0) | 1 | same |
| `from/toReadable`, `from/toWritable`, `Readable[Symbol.for('Stream.toAsyncStreamable')]` | v26.1.0, v24.20.0 | 1 | same |
| `dump`, `dumpSync` | v26.12.0 (not v24) | 1 | same |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Mental model

- A stream is any `AsyncIterable` or `Iterable` of **batches** (`Uint8Array[]`). Strings become UTF-8 bytes.
- A **transform** is `(chunks | null) => chunks` (`null` means flush) or `{ transform: async function* (source) {} }`.
- `pull()` is lazy, so the consumer sets the pace. `push()` returns `{ writer, readable }` with a byte `budget`.
- A writer is any object with `write()`. Its other methods are optional.
- Without the flag the import throws, and v24.19 and older reject the flag itself.

## File → transform → file

```js
import { open } from 'node:fs/promises';
import { pipeTo } from 'node:stream/iter';
import { compressGzip } from 'node:zlib/iter';
const src = await open('in.txt'), dst = await open('in.txt.gz', 'w');
await pipeTo(src.pull({ autoClose: true }), compressGzip(), dst.writer({ autoClose: true }));
```

## Consume to text or bytes

```js
const s = await text(pull(from(gzBytes), decompressGzip()), { limit: 1 << 20 });
const b = await bytes(fh.pull({ start: 100, limit: 1024, autoClose: true }));
```

## Interop

```js
await text(from(classicReadable)); // or a web ReadableStream
await pipeline(toReadable(pull(src, compressGzip())), res);
await pipeTo(src, fromWritable(writable, { backpressure: 'unbounded' }));
```

## Push with backpressure

```js
const { writer, readable } = push(); // 16384-byte budget, 'strict' policy
const done = text(readable);                          // run the consumer concurrently
for (const item of items) await writer.write(item);   // must await
await writer.end();
```

## Pitfalls

- **v24.x, and v26 before 26.12:** a `budget` below 16384 throws, and `pull()` with a pre-aborted signal throws synchronously ([rules/versions.md](rules/versions.md)).
- Under `'strict'`, an unawaited `write()` rejects with `ERR_INVALID_STATE`. Without a consumer, writes wait forever.
- Compression transforms keep state, so make one per pipeline. The defaults are gzip level 4 and brotli quality 6.
- Without `autoClose`, close the `FileHandle` yourself.

## Don't

- Don't subclass `Transform` here. Write a function or generator transform.
- Don't use `zlib.createGzip()` in a pipeline. Use `compressGzip()` from `node:zlib/iter`.

## Reference

- [rules/sources.md](rules/sources.md): `from`/`fromSync` input rules, filehandle `pull`/`pullSync`/`writer` options
- [rules/pipelines.md](rules/pipelines.md): `pull`, `pipeTo[Sync]`, transform contracts, `node:zlib/iter` options
- [rules/push-duplex.md](rules/push-duplex.md): `push`, the Writer interface, backpressure policies, `duplex`, `ondrain`
- [rules/consumers.md](rules/consumers.md): consumers, `tap`, `merge`, `broadcast`, `share`
- [rules/interop.md](rules/interop.md): classic and web stream adapters, protocol symbols
- [rules/versions.md](rules/versions.md): v24 versus v26.12+ differences
