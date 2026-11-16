// @node-skills {"added":["v26.13.0"]}
// Transfer a BoundSocket (or a listening net.Server / fresh net.Socket) to a worker via transferList.
// Version is undocumented: works on v26.13.0 and main, fails on v24.19.0 ("Found invalid value in transferList").
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';
import { Worker } from 'node:worker_threads';

const bound = new net.BoundSocket({ host: '127.0.0.1' });
const { port } = bound.address();
const worker = new Worker(`
  const { parentPort } = require('node:worker_threads');
  const net = require('node:net');
  parentPort.once('message', ({ bound }) => {
    const server = net.createServer((c) => { c.end('from worker'); server.close(); });
    server.listen(bound, () => parentPort.postMessage(server.address().port));
  });
`, { eval: true });
worker.postMessage({ bound }, [bound]);
assert.throws(() => bound.address(), { code: 'ERR_SOCKET_HANDLE_ADOPTED' });
const [workerPort] = await once(worker, 'message');
assert.equal(workerPort, port);
let data = '';
for await (const chunk of net.connect(port, '127.0.0.1')) data += chunk;
assert.equal(data, 'from worker');
await worker.terminate();
