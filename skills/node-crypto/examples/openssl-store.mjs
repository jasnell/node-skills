// @node-skills {"added":["v26.7.0","v24.21.0"]}
// createPrivateKey(URL) loads through an OpenSSL STORE loader; under --permission it needs --allow-openssl-store.
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'store-'));
try {
  const keyPath = join(dir, 'key.pem');
  writeFileSync(keyPath, generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }));
  const url = pathToFileURL(keyPath);

  // A URL object (or { key: URL, passphrase }) goes to the STORE loader; a URL *string* is parsed as PEM.
  assert.equal(createPrivateKey(url).asymmetricKeyType, 'ed25519');
  assert.equal(createPrivateKey({ key: url }).asymmetricKeyType, 'ed25519');
  assert.throws(() => createPrivateKey(url.href));

  const child = `
    const { createPrivateKey } = require('node:crypto');
    try { console.log(createPrivateKey(new URL(process.argv[1])).asymmetricKeyType, process.permission.has('openssl.store')); }
    catch (e) { console.log(e.code, e.permission); }`;
  const run = (...flags) => spawnSync(process.execPath, ['--permission', ...flags, '-e', child, url.href], { encoding: 'utf8' }).stdout.trim();

  assert.equal(run(), 'ERR_ACCESS_DENIED OpenSSLStore');
  // The loader is NOT bound by fs.read: no --allow-fs-read for the key's directory here, yet it loads.
  assert.equal(run('--allow-openssl-store'), 'ed25519 true');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
