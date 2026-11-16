// @node-skills {"added":["v26.9.0"]}
// --allow-openssl-store, --allow-ffi, --allow-fs-vfs. STORE and FFI access is not checked against fs.read.
import { spawnSync, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const run = (flags, code) => {
  const r = spawnSync(process.execPath, [...flags, '-e', code],
    { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const tryIt = (body) => `let r; try { ${body}; r = 'ok'; } catch (e) { r = [e.code, e.permission ?? null]; } console.log(JSON.stringify(r));`;

// OpenSSL STORE URL in createPrivateKey.
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'perm-store-')));
try {
  const pem = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  writeFileSync(join(dir, 'k.pem'), pem);
  const load = tryIt(`require('node:crypto').createPrivateKey(new URL(${JSON.stringify(pathToFileURL(join(dir, 'k.pem')).href)}))`);
  assert.deepEqual(run(['--permission'], load), ['ERR_ACCESS_DENIED', 'OpenSSLStore']);
  // Allowed with no --allow-fs-read at all: the loader reads the file itself.
  assert.equal(run(['--permission', '--allow-openssl-store'], load), 'ok');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// FFI (only in builds with node:ffi).
let hasFfi = true;
try { execFileSync(process.execPath, ['-e', 'require("node:ffi")'], { stdio: 'ignore' }); } catch { hasFfi = false; }
if (hasFfi && process.platform === 'linux') {
  const open = tryIt(`new (require('node:ffi').DynamicLibrary)('libc.so.6')`);
  assert.deepEqual(run(['--permission'], open), ['ERR_ACCESS_DENIED', 'FFI']);
  assert.equal(run(['--permission', '--allow-ffi'], open), 'ok');
}

// VFS mounting: ERR_INVALID_STATE (not ERR_ACCESS_DENIED). node:vfs needs --experimental-vfs before v27.
const vfsFlags = process.allowedNodeEnvironmentFlags.has('--experimental-vfs') &&
  spawnSync(process.execPath, ['-e', 'require("node:vfs")']).status !== 0 ? ['--experimental-vfs'] : [];
const mount = tryIt(`require('node:vfs').create().mount('/perm-example-vfs')`);
assert.deepEqual(run(['--permission', ...vfsFlags], mount), ['ERR_INVALID_STATE', null]);
assert.equal(run(['--permission', '--allow-fs-vfs', ...vfsFlags], mount), 'ok');
