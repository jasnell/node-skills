// @node-skills {"added":["v26.9.0"],"flags":["--experimental-web-worker"]}
// Global Web Worker (26.9 behind --experimental-web-worker; on by default on main), plus the
// ErrorEvent (v25.0.0) and QuotaExceededError (v26.0.0) globals.
import { Worker as ThreadWorker } from 'node:worker_threads';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-'));
writeFileSync(join(dir.path, 'greeter.mjs'), `
addEventListener('message', (e) => postMessage(e.data + ' from ' + name + ' ' + typeof self + ' ' + typeof require));
`);
// Pass a URL: a relative string resolves against process.cwd(), not this module (observed).
const w = new Worker(pathToFileURL(join(dir.path, 'greeter.mjs')), { name: 'greeter', type: 'module' });
const reply = await new Promise((resolve, reject) => {
  w.addEventListener('message', (e) => resolve(e.data));
  w.addEventListener('error', (e) => reject(e.error ?? new Error(e.message)));
  w.postMessage('Hello');
});
w.terminate();
assert.equal(reply, 'Hello from greeter object undefined'); // module workers have no require()
assert.ok(w instanceof EventTarget);
assert.ok(!(w instanceof ThreadWorker));                   // a different class from worker_threads.Worker

const ev = new ErrorEvent('error', { message: 'boom', error: new Error('x'), filename: 'f.js', lineno: 3 });
assert.ok(ev instanceof Event);
assert.deepEqual([ev.message, ev.lineno, ev.error.message], ['boom', 3, 'x']);

const q = new QuotaExceededError('full', { quota: 10, requested: 20 });
assert.ok(q instanceof DOMException);
assert.deepEqual([q.name, q.code, q.quota, q.requested], ['QuotaExceededError', 22, 10, 20]);
