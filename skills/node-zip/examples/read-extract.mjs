// @node-skills {"added":["v26.8.0"]}
// Read a zip on disk and extract it safely (Zip Slip guard, symlinks skipped, size cap).
import { ZipFile, ZipEntry, createZipArchiveSync } from 'node:zlib';
import { mkdtempDisposable, writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep, dirname } from 'node:path';
import assert from 'node:assert/strict';

await using tmp = await mkdtempDisposable(join(tmpdir(), 'zip-extract-'));
const archive = join(tmp.path, 'in.zip');
await writeFile(archive, Buffer.concat([...createZipArchiveSync([
  ZipEntry.createSync('dir/', Buffer.alloc(0)),
  ZipEntry.createSync('dir/a.txt', Buffer.from('alpha')),
  ZipEntry.createSync('../../escape.txt', Buffer.from('evil')),   // names are returned verbatim
  ZipEntry.createSymlink('link', '/etc/passwd'),
])]));

function safeTarget(root, name) {
  const target = resolve(root, name);
  if (target !== root && !target.startsWith(root + sep)) return null; // ../, absolute, drive letters
  return target;
}

const dest = join(tmp.path, 'out');
await mkdir(dest);
const skipped = [];
{
  await using zip = await ZipFile.open(archive);        // reads only the central directory
  for (const [name, pending] of zip.entries()) {        // values are Promise<ZipEntry>
    const entry = await pending;
    const target = safeTarget(dest, name);
    if (!target || entry.isSymlink) { skipped.push(name); continue; }
    if (entry.isDirectory) { await mkdir(target, { recursive: true }); continue; }
    await mkdir(dirname(target), { recursive: true });
    // content() verifies CRC-32 and refuses declared sizes above maxSize before allocating.
    await writeFile(target, await entry.content({ maxSize: 10 * 1024 * 1024 }));
  }
}
assert.deepEqual(skipped, ['../../escape.txt', 'link']);
assert.equal(await readFile(join(dest, 'dir', 'a.txt'), 'utf8'), 'alpha');
assert.deepEqual(await readdir(dest), ['dir']);

// Lookups: get() rejects with ERR_ZIP_ENTRY_NOT_FOUND; has() is synchronous.
{
  using zip = ZipFile.openSync(archive);
  assert.equal(zip.has('dir/a.txt'), true);
  assert.equal(zip.size, 4);
  const e = zip.getSync('dir/a.txt');
  assert.equal(e.isFile, true);
  assert.ok(e.modified instanceof Date);
  assert.throws(() => zip.getSync('missing'), { code: 'ERR_ZIP_ENTRY_NOT_FOUND' });
  assert.equal(zip.get('link').constructor, Promise);
}
