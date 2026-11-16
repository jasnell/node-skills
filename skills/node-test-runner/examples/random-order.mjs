// @node-skills {"added":["v26.1.0","v24.16.0"]}
// --test-random-seed replays a randomized order; the seed is printed as a diagnostic.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-rand-'));
writeFileSync(join(dir.path, 'r.test.mjs'), `
import { describe, it } from 'node:test';
describe('s', () => { for (const n of 'abcdefghij') it(n, () => {}); });
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const go = (...flags) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...flags, 'r.test.mjs'],
  { cwd: dir.path, encoding: 'utf8', env });
const order = (out) => [...out.matchAll(/^ {4}ok \d+ - (\w)$/gm)].map((m) => m[1]).join('');

const a = go('--test-random-seed=42');
const b = go('--test-random-seed=42');
assert.equal(a.status, 0, a.stderr);
assert.match(a.stdout, /^# Randomized test order seed: 42$/m);
assert.equal(order(a.stdout), order(b.stdout));       // same seed, same order
assert.equal(order(a.stdout).length, 10);

const r = go('--test-randomize');                      // random seed, printed for replay
const seed = /Randomized test order seed: (\d+)/.exec(r.stdout)[1];
assert.equal(order(go(`--test-random-seed=${seed}`).stdout), order(r.stdout));

// Randomization cannot be combined with --test-rerun-failures (or --watch).
const bad = go('--test-randomize', `--test-rerun-failures=${join(dir.path, 'state.json')}`);
assert.notEqual(bad.status, 0);
assert.match(bad.stderr, /not supported with rerun failures mode/);
