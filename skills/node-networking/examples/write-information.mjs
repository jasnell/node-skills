// @node-skills {"added":["v26.2.0","v24.18.0"]}
// response.writeInformation(): send any 1xx (except 101) before the final response; client sees 'information'.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeInformation(110, { 'X-Progress': '50%' });
  res.writeInformation(103, [['Link', '</app.css>; rel=preload']]); // writeHead() shapes accepted
  assert.throws(() => res.writeInformation(101), { code: 'ERR_HTTP_INVALID_STATUS_CODE' });
  assert.throws(() => res.writeInformation(200), { code: 'ERR_OUT_OF_RANGE' });
  res.end('done');
  assert.throws(() => res.writeInformation(110), { code: 'ERR_HTTP_HEADERS_SENT' });
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');

const info = [];
const req = http.get({ port: server.address().port, host: '127.0.0.1' });
req.on('information', (i) => info.push([i.statusCode, { ...i.headers }]));
const [res] = await once(req, 'response');
res.resume();
await once(res, 'end');
assert.deepEqual(info, [[110, { 'x-progress': '50%' }], [103, { link: '</app.css>; rel=preload' }]]);
server.close();

// HTTP/2 compat API: same method (no callback); after the final headers it is a no-op returning false.
const { default: http2 } = await import('node:http2');
const h2 = http2.createServer((req, res) => {
  res.writeInformation(110, { 'x-progress': '50%' });
  res.end('done');
  assert.equal(res.writeInformation(110), false);
});
h2.listen(0, '127.0.0.1');
await once(h2, 'listening');
const session = http2.connect(`http://127.0.0.1:${h2.address().port}`);
const stream = session.request({ ':path': '/' });
const h2info = [];
stream.on('headers', (h) => h2info.push([h[':status'], h['x-progress']]));
stream.resume();
await once(stream, 'end');
assert.deepEqual(h2info, [[110, '50%']]);
session.close();
h2.close();
