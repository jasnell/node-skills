// @node-skills {"added":["v24.5.0"]}
// Web Locks: navigator.locks === worker_threads.locks; shared across threads of one process.
import { locks, Worker } from 'node:worker_threads';
import assert from 'node:assert/strict';

assert.equal(navigator.locks, locks);

// request() resolves with the callback's return value after the lock is released.
assert.equal(await locks.request('cache', async (lock) => `${lock.name}:${lock.mode}`), 'cache:exclusive');

// Exclusive requests queue in order; ifAvailable gets null instead of waiting.
const order = [];
const a = locks.request('db', async () => { order.push('a start'); await new Promise((r) => setTimeout(r, 20)); order.push('a end'); });
const b = locks.request('db', () => order.push('b'));
const snap = await locks.query();
assert.deepEqual([snap.held.map((l) => l.name), snap.pending.map((l) => l.name)], [['db'], ['db']]);
assert.equal(await locks.request('db', { ifAvailable: true }, (lock) => lock), null);
await Promise.all([a, b]);
assert.deepEqual(order, ['a start', 'a end', 'b']);

// signal aborts a request that has not been granted yet.
const ac = new AbortController();
const holder = locks.request('y', () => new Promise((r) => setTimeout(r, 30)));
const waiter = locks.request('y', { signal: ac.signal }, () => {});
ac.abort();
await assert.rejects(waiter, { name: 'AbortError' });
await holder;

// Shared mode lets several holders in at once.
await locks.request('cfg', { mode: 'shared' }, () => locks.request('cfg', { mode: 'shared' }, () => order.push('both shared')));
assert.equal(order.at(-1), 'both shared');

// Across worker threads: the worker waits until main releases. A queued request alone does
// not keep a worker alive (observed), so the worker holds an interval until it gets the lock.
const events = [];
const held = locks.request('file', async () => { events.push('main got'); await new Promise((r) => setTimeout(r, 50)); events.push('main release'); });
const w = new Worker(`
  const { locks, parentPort } = require('node:worker_threads');
  const keepAlive = setInterval(() => {}, 1000);
  locks.request('file', () => { parentPort.postMessage('worker got'); clearInterval(keepAlive); });
`, { eval: true });
events.push(await new Promise((r) => w.once('message', r)));
await held;
await w.terminate();
assert.deepEqual(events, ['main got', 'main release', 'worker got']);
