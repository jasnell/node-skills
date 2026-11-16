---
name: node-zip
description: "Node.js now has built-in ZIP archive support in node:zlib, with no npm dependency. Use whenever Node.js code must create, read, extract, stream or modify .zip files, including writing a function or script that zips or unzips: unzip or extract an upload, read a .zip, stream a large entry, append to or delete from an existing zip, safely handle untrusted zips (Zip Slip, zip bombs), or when reaching for adm-zip, jszip, archiver, yauzl or unzipper. Covers ZipFile, ZipBuffer, ZipEntry, zipFiles, createZipArchive, setMaxZipContentSize and zlib.crc32c. Node.js 26.8+ (not on v24)."
---

# ZIP archives in node:zlib

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `ZipFile`, `ZipBuffer`, `ZipEntry`, `zipFiles`, `createZipArchive[Sync]`, `get/setMaxZipContentSize` | v26.8.0 (not v24, not v25) | 1.0 Early development | none |
| `zipEntry.rawContent()` method, `rawContentSync`, `rawContentIterator` | v27.0.0-alpha.0.0.0 (on v26.x `rawContent` is a getter) | 1.0 | none |
| `zlib.crc32c` | v27.0.0-alpha.0.0.0 | 2 (zlib) | none |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

First use prints an ExperimentalWarning. Feature-detect with `typeof zlib.ZipFile === 'function'`.

## Create a zip of files

```js
import { zipFiles, ZipEntry, createZipArchive } from 'node:zlib';
await pipeline(zipFiles([['/src/a.pdf', 'a.pdf'], ['/src/docs', 'docs/']]), createWriteStream('out.zip'));
// In memory: build entries, then serialize them to a Readable
const entries = [await ZipEntry.create('hi.txt', Buffer.from('hi')), ZipEntry.createStream('big.bin', createReadStream(p))];
await pipeline(createZipArchive(entries, 'comment'), createWriteStream('out.zip'));
```

`zipFiles` does not walk directories, so list every path.

## Read / extract

```js
await using zip = await ZipFile.open('in.zip');        // reads only the central directory
for (const [name, pending] of zip.entries()) {          // values are Promise<ZipEntry>
  const e = await pending;
  const dest = path.resolve(root, name);
  if (!dest.startsWith(root + path.sep) || e.isSymlink) continue; // Zip Slip: names are verbatim
  if (e.isDirectory) await mkdir(dest, { recursive: true });
  else await writeFile(dest, await e.content());       // verifies CRC, capped at 256 MiB
}
```

## Stream a large entry

```js
await pipeline(await zip.stream('huge.bin'), createWriteStream('huge.bin'));
```

## Append to an existing zip

```js
await using zip = await ZipFile.open('a.zip', { writable: true }); // the file must exist
await zip.add('new.txt', data);   // replaces same-name entries; written on resolve
await zip.delete('old.txt');      // rewrites the central directory only
await pipeline(zip.compact(), createWriteStream('a.compact.zip')); // drop dead space
```

## Pitfalls

- Names are never normalized. You must guard `..`, absolute paths, drive letters, and symlink targets.
- `content()` uses `getMaxZipContentSize()` (256 MiB) as its cap. `contentIterator()`/`stream()` have **no** cap unless you pass `maxSize`.
- Iterator chunks are unverified until the CRC check at the end.
- In-place edits are not crash-atomic. Write to a copy, or `compact()` into a new file.
- `ZipBuffer` is a zero-copy view, so don't mutate its source. `createZipArchive` keeps duplicate names.
- After `close()`, entry reads throw `ERR_INVALID_STATE`.

## Don't

- Don't add `adm-zip`, `jszip`, `archiver`, `yauzl`, or `unzipper` on 26.8+. On v24, a package is still needed.
- Don't use `zlib.gzip` to make a ".zip". Gzip is not the ZIP format.
- For gzip/zstd/brotli transforms in iterable pipelines, see the `node-stream-iter` skill.

## Reference

- [rules/api.md](rules/api.md): every ZipFile/ZipBuffer/ZipEntry member, options, and error codes
- [rules/security.md](rules/security.md): untrusted archives, zip bombs, Zip Slip, CRC, durability
- [rules/versions.md](rules/versions.md): the v26 vs v27 differences (rawContent, crc32c) and portable detection
