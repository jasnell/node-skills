// @node-skills {"added":["v26.1.0"]}
// v8.startHeapProfile(): synchronous sampling heap profile; only one may run at a time.
import assert from 'node:assert/strict';
import v8 from 'node:v8';

const handle = v8.startHeapProfile({ sampleInterval: 1024, stackDepth: 8 });
const keep = [];
for (let i = 0; i < 1e5; i++) keep.push({ i });
assert.throws(() => v8.startHeapProfile(), { code: 'ERR_HEAP_PROFILE_HAVE_BEEN_STARTED' });
const profile = JSON.parse(handle.stop());
assert.ok(Array.isArray(profile.samples) && profile.head);
assert.ok('selfCount' in profile.head); // Node.js extension to the DevTools format
const s = profile.samples[0];
assert.equal(s.size, s.objectSize * s.objectCount);
assert.equal(typeof s.isLive, 'boolean');

{
  using _h = v8.startHeapProfile(); // discarded on scope exit
}
v8.startHeapProfile().stop(); // a new profile can start after the previous one stopped
