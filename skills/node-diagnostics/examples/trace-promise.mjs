// @node-skills {"added":["v26.5.0"]}
// tracePromise: custom thenables come back as-is (v26.5+); non-thenables come back with a warning (v26.0+).
import assert from 'node:assert/strict';
import { tracingChannel } from 'node:diagnostics_channel';
import { once } from 'node:events';

const tc = tracingChannel('mylib.query');
const events = [];
tc.subscribe({
  start: () => events.push('start'),
  end: () => events.push('end'),
  asyncStart: (ctx) => events.push(`asyncStart:${ctx.result}`),
  asyncEnd: () => events.push('asyncEnd'),
  error: () => events.push('error'),
});

class Query {
  constructor(v) { this.v = v; }
  then(ok, fail) { return Promise.resolve(this.v).then(ok, fail); }
  explain() { return 'plan'; }
}
const q = tc.tracePromise(() => new Query(5), {});
assert.ok(q instanceof Query); // not wrapped in a native Promise
assert.equal(q.explain(), 'plan');
assert.equal(await q, 5);
await new Promise((r) => setImmediate(r));
assert.deepEqual(events, ['start', 'end', 'asyncStart:5', 'asyncEnd']);

events.length = 0;
const warned = once(process, 'warning');
assert.equal(tc.tracePromise(() => 7, {}), 7); // returned as-is, no async events
const [w] = await warned;
assert.match(w.message, /returned a non-thenable/);
assert.deepEqual(events, ['start', 'end']);
