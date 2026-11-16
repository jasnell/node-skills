// @node-skills {"added":["v26.8.0"]}
// Untrusted archives: zip-bomb size caps, invalid archives, CRC failures, and closed-file errors.
import { ZipBuffer, ZipEntry, ZipFile, createZipArchiveSync, getMaxZipContentSize, setMaxZipContentSize } from 'node:zlib';
import { mkdtempDisposable, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const zipOf = (...entries) => Buffer.concat([...createZipArchiveSync(entries)]);

// 1. Size caps are checked against the DECLARED size before anything is allocated.
assert.equal(getMaxZipContentSize(), 256 * 1024 * 1024); // default for content()/contentSync()
const bomb = new ZipBuffer(zipOf(ZipEntry.createSync('zeros', Buffer.alloc(1_000_000))));
assert.ok(bomb.get('zeros').compressedSize < 2000);
await assert.rejects(bomb.get('zeros').content({ maxSize: 64 * 1024 }), { code: 'ERR_ZIP_ENTRY_TOO_LARGE' });
const previous = getMaxZipContentSize();
setMaxZipContentSize(64 * 1024); // process-wide default for content()
try {
  assert.throws(() => bomb.get('zeros').contentSync(), { code: 'ERR_ZIP_ENTRY_TOO_LARGE' });
} finally {
  setMaxZipContentSize(previous);
}

// 2. Garbage is rejected when the central directory is parsed.
assert.throws(() => new ZipBuffer(Buffer.from('definitely not a zip')), { code: 'ERR_ZIP_INVALID_ARCHIVE' });

// 3. Corrupt content fails CRC-32 verification (verify defaults to true).
const good = zipOf(ZipEntry.createSync('t.txt', Buffer.from('hello world'), { method: 'store' }));
const bad = Buffer.from(good);
bad[bad.indexOf('hello world')] ^= 0xff;
await assert.rejects(new ZipBuffer(bad).get('t.txt').content(), { code: 'ERR_ZIP_ENTRY_CORRUPT' });
// contentIterator() yields chunks first and throws only at the end: buffer before acting on them.
await assert.rejects(async () => {
  for await (const _ of new ZipBuffer(bad).get('t.txt').contentIterator());
}, { code: 'ERR_ZIP_ENTRY_CORRUPT' });

// 4. Names are verbatim; nameBuffer has the raw bytes.
const evil = new ZipBuffer(zipOf(ZipEntry.createSync('/abs/../../x', Buffer.from('x'))));
assert.deepEqual([...evil.keys()], ['/abs/../../x']);
assert.ok(Buffer.isBuffer(evil.get('/abs/../../x').nameBuffer));

// 5. Entries from a closed ZipFile throw ERR_INVALID_STATE (observed; the docs say EBADF-style errors).
await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-untrusted-'));
await writeFile(join(tmp.path, 'g.zip'), good);
const zip = await ZipFile.open(join(tmp.path, 'g.zip'));
const entry = await zip.get('t.txt');
await zip.close();
await assert.rejects(entry.content(), { code: 'ERR_INVALID_STATE' });
