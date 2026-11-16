// @node-skills {"added":["v26.8.0"]}
// Append to / delete from an existing zip in place, then compact away the dead space.
import { ZipFile, ZipEntry, createZipArchiveSync } from 'node:zlib';
import { mkdtempDisposable, writeFile, stat, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-append-'));
const file = join(tmp.path, 'a.zip');
// ZipFile cannot create a file; start from an (empty) archive if needed.
await writeFile(file, Buffer.concat([...createZipArchiveSync([ZipEntry.createSync('old.txt', Buffer.from('old '.repeat(500)))])]));
await assert.rejects(ZipFile.open(join(tmp.path, 'missing.zip'), { writable: true }), { code: 'ENOENT' });

{
  await using ro = await ZipFile.open(file);
  await assert.rejects(ro.add('x', Buffer.from('x')), { code: 'ERR_ZIP_NOT_WRITABLE' });
}

const before = (await stat(file)).size;
{
  await using zip = await ZipFile.open(file, { writable: true });
  await zip.add('new.txt', Buffer.from('new'));               // written to disk when the promise settles
  await zip.add('new.txt', Buffer.from('replaced'));          // same name replaces (old bytes become dead space)
  assert.equal(await zip.delete('old.txt'), true);            // only rewrites the central directory
  assert.equal(await zip.delete('nope'), false);
  async function* gen() { yield Buffer.from('streamed'); }
  await zip.addEntry(ZipEntry.createStream('s.txt', gen()));  // streaming entries are promoted to file-backed
  assert.equal((await (await zip.get('s.txt')).content()).toString(), 'streamed');
  assert.deepEqual([...zip.keys()], ['new.txt', 's.txt']);

  // Remove dead space: compact() streams a fresh archive; it does not modify the open file.
  await pipeline(zip.compact(), createWriteStream(file + '.tmp'));
}
const grown = (await stat(file)).size;
assert.ok(grown > before);
await rename(file + '.tmp', file);
assert.ok((await stat(file)).size < grown); // dead space from the replaced/deleted members is gone
using again = ZipFile.openSync(file);
assert.equal(again.getSync('new.txt').contentSync().toString(), 'replaced');
