// @node-skills {"added":["v26.2.0","v24.19.0"]}
// Test tags: suite tags inherit by union, context.tags is frozen + lowercased,
// and --experimental-test-tag-filter selects by boolean expression.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from 'node:test';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-tags-'));
const file = join(dir.path, 'tags.test.mjs');
writeFileSync(file, `
import { describe, it, test } from 'node:test';
describe('database', { tags: ['DB'] }, () => {
  it('reads', (t) => { console.log('TAGS=' + JSON.stringify(t.tags) + ' frozen=' + Object.isFrozen(t.tags)); });
  it('writes', { tags: ['integration'] }, () => {});
  it('reconnects', { tags: ['flaky'] }, () => {});
});
test('untagged', () => {});
`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;

const passed = (out) => [...out.matchAll(/^\s*ok \d+ - (\w+)/gm)].map((m) => m[1]).filter((n) => n !== 'database');

const tap = (...flags) => spawnSync(process.execPath,
  ['--no-warnings', '--test', '--test-reporter=tap', ...flags, file], { encoding: 'utf8', env });

// Single tag (case-insensitive) and repeated flags (AND): work on every version in range.
const one = tap('--experimental-test-tag-filter=db');
assert.equal(one.status, 0, one.stderr);
assert.deepEqual(passed(one.stdout), ['reads', 'writes', 'reconnects']);
assert.match(one.stdout, /TAGS=\["db"\] frozen=true/);
assert.deepEqual(passed(tap('--experimental-test-tag-filter=db', '--experimental-test-tag-filter=INTEGRATION').stdout), ['writes']);

// Boolean grammar. v24.19.0 only matches plain tag names: these expressions select nothing there,
// and run({ testTagFilters }) ran no files. Verified on v26.13.0 and main.
if (!process.version.startsWith('v24.')) {
  assert.deepEqual(passed(tap('--experimental-test-tag-filter=db && !flaky').stdout), ['reads', 'writes']);
  // 'not flaky' includes untagged tests (negation of an empty tag set is true).
  assert.deepEqual(passed(tap('--experimental-test-tag-filter=not flaky').stdout), ['reads', 'writes', 'untagged']);
  assert.deepEqual(passed(tap('--experimental-test-tag-filter=integ*').stdout), ['writes']);

  // A malformed expression fails before any test runs.
  const bad = tap('--experimental-test-tag-filter=a &&');
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /ERR_INVALID_ARG_VALUE/);

  const names = [];
  for await (const e of run({ files: [file], testTagFilters: ['db', 'not flaky'] })) {
    if (e.type === 'test:pass' && e.data.details.type === 'test') names.push(e.data.name);
  }
  assert.deepEqual(names, ['reads', 'writes']);
}
