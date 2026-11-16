// @node-skills {"added":["v25.9.0","v24.20.0"]}
// AsyncLocalStorage.withScope(store) returns a RunScope for `using`; restores the previous store on exit.
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();
{
  using _ = als.withScope('outer');
  try {
    using _inner = als.withScope('inner');
    assert.equal(als.getStore(), 'inner');
    throw new Error('x');
  } catch {
    assert.equal(als.getStore(), 'outer'); // restored even on throw
  }
}
assert.equal(als.getStore(), undefined);

// Without `using`, call dispose() (idempotent).
const scope = als.withScope('manual');
assert.equal(als.getStore(), 'manual');
scope.dispose();
scope.dispose();
assert.equal(als.getStore(), undefined);

// Pitfall: in an async function, the scope leaks into the caller after the first await.
async function handler() {
  using _s = als.withScope('leaky');
  await null;
}
await handler();
assert.equal(als.getStore(), 'leaky');
// Use run() across awaits instead.
