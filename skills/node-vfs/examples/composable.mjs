// @node-skills {"added":["v26.12.0"],"flags":["--experimental-vfs","--no-warnings"]}
// Copy-on-write overlay: memory layer over a real directory. Disk is never modified.
// Also pins observed RealFSProvider symlink behavior (see meta.json discrepancies).
import vfs from 'node:vfs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-vfs-overlay-'));
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'node-vfs-outside-'));
try {
  fs.writeFileSync(path.join(dir, 'config.json'), '{"debug":false}');
  using overlay = vfs.create(new vfs.ComposableProvider([new vfs.MemoryProvider(), new vfs.RealFSProvider(dir)]));
  assert.equal(overlay.readFileSync('/config.json', 'utf8'), '{"debug":false}'); // from disk
  overlay.writeFileSync('/config.json', '{"debug":true}'); // copied up into memory
  assert.equal(overlay.readFileSync('/config.json', 'utf8'), '{"debug":true}');
  assert.equal(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'), '{"debug":false}');
  overlay.unlinkSync('/config.json'); // hides the lower copy, does not delete it
  assert.equal(overlay.existsSync('/config.json'), false);
  assert.ok(fs.existsSync(path.join(dir, 'config.json')));

  // RealFSProvider: '..' cannot climb out, but a symlink pointing outside the root IS
  // followed by readFile (only realpath refuses). It is not a sandbox.
  const real = vfs.create(new vfs.RealFSProvider(dir));
  assert.throws(() => real.readFileSync('/../../etc/hostname'), { code: 'ENOENT' });
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dir, 'link'));
  assert.equal(real.readFileSync('/link', 'utf8'), 'outside');
  assert.throws(() => real.realpathSync('/link'), { code: 'EACCES' });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
}
