// @node-skills {"added":["v25.5.0","v24.14.0"]}
// expectFailure: the test passes only if it throws (and the error matches, if a matcher is given).
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-xfail-'));
writeFileSync(join(dir.path, 'x.test.mjs'), `
import { it } from 'node:test';
import assert from 'node:assert';
it.expectFailure('shorthand', () => { assert.strictEqual(1, 2); });
it('reason', { expectFailure: 'not implemented' }, () => { throw new Error('x'); });
it('regexp', { expectFailure: /boom/ }, () => { throw new Error('boom!'); });
it('label+match', { expectFailure: { label: 'bug 123', match: { code: 'E1' } } }, () => {
  throw Object.assign(new Error('e'), { code: 'E1' });
});
it('wrong error', { expectFailure: /nope/ }, () => { throw new Error('different'); });
it('did not throw', { expectFailure: true }, () => {});
it('skip wins', { expectFailure: true, skip: true }, () => {});
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'x.test.mjs'], { cwd: dir.path, encoding: 'utf8', env });
assert.equal(r.status, 1); // the two mismatches fail the run
const lines = r.stdout.split('\n').filter((l) => /^(not )?ok /.test(l));
assert.deepEqual(lines, [
  'ok 1 - shorthand # EXPECTED FAILURE',
  'ok 2 - reason # EXPECTED FAILURE not implemented',
  'ok 3 - regexp # EXPECTED FAILURE',
  'ok 4 - label+match # EXPECTED FAILURE bug 123',
  'not ok 5 - wrong error # EXPECTED FAILURE',
  'not ok 6 - did not throw # EXPECTED FAILURE',
  'ok 7 - skip wins # SKIP',
]);
