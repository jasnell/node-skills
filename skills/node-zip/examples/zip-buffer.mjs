// @node-skills {"added":["v26.8.0"]}
// Edit an archive held in memory with ZipBuffer (zero-copy view; edits never touch the source bytes).
import { ZipBuffer, ZipEntry, createZipArchiveSync } from 'node:zlib';
import assert from 'node:assert/strict';

const source = Buffer.concat([...createZipArchiveSync([
  ZipEntry.createSync('keep.txt', Buffer.from('keep')),
  ZipEntry.createSync('drop.txt', Buffer.from('drop')),
], 'v1')]);
const snapshot = Buffer.from(source);

const zip = new ZipBuffer(source); // do not mutate `source` while zip or its entries are in use
assert.equal(zip.comment, 'v1');
assert.equal(zip.size, 2);
for (const [name, entry] of zip) assert.equal(typeof entry.size, 'number', name); // [name, ZipEntry] pairs
await zip.add('new.txt', Buffer.from('new'));
zip.addSync('keep.txt', Buffer.from('replaced'));  // same name replaces
assert.equal(zip.delete('drop.txt'), true);
assert.ok(source.equals(snapshot));                  // the source buffer is never modified

const out = await zip.toBuffer({ comment: 'v2' });   // or toBufferSync(); a string is shorthand for the comment
const reread = new ZipBuffer(out);
assert.deepEqual([...reread.keys()], ['keep.txt', 'new.txt']);
assert.equal(reread.comment, 'v2');
assert.equal(reread.get('keep.txt').contentSync().toString(), 'replaced');
assert.throws(() => reread.get('drop.txt'), { code: 'ERR_ZIP_ENTRY_NOT_FOUND' });

// ZipEntry.read() parses entries without building an index.
assert.deepEqual([...ZipEntry.read(out)].map((e) => e.name), ['keep.txt', 'new.txt']);
