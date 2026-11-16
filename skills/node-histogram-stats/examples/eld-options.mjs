// @node-skills {"added":["v26.11.0"]}
// monitorEventLoopDelay lowest/highest/figures (ignored silently before v26.11.0).
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

assert.throws(() => monitorEventLoopDelay({ figures: 9 }), { code: 'ERR_OUT_OF_RANGE' });
// Interval samples include `resolution`, so keep `highest` well above resolution*1e6.
using h = monitorEventLoopDelay({ resolution: 10, lowest: 1000, highest: 10e9, figures: 2 });
h.enable();
await sleep(50);
assert.equal(h.exceeds, 0);
const tiny = monitorEventLoopDelay({ resolution: 10, highest: 2000 }); // too small
tiny.enable();
await sleep(50);
tiny.disable();
assert.equal(tiny.count, 0);
assert.ok(tiny.exceeds > 0); // dropped samples are only counted in `exceeds`
