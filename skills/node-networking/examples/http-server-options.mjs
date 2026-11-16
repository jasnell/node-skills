// @node-skills {"added":["v26.3.0","v24.19.0"]}
// http.createServer({ optimizeEmptyRequests, httpValidation }) and http.request({ httpValidation }).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';

// optimizeEmptyRequests (v25.1.0, v24.12.0): bodyless requests start ended and emit no 'data'/'end'.
const events = [];
const fast = http.createServer({ optimizeEmptyRequests: true }, async (req, res) => {
  const startedEnded = req.readableEnded;
  req.on('end', () => events.push('end'));
  let body = '';
  for await (const chunk of req) body += chunk; // async iteration still finishes
  setTimeout(() => res.end(JSON.stringify([startedEnded, body])), 20);
});
fast.listen(0, '127.0.0.1');
await once(fast, 'listening');
const url = `http://127.0.0.1:${fast.address().port}/`;
assert.equal(await (await fetch(url)).text(), '[true,""]');
assert.deepEqual(events, []); // once(req, 'end') would hang
assert.equal(await (await fetch(url, { method: 'POST', body: 'x' })).text(), '[false,"x"]');
fast.close();

// httpValidation: 'strict' (default) | 'relaxed' | 'insecure'. Observed: strict rejects control chars,
// relaxed accepts them, and bytes 0x80-0xFF pass in every mode.
async function sendHeader(opts, value) {
  const s = http.createServer(opts, (req, res) => res.end(req.headers['x-t'])).listen(0, '127.0.0.1');
  await once(s, 'listening');
  const c = net.connect(s.address().port, '127.0.0.1');
  c.end(Buffer.concat([Buffer.from('GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\nX-T: '), value, Buffer.from('\r\n\r\n')]));
  let out = '';
  for await (const chunk of c) out += chunk;
  s.close();
  return out.split('\r\n')[0];
}
assert.equal(await sendHeader({}, Buffer.from('a\x01b')), 'HTTP/1.1 400 Bad Request');
assert.equal(await sendHeader({ httpValidation: 'relaxed' }, Buffer.from('a\x01b')), 'HTTP/1.1 200 OK');
assert.equal(await sendHeader({}, Buffer.from([0x61, 0xe9])), 'HTTP/1.1 200 OK');
assert.throws(() => http.createServer({ httpValidation: 'insecure', insecureHTTPParser: true }), { code: 'ERR_INVALID_ARG_VALUE' });

// Client side: tolerate a sloppy upstream's response headers.
const upstream = net.createServer((c) => c.once('data', () => c.end('HTTP/1.1 200 OK\r\nX-T: a\x01b\r\nContent-Length: 0\r\n\r\n')));
upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const get = (httpValidation) => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port: upstream.address().port, httpValidation }, (r) => { r.resume(); resolve(r.headers['x-t']); })
    .on('error', (e) => resolve(e.code));
});
assert.equal(await get(undefined), 'HPE_INVALID_HEADER_TOKEN');
assert.equal(await get('relaxed'), 'a\x01b');
upstream.close();
