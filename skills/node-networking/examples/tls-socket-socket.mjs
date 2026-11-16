// @node-skills {"added":["v27.0.0"]}
// tlsSocket.socket: the underlying transport (null for clients that own their connection).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';
import { cert, key } from './fixture-cert.cjs';

const raws = new Set();
const server = tls.createServer({ key, cert }, (s) => {
  assert.ok(raws.has(s.socket)); // server side: the 'connection' socket
  s.end('x');
});
server.on('connection', (c) => raws.add(c));
const clientErrors = [];
server.on('tlsClientError', (err, s) => clientErrors.push([err.code, raws.has(s.socket)]));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();

const own = tls.connect({ port, host: '127.0.0.1', rejectUnauthorized: false });
await once(own, 'secureConnect');
assert.equal(own.socket, null);           // tls.connect({ port }) manages its own connection
assert.equal(own.remoteAddress, '127.0.0.1'); // details live on the TLSSocket itself
own.resume();
await once(own, 'end');

const rawClient = net.connect(port, '127.0.0.1');
await once(rawClient, 'connect');
const wrapped = tls.connect({ socket: rawClient, rejectUnauthorized: false });
await once(wrapped, 'secureConnect');
assert.equal(wrapped.socket, rawClient);
wrapped.resume();
await once(wrapped, 'end');

// Still available in 'tlsClientError' (after destroy) to identify the connection.
const junk = net.connect(port, '127.0.0.1');
junk.write('GET / HTTP/1.1\r\n\r\n');
await once(server, 'tlsClientError');
junk.destroy();
assert.deepEqual(clientErrors, [['ERR_SSL_HTTP_REQUEST', true]]);
server.close();
