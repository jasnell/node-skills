// @node-skills {"added":["v25.9.0","v24.15.0"]}
// Built-in Web Locks channels: locks.request.{start,grant,miss,end}.
import assert from 'node:assert/strict';
import { subscribe } from 'node:diagnostics_channel';

const events = [];
for (const n of ['start', 'grant', 'miss', 'end']) {
  subscribe(`locks.request.${n}`, (m) => events.push(n === 'end' ? [n, m.name, m.mode, m.ifAvailable, m.steal] : [n, m.name, m.mode]));
}
await navigator.locks.request('cache', async () => {
  await navigator.locks.request('cache', { ifAvailable: true }, (lock) => assert.equal(lock, null));
});
assert.deepEqual(events, [
  ['start', 'cache', 'exclusive'],
  ['grant', 'cache', 'exclusive'],
  ['start', 'cache', 'exclusive'],
  ['miss', 'cache', 'exclusive'],
  ['end', 'cache', 'exclusive', true, false],
  ['end', 'cache', 'exclusive', false, false],
]);
