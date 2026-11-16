// @node-skills {"added":["v26.1.0","v24.19.0"]}
// getTestContext() from helper code, context.workerId / NODE_TEST_WORKER_ID, SuiteContext.passed.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-ctx-'));
writeFileSync(join(dir.path, 'helper.mjs'), `
import { getTestContext } from 'node:test';
export async function label() {
  await new Promise((r) => setTimeout(r, 1));       // survives async hops
  const t = getTestContext();
  return t ? t.fullName + ' w' + t.workerId : 'outside';
}
`);
writeFileSync(join(dir.path, 'c.test.mjs'), `
import { describe, test, after, getTestContext } from 'node:test';
import { label } from './helper.mjs';
console.log('TOP=' + getTestContext());
describe('S', (s) => {
  after(() => console.log('SUITE_PASSED=' + s.passed));
  test('T', async () => {
    console.log('LABEL=' + await label());
    console.log('ENV=' + process.env.NODE_TEST_WORKER_ID);
  });
});
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'c.test.mjs'], { cwd: dir.path, encoding: 'utf8', env });
assert.equal(r.status, 0, r.stdout + r.stderr);
assert.match(r.stdout, /TOP=undefined/);
assert.match(r.stdout, /LABEL=S > T w1/);
assert.match(r.stdout, /ENV=1/);
// SuiteContext.passed (v26.1.0, v24.16.0) is still false inside the suite's own after() hook.
assert.match(r.stdout, /SUITE_PASSED=false/);
