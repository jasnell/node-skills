# node:zlib ZIP API reference

Everything here was added in v26.8.0 and is at Stability 1.0 (Early development), unless a row says otherwise.
The docs are pinned at nodejs/node `ab476eccd03`. Behavior was checked on v26.13.0 and on main
(v28.0.0-pre).

## Choosing a class

| Need | Use |
| --- | --- |
| An archive on disk, with lazy random access or in-place edits | `ZipFile.open(path[, { writable }])` |
| An archive already held in memory (an upload or a fetch body) | `new ZipBuffer(bytes)` |
| Iterate the entries of a buffer once, without an index | `ZipEntry.read(bytes)` |
| Build a new archive from data | `ZipEntry.create*` + `createZipArchive(entries)` |
| Build a new archive from files on disk | `zipFiles([[src, name], ...])` |

## ZipEntry

Static constructors:

- `await ZipEntry.create(name, data[, opts])` and `ZipEntry.createSync(...)`. `data` is a
  Buffer, TypedArray, DataView, or ArrayBuffer. A name ending in `/` makes a directory,
  and its data must be empty (otherwise it throws `ERR_INVALID_ARG_VALUE`). `opts` are:
  `comment`, `mode` (default `0o644`, or `0o755` for directories), `modified` (a Date,
  default now), and `method` (`'deflate'` (default), `'store'` or `'zstd'`). If deflating
  would not make the data smaller, the entry is stored instead. A stored entry keeps a
  zero-copy view of `data`.
- `ZipEntry.createStream(name, asyncIterable[, opts])`. The data is compressed during
  serialization, so `size`, `crc32` and `compressedSize` are only known afterwards. A name
  ending in `/` throws. Before serialization, `content*()` throws `ERR_INVALID_STATE`.
  After `zipFile.addEntry()` the entry is promoted to a file-backed entry and becomes readable.
  After `createZipArchive()` it is spent. It supports `Symbol.dispose` and `Symbol.asyncDispose`,
  which destroy an unconsumed source.
- `ZipEntry.createSymlink(name, target[, opts])` makes a stored entry with `isSymlink === true` (mode `0o777`).
- `ZipEntry.read(bytes)` returns an iterator of `ZipEntry`, each a zero-copy view.

Properties: `name` (verbatim, see `rules/security.md`), `nameBuffer`, `comment`, `size`,
`compressedSize`, `compressed`, `method` (`0` store, `8` deflate, `93` zstd), `crc32`,
`flags`, `mode` (the low 12 bits, or 0 for archives not made on Unix), `modified` (a Date),
`isFile`, `isDirectory`, and `isSymlink`.

Reading:

| Method | Cap | Verify | Notes |
| --- | --- | --- | --- |
| `content([{ verify = true, maxSize }])` returns `Promise<Buffer>` | `maxSize`, default `getMaxZipContentSize()` (256 MiB) | CRC is checked before it returns | The result is a fresh copy |
| `contentSync([opts])` | same | same | Blocks the event loop |
| `contentIterator([{ verify, maxSize }])` returns `AsyncIterator<Buffer>` | **none** unless `maxSize` is passed | CRC is checked **after** the last chunk | Bounded memory. A file-backed entry reads lazily from disk |
| `rawContent([{ maxSize }])` returns a Promise of the stored bytes | `maxSize`, default 256 MiB | no | **v27+ only.** On v26.x `rawContent` is a getter, see `rules/versions.md` |
| `rawContentSync()`, `rawContentIterator()` | | | v27.0.0-alpha.0.0.0 |

Errors: `ERR_ZIP_ENTRY_TOO_LARGE` (the declared size is over `maxSize`), `ERR_ZIP_ENTRY_CORRUPT`
(a CRC or size mismatch), and `ERR_INVALID_STATE` (an unserialized streaming entry, or its `ZipFile` is closed).

## ZipFile (on disk)

- `await ZipFile.open(path, { writable: false })` and `ZipFile.openSync(...)` read only the tail and the
  central directory. A missing file rejects with `ENOENT`; ZipFile never creates a file.
  A central directory that is too large throws `ERR_ZIP_ARCHIVE_TOO_LARGE`.
