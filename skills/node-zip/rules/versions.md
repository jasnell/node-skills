# Version differences and portable detection

## Availability

- The ZIP API (`ZipFile`, `ZipBuffer`, `ZipEntry`, `zipFiles`, `createZipArchive[Sync]`,
  `get/setMaxZipContentSize`) exists from **v26.8.0** only. It is not in v25.x or v24.x
  (checked on v24.19.0, where every export is `undefined`). On v24, keep using an npm
  package, or gate the code:

  ```js
  import * as zlib from 'node:zlib';
  if (typeof zlib.ZipFile !== 'function') throw new Error('Node.js >= 26.8 required for node:zlib ZIP');
  ```

- The first use prints `ExperimentalWarning: The zlib ZIP archive API is an
  experimental feature`. Importing `node:zlib` alone does not.

## `zipEntry.rawContent`: a getter on v26.x, a method on v27+

| Version | Shape | File-backed / streaming entries |
| --- | --- | --- |
| v26.8.0 to v26.13.x (checked on v26.13.0) | a getter returning `Buffer \| null`, the retained stored bytes | `null` |
| v27.0.0-alpha.0.0.0+ and main | the methods `rawContent([{ maxSize }])` (a Promise), `rawContentSync()` and `rawContentIterator()` | work for every readable entry |

Detect the shape on an **instance**. Reading the v26 getter through `ZipEntry.prototype` throws a
TypeError:

```js
async function rawBytes(entry) {
  return typeof entry.rawContent === 'function' ? entry.rawContent() : entry.rawContent;
}
```

The docs (as of `ab476eccd03`) list `rawContent([options])` as `added: v26.8.0` and have
no `changes:` entry for the switch from getter to method.

## `zlib.crc32c`

Added in v27.0.0-alpha.0.0.0. It is absent on v26.13.0. Feature-detect it with
`typeof zlib.crc32c === 'function'`.

## Related, but documented elsewhere

The iterable compression transforms (`compressGzip`, `decompressZstd`, ...) live in
`node:zlib/iter`, behind `--experimental-stream-iter`. See the `node-stream-iter` skill.
