// @node-skills {"added":["v22.0.0","v20.13.0"]}
// v8.queryObjects(ctor): count live instances after a full GC (leak regression tests).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import v8 from 'node:v8';

class Session {}
let live = Array.from({ length: 3 }, () => new Session());
const warning = once(process, 'warning');
assert.equal(v8.queryObjects(Session), 3); // default format is a count
assert.deepEqual(v8.queryObjects(Session, { format: 'summary' }), ['Session {}', 'Session {}', 'Session {}']);
live = null;
assert.equal(v8.queryObjects(Session, { format: 'count' }), 0);
// Docs say Stable since v25.4.0/v24.13.1, but it still emits an ExperimentalWarning.
const [w] = await warning;
assert.equal(w.name, 'ExperimentalWarning');
