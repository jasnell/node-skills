// @node-skills {"added":["v26.8.0"]}
// Create a zip from files on disk (zipFiles) and from in-memory data (createZipArchive / createZipArchiveSync).
import { zipFiles, createZipArchive, createZipArchiveSync, ZipEntry, ZipFile, ZipBuffer } from 'node:zlib';
import { mkdtempDisposable, writeFile, mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-create-'));
const dir = tmp.path;
await writeFile(join(dir, 'report.txt'), 'report '.repeat(1000));
await mkdir(join(dir, 'docs'));
await writeFile(join(dir, 'docs', 'notes.md'), '# notes');

// 1. Files on disk: [sourcePath, entryName] pairs. Directories are NOT walked; list every path.
const out = join(dir, 'files.zip');
await pipeline(
  zipFiles([
    [join(dir, 'report.txt'), 'report.txt'],
    [join(dir, 'docs'), 'docs'],              // a directory entry; the trailing '/' is added
    [join(dir, 'docs', 'notes.md'), 'docs/notes.md'],
  ], 'built by zipFiles'),                    // a string option is the archive comment
  createWriteStream(out),
);
{
  await using zip = await ZipFile.open(out);
  assert.deepEqual([...zip.keys()], ['report.txt', 'docs/', 'docs/notes.md']);
  assert.equal(zip.comment, 'built by zipFiles');
  const report = await zip.get('report.txt');
  assert.equal(report.method, 8); // deflate
  assert.ok(report.compressedSize < report.size);
  assert.equal(report.mode, (await stat(join(dir, 'report.txt'))).mode & 0o7777); // Unix mode captured
}

// 2. In-memory data: build ZipEntry objects, then serialize. createZipArchive returns a Readable.
const entries = [
  await ZipEntry.create('hello.txt', Buffer.from('Hello, world!')),
  ZipEntry.createSync('data/', Buffer.alloc(0)),                       // directory: empty data
  ZipEntry.createSync('image.png', Buffer.from([0x89, 0x50]), { method: 'store' }),
  ZipEntry.createSync('big.log', Buffer.from('x'.repeat(5000)), { method: 'zstd', mode: 0o600 }),
];
const bytes = Buffer.concat(await createZipArchive(entries).toArray());
const zb = new ZipBuffer(bytes);
assert.deepEqual([...zb.keys()], ['hello.txt', 'data/', 'image.png', 'big.log']);
assert.equal(zb.get('big.log').method, 93); // zstd
assert.equal((await zb.get('hello.txt').content()).toString(), 'Hello, world!');

// 3. Synchronous variant: an iterator of Buffer chunks (short scripts only; it blocks).
const syncBytes = Buffer.concat([...createZipArchiveSync([ZipEntry.createSync('a.txt', Buffer.from('a'))])]);
assert.equal(new ZipBuffer(syncBytes).get('a.txt').contentSync().toString(), 'a');

// createZipArchive does NOT deduplicate names (ZipFile/ZipBuffer add() replace by name instead).
const dup = zipOfSync(ZipEntry.createSync('same', Buffer.from('1')), ZipEntry.createSync('same', Buffer.from('2')));
assert.deepEqual([...ZipEntry.read(dup)].map((e) => e.name), ['same', 'same']);

function zipOfSync(...list) {
  return Buffer.concat([...createZipArchiveSync(list)]);
}
