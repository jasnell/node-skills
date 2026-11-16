// @node-skills {"added":["v26.7.0","v24.20.0"]}
// BoundSocket({ path }): reserve a Unix domain socket path synchronously; isPipe is the capability probe.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.platform === 'win32') { console.log('skip: Unix domain socket paths only'); process.exit(77); }
assert.ok('isPipe' in net.BoundSocket.prototype);
const dir = mkdtempSync(join(tmpdir(), 'bsock-'));
try {
  const path = join(dir, 's.sock');
  const bound = new net.BoundSocket({ path });
  assert.equal(bound.isPipe, true);
  assert.equal(bound.address(), path);        // a string for pipes
  assert.ok(existsSync(path));                // reserved in the constructor
  assert.throws(() => new net.BoundSocket({ path }), { code: 'EADDRINUSE' });
  assert.throws(() => new net.BoundSocket({ path, port: 1 }), { code: 'ERR_INVALID_ARG_VALUE' });

  const server = net.createServer((c) => c.end('ok')).listen(bound);
  await once(server, 'listening');
  let data = '';
  for await (const chunk of net.connect(path)) data += chunk;
  assert.equal(data, 'ok');
  server.close();
  await once(server, 'close');

  const unused = new net.BoundSocket({ path: join(dir, 'u.sock') });
  unused.close();                             // removes the file system entry
  assert.equal(existsSync(join(dir, 'u.sock')), false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
