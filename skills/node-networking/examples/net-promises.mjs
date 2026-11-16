// @node-skills {"added":["v27.0.0"]}
// node:net/promises — listen()/connect() return promises; a server is async-iterable over connections.
import assert from 'node:assert/strict';
import net from 'node:net';
import { connect, listen } from 'node:net/promises';

assert.equal(net.promises.connect, connect); // also reachable as require('node:net').promises

const server = await listen({ port: 0, host: '127.0.0.1' }); // resolves on 'listening'
const { port } = server.address();

const accepted = (async () => {
  const seen = [];
  for await (const socket of server) {          // ends when the server emits 'close'
    socket.end(`hello ${seen.length}`);          // don't await long work inline: it serializes accepts
    seen.push(socket.remoteAddress);
    if (seen.length === 2) server.close();
  }
  return seen;
})();

for (let i = 0; i < 2; i++) {
  const sock = await connect({ port, host: '127.0.0.1' }); // resolves on 'connect'
  let data = '';
  for await (const chunk of sock) data += chunk;
  assert.equal(data, `hello ${i}`);
}
assert.deepEqual(await accepted, ['127.0.0.1', '127.0.0.1']);

// Rejections: refused connection, and an aborted connect (the socket is destroyed).
await assert.rejects(connect({ port, host: '127.0.0.1' }), { code: 'ECONNREFUSED' });
await assert.rejects(connect({ port, host: '127.0.0.1', signal: AbortSignal.abort() }), { name: 'AbortError' });
// listen() rejects if the bind fails.
const busy = await listen({ port: 0, host: '127.0.0.1' });
await assert.rejects(listen({ port: busy.address().port, host: '127.0.0.1' }), { code: 'EADDRINUSE' });
busy.close();