- Lookups: `size`, `has(name)`, `keys()`, `comment` and `writable`. `get(name)` returns a
  `Promise<ZipEntry>` and `getSync(name)` a `ZipEntry`; both create lazy file-backed entries, and a
  missing name gives `ERR_ZIP_ENTRY_NOT_FOUND`. `entries()` and `values()` yield
  **Promises**. `entriesSync()`, `valuesSync()` and `forEachSync()` yield resolved entries.
  The object is iterable (`for (const [name, promise] of zip)`).
- `await zip.stream(name[, { verify, maxSize }])` resolves to a `stream.Readable`. It has no default cap.
- Edits (they need `{ writable: true }`, otherwise `ERR_ZIP_NOT_WRITABLE`):
  - `add(name, data[, opts])` and `addSync`. `addEntry(entry)` and `addEntrySync` (the sync form cannot take
    a pending streaming entry). The new data goes where the old central directory
    started, and the directory is rewritten after it. An existing entry with the same name is replaced.
  - `delete(name)` and `deleteSync` return whether the entry existed. They only rewrite the directory.
  - The file is modified when the returned promise settles. A sync method called while an
    async edit is pending throws `ERR_INVALID_STATE`.
- `compact([comment])` returns a `Readable` of a fresh archive without dead space.
  `compactSync()` returns a Buffer. Neither modifies the open file: write the result
  to a new path and rename it.
- `close()` and `closeSync()`. `Symbol.asyncDispose` and `Symbol.dispose` are present (observed,
  not documented) and close the file, so `await using zip = await ZipFile.open(...)` works.
  Entries used after close throw `ERR_INVALID_STATE` (observed; the docs say EBADF-style errors).

## ZipBuffer (in memory)

- `new ZipBuffer(bytes)` parses the central directory. It throws `ERR_ZIP_INVALID_ARCHIVE` or
  `ERR_ZIP_UNSUPPORTED_FEATURE`. The bytes are **not copied**: do not mutate or reuse them
  while the ZipBuffer or any of its entries is alive (pass `Buffer.from(src)` if they might change).
- `get(name)` (throws `ERR_ZIP_ENTRY_NOT_FOUND`), `has`, `keys`, `values`, `entries`,
  `forEach`, `size` and `comment`. It is iterable as `[name, entry]`. `writable` is always `true`.
- `add`/`addSync`/`addEntry` replace by name, and `delete(name)` and `clear()` remove entries. None of them touches the source
  bytes.
- `await toBuffer([comment | { comment, baseOffset }])` and `toBufferSync()` serialize a fresh
  archive, switching to Zip64 automatically.

## Building archives

- `createZipArchive(iterableOrAsyncIterable[, comment | { comment, baseOffset }])` returns a
  `stream.Readable`, which is also an async iterable of Buffers (`await r.toArray()` works).
  The stream owns the entries. If it is destroyed early (for example because a `pipeline()` failed),
  it disposes the remaining entries. Duplicate names are written twice.
  A comment over 65,535 bytes throws `ERR_ZIP_ARCHIVE_TOO_LARGE`.
- `createZipArchiveSync(iterable[, opts])` returns an **iterator** of Buffers
  (`Buffer.concat([...it])`). A streaming entry throws when its turn comes.
- `zipFiles(pairs[, comment | { followSymlinks = true, comment, baseOffset }])` returns a `Readable`.
  `pairs` is any iterable of `[sourcePath, entryName]`, such as an array, a Map, or
  `Object.entries()`. It records the Unix mode and mtime. A directory becomes a directory entry (the trailing `/` is
  added) and is **not** recursed into. Files are streamed. With `followSymlinks: false`, symlinks
  are stored as link entries.
- `baseOffset` shifts the recorded offsets so that an archive written after N bytes of
  other content (a self-extracting stub, for example) is still valid.

## Global cap

`getMaxZipContentSize()` returns the default of 268435456. `setMaxZipContentSize(n)` is process-wide and
applies only to `content()`/`contentSync()`. Streaming reads ignore it.

## zlib.crc32c(data[, value]) (v27.0.0-alpha.0.0.0)

This is CRC-32C (Castagnoli, as used by iSCSI, ext4 and SCTP). It differs from `zlib.crc32` (v22.2.0, v20.15.0),
which is the checksum ZIP uses. Chain calls by passing the previous result as `value`:
`crc32c('world', crc32c('hello')) === crc32c('helloworld')`.
