// @node-skills {"added":["v27.0.0"]}
// subprocess.timedOut / error.timedOut: the child_process `timeout` option (not --process-timeout).
import { spawn, execFile, execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const killed = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 100 });
await new Promise((resolve) => killed.on('exit', resolve));
assert.equal(killed.timedOut, true);
assert.equal(killed.signalCode, 'SIGTERM'); // default killSignal

const quick = spawn(process.execPath, ['-e', '0'], { timeout: 10_000 });
await new Promise((resolve) => quick.on('exit', resolve));
assert.equal(quick.timedOut, false);

const err = await new Promise((resolve) => execFile(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 100 }, resolve));
assert.equal(err.timedOut, true);
assert.equal(err.killed, true);

// Sync variants have no timedOut: check err.code === 'ETIMEDOUT'.
assert.throws(() => execSync(`"${process.execPath}" -e "setInterval(() => {}, 1000)"`, { timeout: 100, stdio: 'ignore' }),
  (e) => e.code === 'ETIMEDOUT' && e.timedOut === undefined);
