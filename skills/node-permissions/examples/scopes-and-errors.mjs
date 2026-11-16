// @node-skills {"added":["v24.0.0"]}
// --permission denies fs/child/worker/wasi/addon/inspector by default; errors carry code/permission/resource.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'perm-scopes-')));
try {
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'a.txt'), 'hi');

  const probe = `
    const out = {};
    const t = (n, f) => { try { out[n] = f(); } catch (e) { out[n] = { code: e.code, permission: e.permission, resource: e.resource }; } };
    const fs = require('node:fs');
    t('read', () => fs.readFileSync('data/a.txt', 'utf8'));
    t('readOutside', () => fs.readFileSync('/etc/hostname', 'utf8'));
    t('write', () => fs.writeFileSync('data/b.txt', 'x'));
    t('spawn', () => require('node:child_process').spawnSync('true'));
    t('worker', () => new (require('node:worker_threads').Worker)('0', { eval: true }));
    t('wasi', () => new (require('node:wasi').WASI)({ version: 'preview1' }));
    t('addon', () => process.dlopen({ exports: {} }, '/nonexistent.node'));
    t('inspector', () => new (require('node:inspector').Session)().connect());
    t('has', () => [process.permission.has('fs.read', 'data/a.txt'), process.permission.has('fs.read', 'data2'),
                    process.permission.has('fs.write'), process.permission.has('no-such-scope')]);
    console.log(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['--permission', '--allow-fs-read=./data', '-e', probe],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);

  assert.equal(out.read, 'hi');
  assert.deepEqual(out.readOutside, { code: 'ERR_ACCESS_DENIED', permission: 'FileSystemRead', resource: '/etc/hostname' });
  // `resource` is the path exactly as the caller passed it (relative stays relative).
  assert.deepEqual(out.write, { code: 'ERR_ACCESS_DENIED', permission: 'FileSystemWrite', resource: 'data/b.txt' });
  assert.deepEqual(out.spawn, { code: 'ERR_ACCESS_DENIED', permission: 'ChildProcess', resource: 'true' });
  assert.deepEqual(out.worker, { code: 'ERR_ACCESS_DENIED', permission: 'WorkerThreads', resource: '' });
  assert.deepEqual(out.wasi, { code: 'ERR_ACCESS_DENIED', permission: 'WASI', resource: '' });
  // Addons use a different code and carry no permission/resource.
  assert.equal(out.addon.code, 'ERR_DLOPEN_DISABLED');
  assert.deepEqual(out.inspector, { code: 'ERR_ACCESS_DENIED', permission: 'Inspector', resource: 'Connect' });
  // An existing directory grant becomes "data/*": "data2" is not covered. Unknown scopes return false, no throw.
  assert.deepEqual(out.has, [true, false, false, false]);

  // Before --allow-net existed (v24.x), --permission does not gate the network at all.
  if (!process.allowedNodeEnvironmentFlags.has('--allow-net')) {
    const net = spawnSync(process.execPath, ['--permission', '-e', `
      const s = require('node:net').createServer().listen(0, '127.0.0.1', () => {
        console.log(process.permission.has('net')); s.close(); });`], { encoding: 'utf8' });
    assert.equal(net.status, 0, net.stderr);
    assert.equal(net.stdout.trim(), 'false'); // has('net') says false, yet listen() worked
  }

  // Pitfall: a Worker with an explicit execArgv drops the parent's permission flags.
  const w = spawnSync(process.execPath, ['--permission', '--allow-worker', '-e', `
    const { Worker } = require('node:worker_threads');
    const code = 'require("node:worker_threads").parentPort.postMessage(typeof process.permission)';
    new Worker(code, { eval: true }).on('message', (m) => console.log('default', m));
    new Worker(code, { eval: true, execArgv: [] }).on('message', (m) => console.log('empty', m));`],
  { encoding: 'utf8' });
  assert.equal(w.status, 0, w.stderr);
  assert.match(w.stdout, /default object/);
  assert.match(w.stdout, /empty undefined/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
