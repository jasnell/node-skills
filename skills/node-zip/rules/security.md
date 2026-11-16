# Handling untrusted ZIP archives

## Zip Slip (path traversal)

`zipEntry.name` is returned **verbatim**. It is never normalized or rejected, even
when it contains `..`, a leading `/`, a drive letter, or backslashes. ZipFile and ZipBuffer
never write to disk, so the extraction code you write must check every path:

```js
import { resolve, sep } from 'node:path';
function safeTarget(root, name) {             // root must already be absolute and resolved
  const target = resolve(root, name);
  return target === root || target.startsWith(root + sep) ? target : null;
}
```

- Skip `entry.isSymlink` entries, or validate their target (`await entry.content()`
  holds the link text) with the same check. A link that escapes the destination can redirect a
  later write.
- The central directory is authoritative. A local header that disagrees with it is ignored, so
  "ZIP confusion" archives cannot make `name` disagree with the content you read.
- For names that are neither UTF-8 nor CP437, decode `entry.nameBuffer` yourself.

## Zip bombs

- `content()` checks the **declared** uncompressed size against `maxSize` before it
  allocates anything. The default is `getMaxZipContentSize()` (256 MiB). Lower it for each call
  (`content({ maxSize })`) or for the whole process (`setMaxZipContentSize(n)`).
- **`contentIterator()` and `zipFile.stream()` have no cap by default.** Pass
  `maxSize`. Each chunk is bounded so the total never exceeds the declared size.
- Bound the total too: sum `entry.size` over the entries and check `zip.size` (the number of entries) before
  extracting. The per-entry limits do not cap the aggregate.
- An oversized central directory makes `ZipFile.open` throw `ERR_ZIP_ARCHIVE_TOO_LARGE`.

## Integrity

- `verify` defaults to `true`. `content()` checks CRC-32 before it returns, and rejects with
  `ERR_ZIP_ENTRY_CORRUPT`.
- `contentIterator()` can only verify at the end: it yields every chunk and **then**
  throws. Write the chunks to a temporary file and rename it on success, or use `content()`.
- `rawContent*()` (v27+) returns the stored bytes without any CRC check.

## Durability of in-place edits

`ZipFile` `add`, `addEntry` and `delete` rewrite the central directory in place, so they are not
crash-atomic. A failed write (a full disk, or a killed process) can leave the file unreadable.
If durability matters, copy the file first, or `compact()` it into a new file and `rename()` the result.

## Untrusted input checklist

1. Prefer `ZipFile.open` (lazy) for files and `ZipBuffer` for a body already in memory.
   Catch `ERR_ZIP_INVALID_ARCHIVE` and `ERR_ZIP_UNSUPPORTED_FEATURE`.
2. Check the entry count and the sum of `entry.size` against your limits.
3. Resolve every name under the destination root. Skip symlinks, or validate their targets.
4. Read with `content({ maxSize })`, or stream with `contentIterator({ maxSize })` into a
   temporary file that you rename after the iterator completes.
5. Do not apply the archive's `mode` bits blindly, because setuid, setgid and sticky bits are included.
