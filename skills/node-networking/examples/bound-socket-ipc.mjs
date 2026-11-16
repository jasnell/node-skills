// @node-skills {"added":["v26.10.0","v24.22.0"],"timeout":30000}
// Send an un-adopted TCP BoundSocket to a child process over IPC; the child listens on the reserved port.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

if (process.argv[2] === 'child') {
  process.once('message', (_msg, bound) => {
    const server = net.createServer((c) => c.end('from child')).listen(bound, () => process.send('ready'));
    process.once('message', () => server.close(() => process.disconnect()));
  });
} else {
  const bound = new net.BoundSocket({ host: '127.0.0.1' });
  const { port } = bound.address();
  const child = fork(fileURLToPath(import.meta.url), ['child']);
  child.send('take', bound); // pipe (`path`) binds cannot be sent
  await once(child, 'message');
  assert.throws(() => bound.address(), { code: 'ERR_SOCKET_HANDLE_ADOPTED' }); // source is now "adopted"

  const sock = net.connect(port, '127.0.0.1');
  let data = '';
  for await (const chunk of sock) data += chunk;
  assert.equal(data, 'from child');
  child.send('bye');
  await once(child, 'exit');
}
