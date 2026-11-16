// @node-skills {"added":["v24.0.0"]}
// new AsyncLocalStorage({ defaultValue, name })
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage({ defaultValue: { user: 'anonymous' }, name: 'request' });
assert.equal(als.name, 'request');
assert.equal(new AsyncLocalStorage().name, ''); // not undefined
assert.deepEqual(als.getStore(), { user: 'anonymous' }); // outside any run()
als.run({ user: 'ada' }, () => assert.equal(als.getStore().user, 'ada'));
// defaultValue only applies when no store was entered: run(undefined) and exit() give undefined.
als.run(undefined, () => assert.equal(als.getStore(), undefined));
als.exit(() => assert.equal(als.getStore(), undefined));
