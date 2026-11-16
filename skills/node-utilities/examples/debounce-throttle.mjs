// @node-skills {"added":["v26.10.0","v24.22.0"]}
// util.debounce / util.throttle return promise-returning wrappers; util.markPromiseAsHandled.
import { debounce, throttle, markPromiseAsHandled } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

// debounce: fn runs once with the LAST call's args; every caller's promise gets that result.
const calls = [];
const save = debounce(async (v) => { calls.push(v); return v * 10; }, 30);
const ps = [save(1), save(2), save(3)];
assert.equal(save.pendingCount, 3);
assert.deepEqual(await Promise.all(ps), [30, 30, 30]);
assert.deepEqual(calls, [3]);

// rejectOnCancel: superseded calls reject with AbortError instead.
const d2 = debounce((v) => v, 20, { rejectOnCancel: true });
const first = d2(1);
const second = d2(2);
await assert.rejects(first, { name: 'AbortError' });
assert.equal(await second, 2);

// cancel(reason) rejects pending promises (reason becomes .cause); flush() runs now.
const d3 = debounce((v) => v, 1000);
const c = d3('x');
d3.cancel(new Error('shutdown'));
await assert.rejects(c, (e) => e.name === 'AbortError' && e.cause.message === 'shutdown');
const f = d3('y');
d3.flush();
assert.equal(await f, 'y');

// leading: first call runs immediately; a trailing call only if called again in the window.
const lead = [];
const d4 = debounce((v) => lead.push(v), 30, { leading: true });
d4(1); d4(2); d4(3);
assert.deepEqual(lead, [1]);
await sleep(60);
assert.deepEqual(lead, [1, 3]);

// throttle(fn, limit, interval): at most `limit` starts per window; extra calls QUEUE by default.
const t0 = Date.now();
const starts = [];
const req = throttle(async (i) => { starts.push(Date.now() - t0); return i; }, 2, 100);
assert.deepEqual(await Promise.all([1, 2, 3, 4, 5].map((i) => req(i))), [1, 2, 3, 4, 5]);
assert.ok(starts[2] - starts[0] >= 90 && starts[4] - starts[0] >= 190, String(starts)); // 2 + 2 + 1 per 100 ms window

// overflow: 'drop' (or a full maxPending queue) rejects with ERR_THROTTLED; those promises are pre-handled.
const drop = throttle(() => 1, 1, 100, { overflow: 'drop' });
await drop();
await assert.rejects(drop(), { code: 'ERR_THROTTLED' });
drop();                                               // ignored rejection: no unhandledRejection

// concurrency caps unsettled invocations independently of the rate.
const one = throttle(() => sleep(20), 100, 1000, { concurrency: 1 });
const a = one(); const b = one();
assert.equal(one.activeCount, 1);
assert.equal(one.pendingCount, 1);
await Promise.all([a, b]);

// markPromiseAsHandled: suppress unhandledRejection for a promise you deliberately ignore.
let unhandled = 0;
process.on('unhandledRejection', () => unhandled++);
markPromiseAsHandled(Promise.reject(new Error('ignored')));
await sleep(20);
assert.equal(unhandled, 0);
