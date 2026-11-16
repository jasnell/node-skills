// @node-skills {"added":["v26.7.0","v24.20.0"]}
// message.signal: AbortSignal aborted when the client disconnects mid-request (lazy; not aborted on normal completion).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';

const aborted = Promise.withResolvers();
let finishedSignal;
const server = http.createServer((req, res) => {
  if (req.url === '/slow') {
    // Pass req.signal to fetch(), DB drivers, timers... to cancel work for a gone client.
    req.signal.addEventListener('abort', () => aborted.resolve(req.signal.reason));
    return; // never responds
  }
  finishedSignal = req.signal;
  res.end('ok');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const { port } = server.address();

const c = net.connect(port, '127.0.0.1');
c.write('GET /slow HTTP/1.1\r\nHost: x\r\n\r\n');
await new Promise((r) => setTimeout(r, 50));
c.destroy(); // client goes away
const reason = await aborted.promise;
assert.equal(reason.name, 'AbortError');

assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), 'ok');
await new Promise((r) => setTimeout(r, 50));
assert.equal(finishedSignal.aborted, false); // v24.16-24.19 / v26.1-26.6 aborted it here
server.close();
