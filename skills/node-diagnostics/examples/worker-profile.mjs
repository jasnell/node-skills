// @node-skills {"added":["v24.9.0"]}
// worker.startCpuProfile() / worker.startHeapProfile(): profile a Worker from the parent; async handles.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';

const w = new Worker(`
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', (n) => { let x = 0; for (let i = 0; i < n; i++) x += i; parentPort.postMessage(x); });
`, { eval: true });
await once(w, 'online');

const cpu = await w.startCpuProfile({ sampleInterval: 1 });
w.postMessage(1e7);
await once(w, 'message');
const cpuProfile = JSON.parse(await cpu.stop()); // stop() returns a Promise<string>
assert.ok(Array.isArray(cpuProfile.nodes));

const heap = await w.startHeapProfile();
const heapProfile = JSON.parse(await heap.stop());
assert.ok(heapProfile.head && Array.isArray(heapProfile.samples));

{
  await using _p = await w.startCpuProfile(); // Symbol.asyncDispose: stop and discard
}

await w.terminate();
await assert.rejects(w.startCpuProfile(), { code: 'ERR_WORKER_NOT_RUNNING' });
