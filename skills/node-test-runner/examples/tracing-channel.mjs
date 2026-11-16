// @node-skills {"added":["v26.1.0","v24.16.0"]}
// The 'node.test' TracingChannel: start/end/error per test, and bindStore() for per-test context.
import dc from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const als = new AsyncLocalStorage();
const ch = dc.tracingChannel('node.test');
ch.start.bindStore(als, (data) => ({ span: `${data.type}:${data.name}` })); // e.g. start an OTel span here
const seen = [];
const own = (fn) => (d) => { if (d.name !== '<root>') fn(d); }; // in-process runs also trace the '<root>' test
ch.start.subscribe(own((d) => seen.push(`start ${d.name}`)));
ch.error.subscribe(own((d) => seen.push(`error ${d.name}: ${d.error.message}`)));
ch.end.subscribe(own((d) => seen.push(`end ${d.name}`)));

await test('db query', async () => {
  await new Promise((r) => setTimeout(r, 1));
  assert.deepEqual(als.getStore(), { span: 'test:db query' }); // propagated through async work
});
await test('expected crash', { expectFailure: true }, () => { throw new Error('boom'); });
assert.deepEqual(seen, ['start db query', 'end db query', 'start expected crash', 'error expected crash: boom', 'end expected crash']);
