// @node-skills {"added":["v24.7.0"]}
// --test-rerun-failures=<state.json>: the next run executes only tests that have not passed yet.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-rerun-'));
writeFileSync(join(dir.path, 'rr.test.mjs'), `
import { test } from 'node:test';
import { appendFileSync, existsSync } from 'node:fs';
test('stable', (t) => { appendFileSync('runs.log', 'stable@' + t.attempt + '\\n'); });
test('flaky', (t) => {
  appendFileSync('runs.log', 'flaky@' + t.attempt + '\\n');
  if (!existsSync('fixed')) throw new Error('not yet');
});
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const go = () => spawnSync(process.execPath, ['--test', '--test-reporter=spec', '--test-rerun-failures=state.json', 'rr.test.mjs'],
  { cwd: dir.path, encoding: 'utf8', env });

assert.equal(go().status, 1);
writeFileSync(join(dir.path, 'fixed'), '');
const second = go();
assert.equal(second.status, 0, second.stdout);
assert.match(second.stdout, /stable .*\(passed on attempt 0\)/); // reported, not re-executed

// context.attempt is zero-based. (Docs list TestContext.attempt as v25.0.0; observed on v24.19.0 too.)
const runs = readFileSync(join(dir.path, 'runs.log'), 'utf8').trim().split('\n');
assert.deepEqual(runs, ['stable@0', 'flaky@0', 'flaky@1']);

const state = JSON.parse(readFileSync(join(dir.path, 'state.json'), 'utf8'));
assert.equal(state.length, 2);                          // one entry per attempt
assert.equal(state[1]['rr.test.mjs:5:1'].passed_on_attempt, 1); // key = file:line:column
