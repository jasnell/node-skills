// @node-skills {"added":["v26.12.0"]}
// context.assert.called / callCount / nthCalledWith (1-based) / lastCalledWith on mock functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

await test('mock assertions', (t) => {
  const send = t.mock.fn();
  send('a@x.dev', { retry: 1 });
  send('b@x.dev', { retry: 2 });
  t.assert.called(send);
  t.assert.callCount(send, 2);
  t.assert.nthCalledWith(send, 1, 'a@x.dev', { retry: 1 }); // deepStrictEqual on the args array
  t.assert.lastCalledWith(send, 'b@x.dev', { retry: 2 });
  assert.throws(() => t.assert.called(() => {}), { code: 'ERR_INVALID_ARG_TYPE' }); // needs a mock

  const obj = { save() {} };
  t.mock.method(obj, 'save');
  obj.save(3);
  t.assert.lastCalledWith(obj.save, 3);       // mock.method() works too
  assert.throws(() => t.assert.callCount(send, 3), { code: 'ERR_ASSERTION', message: /called 3 times, but it was called 2 times/ });
});
