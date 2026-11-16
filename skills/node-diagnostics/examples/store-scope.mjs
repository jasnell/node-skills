// @node-skills {"added":["v26.1.0"]}
// channel.withStoreScope(data): publish + enter bound stores until the `using` block ends.
import assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
const ch = channel('mylib.request');
ch.bindStore(als, (msg) => ({ ...msg, traced: true }));
const published = [];
ch.subscribe((msg) => published.push(msg));

{
  using _outer = ch.withStoreScope({ req: 'outer' });
  {
    using _inner = ch.withStoreScope({ req: 'inner' });
    assert.deepEqual(als.getStore(), { req: 'inner', traced: true });
  }
  assert.deepEqual(als.getStore(), { req: 'outer', traced: true });
}
assert.equal(als.getStore(), undefined);
assert.deepEqual(published, [{ req: 'outer' }, { req: 'inner' }]); // subscribers get the raw message

// Manual disposal is idempotent.
const s = ch.withStoreScope({ req: 'manual' });
s[Symbol.dispose]();
s[Symbol.dispose]();
assert.equal(als.getStore(), undefined);

// Pitfall: a scope opened in an async function before its first await leaks into the caller.
async function handler() {
  using _s = ch.withStoreScope({ req: 'leaky' });
  await null;
}
await handler();
assert.equal(als.getStore().req, 'leaky');
