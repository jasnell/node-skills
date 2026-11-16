// @node-skills {"added":["v26.1.0","v24.16.0"]}
// glob({ followSymlinks }): follow directory symlinks while expanding `**` (default false).
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

using dir = fs.mkdtempDisposableSync(join(tmpdir(), 'nsk-'));
fs.mkdirSync(join(dir.path, 'src'));
fs.mkdirSync(join(dir.path, 'shared'));
fs.writeFileSync(join(dir.path, 'src/a.js'), '');
fs.writeFileSync(join(dir.path, 'shared/s.js'), '');
try {
  fs.symlinkSync(join(dir.path, 'shared'), join(dir.path, 'src/linked'), 'dir');
} catch (err) {
  if (process.platform === 'win32') { console.log('skip: creating symlinks needs privileges on Windows'); process.exit(77); }
  throw err;
}
fs.symlinkSync(join(dir.path, 'src'), join(dir.path, 'src/shared-loop'), 'dir'); // a cycle

assert.deepEqual(fs.globSync('src/**/*.js', { cwd: dir.path }), ['src/a.js']);
const followed = fs.globSync('src/**/*.js', { cwd: dir.path, followSymlinks: true }).sort();
assert.ok(followed.includes('src/a.js') && followed.includes('src/linked/s.js'), String(followed));
assert.ok(followed.length < 10, 'cycles are not traversed recursively');
