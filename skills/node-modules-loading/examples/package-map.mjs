// @node-skills {"added":["v26.4.0","v24.20.0"]}
// --experimental-package-map resolves bare specifiers from a JSON map instead of
// node_modules: declared deps resolve, undeclared ones fail, files outside every
// mapped package get ERR_PACKAGE_MAP_EXTERNAL_FILE, relative imports are untouched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pkgmap-'));
try {
  const file = (p, s) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), s); };
  file('packages/utils/package.json', '{"name":"@my/utils","type":"module","exports":"./index.js"}');
  file('packages/utils/index.js', 'export const add = (a, b) => a + b;');
  file('packages/app/package.json', '{"name":"app","type":"module"}');
  file('packages/app/main.js', `
    import { add } from '@my/utils';
    import { two } from './local.js';
    let undeclared;
    try { await import('@my/secret'); } catch (e) { undeclared = e.code; }
    console.log(JSON.stringify({ sum: add(1, two), undeclared }));`);
  file('packages/app/local.js', 'export const two = 2;');
  file('packages/secret/index.js', 'export default 1;');
  file('outside.mjs', "import '@my/utils';");
  file('package-map.json', JSON.stringify({
    packages: {
      app: { url: './packages/app', dependencies: { '@my/utils': 'utils' } },
      utils: { url: './packages/utils' },
      secret: { url: './packages/secret' },
    },
  }));

  const run = (entry) => spawnSync(process.execPath,
    ['--no-warnings', `--experimental-package-map=${join(dir, 'package-map.json')}`, join(dir, entry)],
    { encoding: 'utf8' });

  const ok = run('packages/app/main.js');
  assert.equal(ok.status, 0, ok.stderr);
  // `secret` is in the map but not in app's dependencies: not resolvable from app.
  assert.deepEqual(JSON.parse(ok.stdout), { sum: 3, undeclared: 'ERR_MODULE_NOT_FOUND' });

  const ext = run('outside.mjs');
  assert.notEqual(ext.status, 0);
  assert.match(ext.stderr, /ERR_PACKAGE_MAP_EXTERNAL_FILE/);

  // Two IDs sharing one url: packages.md says allowed; the runtime rejects the map.
  file('package-map.json', JSON.stringify({
    packages: {
      app: { url: './packages/app', dependencies: { '@my/utils': 'u1' } },
      u1: { url: './packages/utils' },
      u2: { url: './packages/utils' },
    },
  }));
  assert.match(run('packages/app/main.js').stderr, /ERR_PACKAGE_MAP_INVALID/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
