// @node-skills {"added":["v26.8.0"]}
// Stream large members in and out without buffering them: createStream entries, zipFile.stream(), contentIterator().
import { ZipFile, ZipEntry, createZipArchive } from 'node:zlib';
import { mkdtempDisposable, writeFile, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-stream-'));
const big = join(tmp.path, 'big.bin');
const chunk = Buffer.alloc(1 << 20, 'abcdefgh');
await writeFile(big, Buffer.concat(Array(8).fill(chunk))); // 8 MiB
const want = createHash('sha256').update(Buffer.concat(Array(8).fill(chunk))).digest('hex');

// Write: the source (any AsyncIterable of Uint8Array) is compressed on the fly during serialization.
const archive = join(tmp.path, 'big.zip');
const entry = ZipEntry.createStream('big.bin', createReadStream(big));
assert.throws(() => entry.contentSync(), { code: 'ERR_INVALID_STATE' }); // not readable until serialized
await pipeline(createZipArchive([entry]), createWriteStream(archive));
assert.equal(entry.size, 8 << 20); // size/crc32 become known after serialization
assert.ok((await stat(archive)).size < 100_000);

// Read: zipFile.stream() resolves to a Readable; contentIterator() is the same thing as an async iterator.
await using zip = await ZipFile.open(archive);
const hash = createHash('sha256');
await pipeline(await zip.stream('big.bin'), hash);
assert.equal(hash.digest('hex'), want);

let total = 0;
for await (const part of (await zip.get('big.bin')).contentIterator()) total += part.length;
assert.equal(total, 8 << 20);

// Streaming reads ignore the global content-size cap; pass maxSize to bound them explicitly.
await assert.rejects(async () => {
  for await (const _ of (await zip.get('big.bin')).contentIterator({ maxSize: 1024 }));
}, { code: 'ERR_ZIP_ENTRY_TOO_LARGE' });
