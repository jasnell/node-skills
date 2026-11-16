// @node-skills {"added":["v26.9.0"],"timeout":60000}
// Build a single executable with --build-sea and "useVfs": assets become a read-only fs tree.
// Linux only here (macOS needs `codesign --sign -`, Windows needs .exe). Writes ~100 MB to tmp, then deletes it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux') {
  console.log('skip: example only verified on Linux');
  process.exit(77);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-sea-vfs-'));
try {
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  w('src/config.json', '{"name":"demo"}');
  w('src/lib/add.js', 'module.exports = (a, b) => a + b;');
  w('main.js', `
    const fs = require('node:fs'); const path = require('node:path');
    let write; try { fs.writeFileSync(path.join(__dirname, 'x'), 'y'); } catch (e) { write = e.code; }
    console.log(JSON.stringify({
      name: JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')).name,
      sum: require('./lib/add.js')(2, 3),
      files: fs.readdirSync(__dirname, { recursive: true }).sort(),
      isSea: require('node:sea').isSea(),
      write,
    }));`);
  w('sea-config.json', JSON.stringify({
    main: 'main.js',
    output: 'app',
    useVfs: true,
    disableExperimentalSEAWarning: true,
    assets: { 'config.json': 'src/config.json', 'lib/add.js': 'src/lib/add.js' },
  }));
  // Relative paths in the config resolve against the cwd.
  const build = spawnSync(process.execPath, ['--build-sea', 'sea-config.json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr + build.stdout);
  const run = spawnSync(path.join(dir, 'app'), { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    name: 'demo', sum: 5, files: ['config.json', 'lib', 'lib/add.js', 'main.js'], isSea: true, write: 'EROFS',
  });

  // Config validation that --build-sea enforces.
  const bad = (cfg) => { fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify({ main: 'main.js', output: 'bad', ...cfg }));
    return spawnSync(process.execPath, ['--build-sea', 'bad.json'], { cwd: dir, encoding: 'utf8' }); };
  assert.match(bad({ useVfs: true, useSnapshot: true }).stderr + '', /useSnapshot/);
  assert.match(bad({ vfsArchive: 'a.zip' }).stderr + '', /requires "useVfs"/);
  // Rejected at build time on main (v28.0.0-pre); v26.13.0 still builds it.
  const vl = bad({ useVfs: true, execArgv: ['--vfs-load=x'] });
  if (Number(process.versions.node.split('.')[0]) >= 27) assert.match(vl.stderr, /--vfs-load/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
