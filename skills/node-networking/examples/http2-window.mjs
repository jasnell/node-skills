// @node-skills {"added":["v26.11.0"]}
// HTTP/2 connectionWindowSize: initial connection-level flow-control window (server and client).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http2 from 'node:http2';

const server = http2.createServer({ connectionWindowSize: 1 << 20 }, (req, res) => res.end('ok'));
let serverSession;
server.on('session', (s) => { serverSession = s; });
server.listen(0, '127.0.0.1');
await once(server, 'listening');

const client = http2.connect(`http://127.0.0.1:${server.address().port}`, { connectionWindowSize: 2 << 20 });
const req = client.request({ ':path': '/' });
req.resume();
await once(req, 'end');
assert.equal(client.state.effectiveLocalWindowSize, 2 << 20);
assert.equal(serverSession.state.effectiveLocalWindowSize, 1 << 20);
assert.equal(client.state.remoteWindowSize, 1 << 20);
client.close();
server.close();

assert.throws(() => http2.createServer({ connectionWindowSize: 0 }), { code: 'ERR_OUT_OF_RANGE' });
assert.throws(() => http2.createServer({ connectionWindowSize: 2 ** 31 }), { code: 'ERR_OUT_OF_RANGE' });
