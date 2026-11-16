// @node-skills {"added":["v28.0.0"],"timeout":20000}
// The "worker" export condition matches inside a Web Worker (global `Worker`,
// on by default only on main / v28.0.0-pre), but not in node:worker_threads.
import assert from 'node:assert/strict';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';

const dir = mkdtempSync(join(tmpdir(), 'wcond-'));
try {
  const file = (p, s) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), s); };
  file('node_modules/env/package.json', JSON.stringify({
    name: 'env', type: 'module',
    exports: { worker: './worker.js', default: './main.js' },
  }));
  file('node_modules/env/worker.js', "export default 'worker';");
  file('node_modules/env/main.js', "export default 'default';");
  file('web.mjs', "import env from 'env'; postMessage(env);");
  file('thread.mjs', "import env from 'env'; import { parentPort } from 'node:worker_threads'; parentPort.postMessage(env);");

  assert.equal(typeof globalThis.Worker, 'function');
  const web = new Worker(pathToFileURL(join(dir, 'web.mjs')), { type: 'module' });
  const [ev] = await once(web, 'message');
  web.terminate();
  assert.equal(ev.data, 'worker');

  const thread = new ThreadWorker(join(dir, 'thread.mjs'));
  const [msg] = await once(thread, 'message');
  await thread.terminate();
  assert.equal(msg, 'default');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
