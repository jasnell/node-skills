// @node-skills {"added":["v25.0.0","v24.12.0"]}
// v8.startCpuProfile(): synchronous, in-thread CPU profile of a code section.
import assert from 'node:assert/strict';
import v8 from 'node:v8';

function hot() { let x = 0; for (let i = 0; i < 3e6; i++) x += Math.sqrt(i); return x; }

const handle = v8.startCpuProfile({ sampleInterval: 1 }); // ms
hot();
const json = handle.stop(); // string: Chrome .cpuprofile format
const profile = JSON.parse(json);
assert.deepEqual(Object.keys(profile).sort(), ['endTime', 'nodes', 'samples', 'startTime', 'timeDeltas']);
assert.ok(profile.nodes.some((n) => n.callFrame.functionName === 'hot'));
assert.equal(handle.stop(), undefined); // a second stop() returns nothing

// `using` stops the profile and discards it on scope exit.
{
  using _p = v8.startCpuProfile();
  hot();
}
// Write `json` to a *.cpuprofile file to open it in Chrome DevTools.
