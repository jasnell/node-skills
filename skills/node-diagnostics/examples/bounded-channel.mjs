// @node-skills {"added":["v26.1.0"]}
// boundedChannel: sync-only start/end tracing, via run() or a `using` scope; bound stores are entered.
import assert from 'node:assert/strict';
import { boundedChannel, channel, BoundedChannel } from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';

const bc = boundedChannel('mylib.parse');
assert.ok(bc instanceof BoundedChannel);
assert.equal(bc.start, channel('tracing:mylib.parse:start')); // same naming as TracingChannel
assert.equal(bc.hasSubscribers, false);

const als = new AsyncLocalStorage();
bc.start.bindStore(als, (ctx) => ({ span: ctx.id }));
const events = [];
const handlers = {
  start: (ctx) => events.push(['start', ctx.id, als.getStore()?.span]),
  end: (ctx) => events.push(['end', ctx.id, ctx.result, als.getStore()?.span]),
};
bc.subscribe(handlers);
assert.equal(bc.hasSubscribers, true);

// run(): returns fn's value but does NOT copy it onto ctx.result (unlike traceSync).
assert.equal(bc.run({ id: 1 }, () => als.getStore().span * 10), 10);
assert.deepEqual(events, [['start', 1, 1], ['end', 1, undefined, 1]]);

// withScope(): start on `using`, end on block exit; set ctx.result yourself.
events.length = 0;
const ctx = { id: 2 };
{
  using _scope = bc.withScope(ctx);
  assert.equal(als.getStore().span, 2);
  ctx.result = 'ok';
}
assert.equal(als.getStore(), undefined); // store restored
assert.deepEqual(events, [['start', 2, 2], ['end', 2, 'ok', 2]]);

// A throw inside run() still publishes end, but ctx.error is not set.
events.length = 0;
const c3 = { id: 3 };
assert.throws(() => bc.run(c3, () => { throw new Error('boom'); }), /boom/);
assert.deepEqual(events, [['start', 3, 3], ['end', 3, undefined, 3]]);
assert.equal('error' in c3, false);

assert.equal(bc.unsubscribe(handlers), true);
assert.equal(bc.hasSubscribers, true); // a bound store counts as a subscriber
bc.start.unbindStore(als);
assert.equal(bc.hasSubscribers, false);
