// @node-skills {"added":["v27.0.0"]}
// --test-forbid-only (run({ forbidOnly })): any .only / only:true / runOnly(true) fails the run.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from 'node:test';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-only-'));
const file = join(dir.path, 'only.test.mjs');
writeFileSync(file, `import { test } from 'node:test'; test.only('focused', () => {}); test('other', () => {});`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;

const normal = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', env });
assert.equal(normal.status, 0);
const ci = spawnSync(process.execPath, ['--test', '--test-forbid-only', file], { encoding: 'utf8', env });
assert.equal(ci.status, 1);
assert.match(ci.stdout + ci.stderr, /The only option is not allowed when forbidOnly is enabled/);

let failed = 0;
for await (const e of run({ files: [file], forbidOnly: true })) if (e.type === 'test:fail') failed++;
assert.ok(failed > 0);
