// @node-skills {"added":["v25.4.0","v24.14.0"],"timeout":30000}
// Built-in proxy support: http.setGlobalProxyFromEnv() at runtime, NODE_USE_ENV_PROXY=1 / --use-env-proxy at startup.
// The "proxy" is a loopback server; origin.test is never resolved.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { promisify } from 'node:util';

const seen = [];
const proxy = http.createServer((req, res) => { seen.push(`${req.method} ${req.url}`); res.end('via proxy'); });
proxy.on('connect', (req, sock) => { seen.push(`CONNECT ${req.url}`); sock.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
proxy.listen(0, '127.0.0.1');
await once(proxy, 'listening');
const HTTP_PROXY = `http://127.0.0.1:${proxy.address().port}`;
const get = (url) => new Promise((resolve) => {
  http.get(url, (r) => { let d = ''; r.on('data', (x) => { d += x; }); r.on('end', () => resolve(d)); })
    .on('error', (e) => resolve(e.code));
});

const restore = http.setGlobalProxyFromEnv({ HTTP_PROXY, NO_PROXY: 'direct.test' }); // default arg: process.env
assert.equal(await get('http://origin.test/a'), 'via proxy');
assert.equal(await get('http://direct.test/b'), 'ENOTFOUND');  // NO_PROXY bypass
const viaFetch = await fetch('http://origin.test/c').then((r) => r.text(), () => 'failed');
restore();                                                      // back to the previous agents/dispatcher
assert.equal(await get('http://origin.test/d'), 'ENOTFOUND');

const major = Number(process.versions.node.split('.')[0]);
if (major >= 26) {
  assert.equal(viaFetch, 'via proxy');
  assert.deepEqual(seen, ['GET http://origin.test/a', 'GET http://origin.test/c']);
} else {
  // v24: fetch() tunnels even http:// URLs with CONNECT, so the proxy must support CONNECT.
  assert.deepEqual(seen, ['GET http://origin.test/a', 'CONNECT origin.test:80']);
}

// Startup form (also: node --use-env-proxy). Only affects the global agents and fetch.
seen.length = 0;
const { stdout } = await promisify(execFile)(process.execPath, ['-e', `
  require('node:http').get('http://origin.test/e', (r) => r.pipe(process.stdout));
`], { env: { ...process.env, NODE_USE_ENV_PROXY: '1', HTTP_PROXY } });
assert.equal(stdout, 'via proxy');
assert.deepEqual(seen, ['GET http://origin.test/e']);
proxy.close();
