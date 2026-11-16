// @node-skills {"added":["v23.6.0","v22.14.0"]}
// process.ref/unref (Stable since v26.11.0; Experimental before): the "Refable protocol".
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const obj = {
  refd: true,
  [Symbol.for('nodejs.ref')]() { this.refd = true; },
  [Symbol.for('nodejs.unref')]() { this.refd = false; },
};
process.unref(obj);
assert.equal(obj.refd, false);
process.ref(obj);
assert.equal(obj.refd, true);
process.unref({});                              // non-refable values are ignored
process.unref(null);

// Works on timers: an unref'd interval does not keep the process alive.
const r = spawnSync(process.execPath, ['-e', 'const t = setInterval(() => {}, 10); process.unref(t); console.log(t.hasRef())'], { encoding: 'utf8', timeout: 5000 });
assert.equal(r.status, 0);
assert.equal(r.stdout.trim(), 'false');
