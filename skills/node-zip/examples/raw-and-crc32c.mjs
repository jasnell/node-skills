// @node-skills {"added":["v27.0.0-alpha.0.0.0"]}
// rawContent*() methods (on v26.x rawContent is a getter instead) and zlib.crc32c().
import { ZipBuffer, ZipEntry, createZipArchiveSync, crc32, crc32c, inflateRawSync } from 'node:zlib';
import assert from 'node:assert/strict';

const zip = new ZipBuffer(Buffer.concat([...createZipArchiveSync([ZipEntry.createSync('t', Buffer.from('a'.repeat(1000)))])]));
const entry = zip.get('t');
const raw = await entry.rawContent();             // stored bytes: still deflated, CRC not checked
assert.equal(raw.length, entry.compressedSize);
assert.equal(inflateRawSync(raw).toString(), 'a'.repeat(1000));
assert.ok(entry.rawContentSync().equals(raw));
let n = 0;
for await (const c of entry.rawContentIterator()) n += c.length;
assert.equal(n, entry.compressedSize);
assert.equal(entry.crc32, crc32('a'.repeat(1000)));

// CRC-32C (Castagnoli) differs from crc32(); chaining a previous value continues the checksum.
assert.equal(crc32c('hello'), 2591144780);
assert.equal(crc32c('world', crc32c('hello')), crc32c('helloworld'));
assert.notEqual(crc32c('hello'), crc32('hello'));
