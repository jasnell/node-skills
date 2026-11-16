// @node-skills {"added":["v26.9.0"],"timeout":60000}
// v8.setHeapProfileNearHeapLimit(n) writes the active sampling heap profile when V8 nears OOM.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import v8 from 'node:v8';

assert.throws(() => v8.setHeapProfileNearHeapLimit(0), { code: 'ERR_OUT_OF_RANGE' });

const dir = mkdtempSync(join(tmpdir(), 'heapprof-'));
try {
  const child = spawnSync(process.execPath, [
    '--max-old-space-size=40', `--diagnostic-dir=${dir}`, '-e',
    `const v8 = require('node:v8');
     v8.startHeapProfile();            // required: no active profile -> nothing written
     v8.setHeapProfileNearHeapLimit(1);
     const a = []; for (;;) a.push({ x: new Array(100).fill(Math.random()) });`,
  ], { encoding: 'utf8' });
  assert.notEqual(child.status, 0); // the process still dies with OOM
  const files = readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^Heap\.\d{8}\.\d{6}\.\d+\.\d+\.\d{3}\.heapprofile$/);
  const profile = JSON.parse(readFileSync(join(dir, files[0]), 'utf8'));
  assert.ok(Array.isArray(profile.samples));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
