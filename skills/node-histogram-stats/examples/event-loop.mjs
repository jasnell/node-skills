// @node-skills {"added":["v26.5.0","v24.19.0"]}
// Event-loop lag: monitorEventLoopDelay (ns), ELU (ms), top-level aliases.
import { monitorEventLoopDelay, eventLoopUtilization, timerify, performance, createHistogram } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

// samplePerIteration: one sample per loop turn, does not keep the loop alive.
const perTurn = monitorEventLoopDelay({ samplePerIteration: true });
perTurn.enable();
for (let i = 0; i < 10; i++) await sleep(1);
perTurn.disable();
assert.ok(perTurn.count > 0); // roughly one per turn; exact count varies under load

// Interval mode (default resolution 10 ms): every sample INCLUDES the resolution.
const interval = monitorEventLoopDelay({ resolution: 10 });
interval.enable();
await sleep(50);
const end = Date.now() + 40;
while (Date.now() < end); // block the loop ~40 ms
await sleep(20);
interval.disable();
// Samples include the resolution, so the median sits at ~10e6 ns. Under CPU load
// timer jitter can put an individual sample (even `min`) slightly below it.
assert.ok(interval.percentile(50) >= 9e6);
assert.ok(interval.max >= 30e6);
const lagMs = (interval.percentile(99) - 10e6) / 1e6; // subtract resolution
assert.ok(lagMs > 20);

// Aliases (v24.12.0+): same functions as performance.*.
assert.equal(eventLoopUtilization, performance.eventLoopUtilization);
assert.equal(timerify, performance.timerify);
const e1 = eventLoopUtilization();
await sleep(5);
const elu = eventLoopUtilization(e1); // delta; idle/active in ms
assert.ok(elu.utilization >= 0 && elu.utilization <= 1);

const th = createHistogram();
const f = timerify((x) => x * 2, { histogram: th }); // records ns
f(1);
assert.equal(th.count, 1);
