// @node-skills {"added":["v26.8.0"]}
// zipEntry.rawContent changed shape: a getter (Buffer | null) on v26.x, an async method on v27+.
import { ZipFile, ZipBuffer, ZipEntry, createZipArchiveSync } from 'node:zlib';
import { mkdtempDisposable, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const bytes = Buffer.concat([...createZipArchiveSync([ZipEntry.createSync('t', Buffer.from('b'.repeat(500)))])]);
// Detect on an instance: reading the v26.x getter through ZipEntry.prototype throws a TypeError.
const methodForm = typeof ZipEntry.createSync('probe', Buffer.alloc(0)).rawContent === 'function';

// Portable accessor: null means "not available" (file-backed or streaming entry on v26.x).
async function rawBytes(entry) {
  return typeof entry.rawContent === 'function' ? entry.rawContent() : entry.rawContent;
}

const inMemory = new ZipBuffer(bytes).get('t');
assert.equal((await rawBytes(inMemory)).length, inMemory.compressedSize);

await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-raw-'));
await writeFile(join(tmp.path, 'r.zip'), bytes);
await using zip = await ZipFile.open(join(tmp.path, 'r.zip'));
const onDisk = await zip.get('t');
if (methodForm) {
  assert.equal((await rawBytes(onDisk)).length, onDisk.compressedSize);
} else {
  assert.equal(await rawBytes(onDisk), null); // v26.x cannot return raw bytes of a file-backed member
}
