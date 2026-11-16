// @node-skills {"added":["v24.0.0"]}
// Changed behavior by release line: keepAliveTimeout default (v27: 65 s) and the 'upgrade' request body (v26).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';

const major = Number(process.versions.node.split('.')[0]);

// keepAliveTimeout: 5000 before v27, 65000 from v27. Pin it explicitly if a proxy/LB depends on it.
assert.equal(http.createServer().keepAliveTimeout, major >= 27 ? 65_000 : 5_000);
assert.equal(http.createServer({ keepAliveTimeout: 5_000 }).keepAliveTimeout, 5_000);
assert.equal(http.createServer().keepAliveTimeoutBuffer, 1_000); // v24.6.0, v22.19.0: socket timeout = sum

// 'upgrade' with a request body: v26+ parses the body onto `req`; the stream/head carry only what follows.
const server = http.createServer().listen(0, '127.0.0.1');
await once(server, 'listening');
const result = Promise.withResolvers();
server.on('upgrade', (req, stream, head) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  setTimeout(() => { result.resolve({ body, head: String(head) }); stream.destroy(); }, 50);
});
const c = net.connect(server.address().port, '127.0.0.1');
c.on('error', () => {});
c.write('POST / HTTP/1.1\r\nHost: x\r\nUpgrade: demo\r\nConnection: Upgrade\r\nContent-Length: 5\r\n\r\nhelloFRAME');
const { body, head } = await result.promise;
if (major >= 26) assert.deepEqual({ body, head }, { body: 'hello', head: 'FRAME' });
else assert.deepEqual({ body, head }, { body: '', head: 'helloFRAME' }); // raw body leaked into head
c.destroy();
server.close();
