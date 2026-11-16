// @node-skills {"added":["v26.7.0"]}
// --test-coverage-include-all reports never-loaded source files at 0% coverage.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-cov-'));
writeFileSync(join(dir.path, 'used.mjs'), 'export const a = () => 1;\n');
writeFileSync(join(dir.path, 'unused.mjs'), 'export const b = () => 2;\n');
writeFileSync(join(dir.path, 'c.test.mjs'), `import { test } from 'node:test'; import { a } from './used.mjs'; test('t', () => a());\n`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const go = (...flags) => spawnSync(process.execPath, ['--no-warnings', '--test', '--experimental-test-coverage', ...flags, 'c.test.mjs'],
  { cwd: dir.path, encoding: 'utf8', env });

assert.doesNotMatch(go().stdout, /unused\.mjs/);
const all = go('--test-coverage-include-all');
assert.equal(all.status, 0, all.stderr);
assert.match(all.stdout, /unused\.mjs\s+\|\s+0\.00/);
