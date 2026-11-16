// @node-skills {"added":["v26.6.0","v24.20.0"],"timeout":60000}
// --cond: conditional logpoint. One condition per location; a throwing condition counts as false.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'probe-'));
try {
  const app = join(dir, 'app.js');
  writeFileSync(app, 'let total = 0;\nfor (let i = 0; i < 5; i++) {\n  total += i;\n}\n');
  const run = (...args) => spawnSync(process.execPath, ['inspect', ...args, app], { encoding: 'utf8' });

  const r = run('--json', '--probe', 'app.js:3', '--expr', 'total', '--cond', 'i % 2 === 0');
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.probes[0].condition, 'i % 2 === 0');
  assert.deepEqual(report.results.filter((e) => e.event === 'hit').map((h) => h.result.value), [0, 1, 6]); // evaluated before line 3 runs

  // Text mode (default).
  const text = run('--probe', 'app.js:3', '--expr', 'i', '--cond', 'i > 3').stdout;
  assert.match(text, /^Hit 1 at file:.*app\.js:3:3\n {2}i = 4\nCompleted/);

  // Two probes on one location with different --cond are rejected at launch (no report).
  const bad = run('--probe', 'app.js:3', '--expr', 'i', '--cond', 'i > 1',
                  '--probe', 'app.js:3', '--expr', 'total');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /must use the same --cond/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
