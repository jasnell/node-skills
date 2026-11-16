// @node-skills {"added":["v26.10.0"],"flags":["--experimental-vfs","--no-warnings"]}
// Load modules from a ZIP: (1) in-process with ZipProvider, (2) as an app with --vfs-load.
import vfs from 'node:vfs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { ZipBuffer, ZipEntry, createZipArchiveSync } from 'node:zlib';

const zipBytes = Buffer.concat([...createZipArchiveSync([
  ZipEntry.createSync('package.json', Buffer.from('{"type":"module","main":"main.js"}')),
  ZipEntry.createSync('main.js', Buffer.from(
    'import { add } from "./lib/math.js";\n' +
    'console.log(JSON.stringify({ sum: add(2, 3), argv1: process.argv[1], args: process.argv.slice(2), url: import.meta.url }));')),
  ZipEntry.createSync('lib/math.js', Buffer.from('export const add = (a, b) => a + b;')),
])]);

// (1) In-process.
{
  using z = vfs.create(new vfs.ZipProvider(new ZipBuffer(zipBytes)));
  assert.equal(z.readonly, false); // ZipBuffer is writable; ZipFile only with { writable: true }
  assert.deepEqual(z.readdirSync('/', { recursive: true }).sort(), ['lib', 'lib/math.js', 'main.js', 'package.json']);
  z.mount();
  const { add } = await import(`${z.mountPointURL}/lib/math.js`);
  assert.equal(add(1, 2), 3);
}

// (2) --vfs-load picks ZipProvider from the file's bytes (any extension) and runs "main".
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-vfs-zip-'));
try {
  const app = path.join(dir, 'app.bin');
  fs.writeFileSync(app, zipBytes);
  const r = spawnSync(process.execPath, [...process.execArgv, `--vfs-load=${app}`, 'arg1'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.sum, 5);
  assert.equal(out.argv1, app); // argv[1] reports the source, not the mount point
  assert.deepEqual(out.args, ['arg1']);
  assert.match(out.url, /^file:\/\/.*\/main\.js$/);

  // --vfs-load is rejected in NODE_OPTIONS.
  const env = spawnSync(process.execPath, ['-e', '0'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: `--vfs-load=${app}` } });
  assert.notEqual(env.status, 0);
  assert.match(env.stderr, /not allowed in NODE_OPTIONS/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
