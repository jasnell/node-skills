// @node-skills {"added":["v25.9.0"]}
// process.addUncaughtExceptionCaptureCallback: several coexisting handlers, newest first;
// returning true stops the chain and the default handling.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const script = `
const seen = [];
process.addUncaughtExceptionCaptureCallback((err) => { seen.push('first:' + err.message); return false; });
process.addUncaughtExceptionCaptureCallback((err) => { seen.push('second:' + err.message); return err.message === 'handled'; });
process.on('uncaughtException', (e) => seen.push('event:' + e.message));
process.on('exit', () => console.log(JSON.stringify(seen)));
setTimeout(() => { throw new Error('handled'); }, 1);
setTimeout(() => { throw new Error('other'); }, 5);
`;
const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
assert.deepEqual(JSON.parse(r.stdout), ['second:handled', 'second:other', 'first:other', 'event:other']);

// If every callback returns falsy and nothing else handles it, the process still crashes.
const crash = spawnSync(process.execPath, ['-e', 'process.addUncaughtExceptionCaptureCallback(() => false); setTimeout(() => { throw new Error("boom"); });'], { encoding: 'utf8' });
assert.equal(crash.status, 1);
assert.match(crash.stderr, /boom/);

// It coexists with setUncaughtExceptionCaptureCallback (which allows only one function).
const both = spawnSync(process.execPath, ['-p', 'process.addUncaughtExceptionCaptureCallback(() => true); process.setUncaughtExceptionCaptureCallback(() => {}); process.hasUncaughtExceptionCaptureCallback()'], { encoding: 'utf8' });
assert.equal(both.stdout.trim(), 'true');
