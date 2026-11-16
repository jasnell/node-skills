// @node-skills {"added":["v26.1.0","v24.16.0"]}
// Built-in test runner tracing channel 'node.test' (tracing:node.test:start|end|error).
import assert from 'node:assert/strict';
import { tracingChannel } from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';

const ctx = new AsyncLocalStorage();
const tc = tracingChannel('node.test');
tc.start.bindStore(ctx, (d) => ({ test: d.name })); // propagates into the test body
const seen = [];
tc.start.subscribe((d) => seen.push(['start', d.name, d.type, d.nesting]));
tc.end.subscribe((d) => seen.push(['end', d.name]));

test('outer', async (t) => {
  assert.equal(ctx.getStore().test, 'outer');
  await t.test('inner', () => assert.equal(ctx.getStore().test, 'inner'));
});

process.on('exit', () => {
  // The runner's root also emits start/end, named '<root>' (undocumented).
  assert.deepEqual(seen, [
    ['start', 'outer', 'test', 0], ['start', 'inner', 'test', 1],
    ['end', 'inner'], ['end', 'outer'],
    ['start', '<root>', 'test', 0], ['end', '<root>'],
  ]);
});
