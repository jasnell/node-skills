// @node-skills {"added":["v25.0.0"]}
// Recipe: run a script with read-only ./data plus network. --allow-net is all-or-nothing:
// a value such as --allow-net=<host> is accepted and still grants ALL network access.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'perm-recipe-')));
const server = createServer((s) => s.end('pong')).listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();

function run(flags) {
  const child = spawn(process.execPath, [...flags, 'untrusted.mjs', String(port)],
    { cwd: dir, env: { ...process.env, NODE_OPTIONS: '' } });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  return once(child, 'close').then(([code]) => ({ code, out: JSON.parse(stdout) }));
}

try {
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'data', 'in.txt'), 'input');
  writeFileSync(join(dir, 'untrusted.mjs'), `
    import { readFileSync, writeFileSync } from 'node:fs';
    import { connect } from 'node:net';
    const out = {};
    try { out.read = readFileSync('data/in.txt', 'utf8'); } catch (e) { out.read = e.code; }
    try { writeFileSync('data/out.txt', 'x'); out.write = 'ok'; } catch (e) { out.write = e.code; }
    try { readFileSync('/etc/hostname'); out.outside = 'ok'; } catch (e) { out.outside = e.code; }
    out.net = await new Promise((resolve) => {
      const c = connect(Number(process.argv[2]), '127.0.0.1');
      c.on('data', (d) => resolve(String(d)));
      c.on('error', (e) => resolve(e.code));
    });
    console.log(JSON.stringify(out));
  `);

  // The entrypoint is readable implicitly; nothing else outside ./data is.
  const ok = await run(['--permission', '--allow-fs-read=./data', '--allow-net']);
  assert.deepEqual(ok.out, { read: 'input', write: 'ERR_ACCESS_DENIED', outside: 'ERR_ACCESS_DENIED', net: 'pong' });
  assert.equal(existsSync(join(dir, 'data', 'out.txt')), false);

  // Without --allow-net, connect() fails asynchronously with ERR_ACCESS_DENIED.
  const noNet = await run(['--permission', '--allow-fs-read=./data']);
  assert.equal(noNet.out.net, 'ERR_ACCESS_DENIED');

  // Trap: there is no per-host allow list. 192.0.2.1 is not 127.0.0.1, yet the connection succeeds.
  const host = await run(['--permission', '--allow-fs-read=./data', '--allow-net=192.0.2.1']);
  assert.equal(host.out.net, 'pong');
} finally {
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
