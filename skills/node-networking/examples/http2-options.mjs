// @node-skills {"added":["v25.7.0","v24.15.0"]}
// HTTP/2: http1Options for the allowHTTP1 fallback, and strictSingleValueFields.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { cert, key } from './fixture-cert.cjs';

class AppRequest extends http.IncomingMessage {}
const server = http2.createSecureServer({
  key, cert, allowHTTP1: true,
  // replaces the deprecated Http1IncomingMessage / Http1ServerResponse (DEP0202)
  http1Options: { IncomingMessage: AppRequest, keepAliveTimeout: 3_000 },
}, (req, res) => res.end(`${req.httpVersion} ${req instanceof AppRequest}`));
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();

const h1 = await new Promise((resolve) => {
  https.get({ port, host: '127.0.0.1', rejectUnauthorized: false }, (r) => {
    let d = '';
    r.on('data', (x) => { d += x; });
    r.on('end', () => resolve([d, r.headers['keep-alive']]));
  });
});
assert.deepEqual(h1, ['1.1 true', 'timeout=3']);

const client = http2.connect(`https://127.0.0.1:${port}`, { rejectUnauthorized: false });
const stream = client.request({ ':path': '/' });
let d = '';
stream.on('data', (x) => { d += x; });
await once(stream, 'end');
assert.equal(d, '2.0 false'); // http1Options only affect the HTTP/1 fallback
client.close();
server.close();

// strictSingleValueFields (default true): duplicate values for single-value fields throw.
for (const strict of [undefined, false]) {
  const srv = http2.createServer({ strictSingleValueFields: strict });
  srv.on('stream', (s) => {
    try {
      s.respond({ ':status': 200, 'content-type': ['text/a', 'text/b'] });
      s.end();
    } catch (err) {
      s.respond({ ':status': 500, 'x-err': err.code });
      s.end();
    }
  });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const c = http2.connect(`http://127.0.0.1:${srv.address().port}`);
  const r = c.request({ ':path': '/' });
  r.resume();
  const [h] = await once(r, 'response');
  if (strict === false) assert.deepEqual([h[':status'], h['content-type']], [200, 'text/a']); // receiver keeps the first
  else assert.deepEqual([h[':status'], h['x-err']], [500, 'ERR_HTTP2_HEADER_SINGLE_VALUE']);
  c.close();
  srv.close();
}
