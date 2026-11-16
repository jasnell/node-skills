// @node-skills {"added":["v24.0.0"]}
// --test-global-setup=<module>: globalSetup runs once before all files, globalTeardown once after.
import { spawnSync } from 'node:child_process';
import { mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-setup-'));
writeFileSync(join(dir.path, 'setup.mjs'), `
export async function globalSetup() { process.env.FIXTURE_URL = 'http://127.0.0.1:1234'; console.log('SETUP'); }
export async function globalTeardown() { console.log('TEARDOWN'); }
`);
for (const n of ['a', 'b']) {
  writeFileSync(join(dir.path, `${n}.test.mjs`),
    `import { test } from 'node:test'; test('${n}', () => { console.log('${n} sees ' + process.env.FIXTURE_URL); });`);
}
writeFileSync(join(dir.path, 'bad-setup.mjs'), `export function globalSetup() { throw new Error('db down'); }`);
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const go = (setup) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-global-setup=${setup}`, 'a.test.mjs', 'b.test.mjs'],
  { cwd: dir.path, encoding: 'utf8', env });

const r = go('setup.mjs');
assert.equal(r.status, 0, r.stderr);
assert.equal(r.stdout.match(/SETUP/g).length, 1);
assert.equal(r.stdout.match(/TEARDOWN/g).length, 1);
assert.ok(r.stdout.indexOf('SETUP') < r.stdout.indexOf('a sees'));
// Observed: env vars set in globalSetup reach the isolated test processes.
assert.match(r.stdout, /a sees http:\/\/127\.0\.0\.1:1234/);
assert.match(r.stdout, /b sees http:\/\/127\.0\.0\.1:1234/);

const bad = go('bad-setup.mjs');                        // setup throws: no tests run, non-zero exit
assert.notEqual(bad.status, 0);
assert.doesNotMatch(bad.stdout, /sees/);
