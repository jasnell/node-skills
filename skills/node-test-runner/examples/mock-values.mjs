// @node-skills {"added":["v27.0.0"]}
// mockReturnValue / mockResolvedValue / mockRejectedValue / mockThrownValue.
import { test } from 'node:test';
import assert from 'node:assert/strict';

await test('mock value helpers', async (t) => {
  const fn = t.mock.fn(() => 'original');
  const ret = fn.mock.mockReturnValue(42);
  assert.equal(ret, undefined);                   // not chainable (unlike jest)
  fn.mock.mockImplementationOnce(() => 'once');   // *Once still takes precedence for its call
  assert.deepEqual([fn(), fn(), fn()], ['once', 42, 42]);
  fn.mock.mockResolvedValue('ok');
  assert.equal(await fn(), 'ok');
  fn.mock.mockRejectedValue(new Error('rejected'));
  await assert.rejects(fn(), /rejected/);
  fn.mock.mockThrownValue(new TypeError('thrown'));
  assert.throws(() => fn(), TypeError);
  assert.equal(fn.mock.callCount(), 6);
});
