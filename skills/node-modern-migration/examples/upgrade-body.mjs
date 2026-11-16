// @node-skills {"added":["v26.0.0"]}
// v26.0.0: an HTTP 'upgrade' request body is parsed and emitted on `req` like a
// normal request; the upgraded stream carries only the bytes after the body.
// (v24: the body arrived raw on the socket / in `head`.)
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';

const server = http.createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const client = net.connect(server.address().port, '127.0.0.1');
client.on('error', () => {});
client.write('POST / HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: foo\r\n' +
  'Content-Length: 5\r\n\r\nhelloPING');

const [req, stream, head] = await once(server, 'upgrade');
let body = '';
req.on('data', (d) => { body += d; }); // attach before reading the stream
let raw = head.toString();
stream.on('data', (d) => { raw += d; });
await new Promise((r) => setTimeout(r, 200));
assert.equal(body, 'hello');
assert.equal(raw, 'PING');
stream.destroy();
client.destroy();
server.close();
