# Pipelines and transforms

## `pull(source[, ...transforms][, { signal }])` → `AsyncIterable<Uint8Array[]>`

- It is lazy. The source is converted when `pull()` is called, but nothing is read until the
  result is iterated.
- The transforms run in order. `source` may be async or sync.
- `signal`: when it aborts, the pending read and every later read reject with `signal.reason`. An
  already-aborted signal still returns an iterable, and reading it rejects without touching the source
  (v26.12+). **On v24.x, `pull()` throws `signal.reason` synchronously**, so put the signal on the consumer instead.
- `pullSync(source[, ...transforms])` is the all-sync form. Its transforms receive no `options`.

## `pipeTo(source[, ...transforms], writer[, options])` → `Promise<number>` (bytes written)

| Option | Default | Meaning |
| --- | --- | --- |
| `signal` | none | Abort the pipe. This fails the writer unless `preventFail` is set |
| `preventClose` | `false` | Skip `writer.end()` when the source ends |
| `preventFail` | `false` | Skip `writer.fail()` on error |

- If the writer has `writev`, each whole batch goes in one call.
- If the writer has `writeSync`, `writevSync` or `endSync`, `pipeTo` tries those first and falls back to
  the async methods only when one returns `false` or `-1`. `fs` writers with a matching `chunkSize`
  complete without creating promises.

`pipeToSync(source[, ...transforms], writer[, { preventClose, preventFail, failOnIncompleteClose }])`
returns a number. The writer needs `writeSync`. A writer without `endSync()` is never closed. If
`endSync()` returns `-1`, the call throws `ERR_INVALID_STATE` (the data was accepted, and the writer is
failed only when `failOnIncompleteClose` is set). It never falls back to the async methods. On v24.x it
returns the byte count instead, and `failOnIncompleteClose` is not recognized (see `rules/versions.md`).

## Transform contracts

There are two forms. Both receive `options.signal`, which aborts when the pipeline is cancelled, fails, or
the consumer stops (except under `pullSync`).

```js
// Stateless: called once per batch, then once with null after the source ends (flush).
const upper = (chunks, { signal }) => chunks === null ? null : chunks.map(toUpper);
// It may return Uint8Array[], null (emit nothing), or an Iterable of chunks.

// Stateful: a generator over the whole upstream. The upstream yields batches and then null.
const lines = {
  async *transform(source, { signal }) {
    let rest = '';
    for await (const chunks of source) {
      if (chunks === null) { if (rest) yield [enc(rest)]; continue; } // flush
      for (const c of chunks) { /* split on '\n' and yield [enc(line + '\n')] */ }
    }
  },
};
```

- Use the stateful form for anything that buffers across batches: line splitting, framing,
  compression, encryption.
- A sync generator (`*transform`) is required for `pullSync`/`pipeToSync`.
- Chunks may be modified in place. Copy them if you need to keep the originals.

## `node:zlib/iter`: compression transforms

The import needs the same flag (without it you get `ERR_UNKNOWN_BUILTIN_MODULE`). Each
transform is a stateful object, so **create a new one for each pipeline**.

| Async (threadpool) | Sync (main thread) |
| --- | --- |
| `compressGzip`, `decompressGzip` | `compressGzipSync`, `decompressGzipSync` |
| `compressDeflate`, `decompressDeflate` | `compressDeflateSync`, `decompressDeflateSync` |
| `compressBrotli`, `decompressBrotli` | `compressBrotliSync`, `decompressBrotliSync` |
| `compressZstd`, `decompressZstd` | `compressZstdSync`, `decompressZstdSync` |

Options, all with `chunkSize` defaulting to 64 KiB and all accepting a `dictionary`:

- gzip/deflate compress: `level` (default **4**, where node:zlib uses 6), `windowBits` (15),
  `memLevel` (**9**, where node:zlib uses 8), and `strategy`.
- brotli compress: `params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q }`. The default quality is **6**
  (node:zlib uses 11) and `LGWIN` is 20. Other params are `BROTLI_PARAM_MODE` and `BROTLI_PARAM_SIZE_HINT`.
- zstd compress: `params` with `ZSTD_c_compressionLevel` (default 3), `ZSTD_c_checksumFlag`
  and `ZSTD_c_strategy`. There is also `pledgedSrcSize`.
- decompress: `windowBits` (gzip/deflate), brotli decoder params, and zstd
  `ZSTD_d_windowLogMax`, which caps decoder memory against hostile input.

The output is standard. `zlib.gunzipSync()` reads `compressGzip()` output, and `decompressGzip()`
reads `zlib.gzipSync()` output.

```js
const gz = await bytes(pull(from(data), compressGzip({ level: 9 })));
const back = await text(pull(from(gz), decompressGzip()), { limit: 10 << 20 }); // also caps the decompressed size
```

Availability: the zlib.md YAML says `added: v25.9.0`, but `node:zlib/iter` shipped in the
v24.20.0 backport of `stream/iter` (commit 28dc85d8d2). I verified it on v24.22.3. Feature-detect it with
`try { await import('node:zlib/iter') }` under the flag.
