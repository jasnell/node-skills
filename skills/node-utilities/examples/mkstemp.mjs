// @node-skills {"added":["v27.0.0"]}
// fs.mkstemp / mkstempSync: atomically create + open a unique temp file (mode 0600 on POSIX).
import { mkstemp, mkdtempDisposable, readFile } from 'node:fs/promises';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import assert from 'node:assert/strict';

await using dir = await mkdtempDisposable(join(tmpdir(), 'nsk-'));

// Promise form: { path, handle }. The result is NOT disposable; the FileHandle is.
const { path, handle } = await mkstemp(join(dir.path, 'upload-'));
{
  await using h = handle;
  await h.writeFile('payload');
}
assert.ok(path.startsWith(dir.path + sep + 'upload-'));
assert.equal(await readFile(path, 'utf8'), 'payload');
if (process.platform !== 'win32') assert.equal(fs.statSync(path).mode & 0o777, 0o600);

// Sync and callback forms return { path, fd }. The file is never removed automatically.
const s = fs.mkstempSync(join(dir.path, 's-'));
assert.equal(typeof s.fd, 'number');
fs.writeSync(s.fd, 'x');
fs.closeSync(s.fd);
const cb = await new Promise((resolve, reject) => fs.mkstemp(join(dir.path, 'c-'), (err, file) => (err ? reject(err) : resolve(file))));
fs.closeSync(cb.fd);
assert.deepEqual(fs.readdirSync(dir.path).length, 3);
