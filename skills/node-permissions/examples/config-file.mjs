// @node-skills {"added":["v24.0.0"]}
// Permission grants in a config file's "permission" namespace. Since v26 the namespace alone enables
// --permission; on v24 you must still pass --permission. --config-file is the v26.12+ name.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'perm-config-')));
try {
  mkdirSync(join(dir, 'data'));
  writeFileSync(join(dir, 'node.config.json'), JSON.stringify({
    permission: { 'allow-fs-read': ['./data'], 'allow-child-process': false },
  }));
  const probe = `console.log(JSON.stringify([process.permission.has('fs.read', 'data/x'),
    process.permission.has('fs.read', '/etc'), process.permission.has('child')]))`;
  const flag = process.allowedNodeEnvironmentFlags.has('--config-file')
    ? '--config-file=node.config.json' : '--experimental-config-file=node.config.json';
  const run = (flags) => spawnSync(process.execPath, [...flags, '-e', probe],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });

  // Works on every line when --permission is explicit.
  const explicit = run(['--permission', flag]);
  assert.equal(explicit.status, 0, explicit.stderr);
  assert.deepEqual(JSON.parse(explicit.stdout), [true, false, false]);

  const implicit = run([flag]);
  if (process.versions.node.split('.')[0] === '24') {
    assert.notEqual(implicit.status, 0);
    assert.match(implicit.stderr, /ERR_MISSING_OPTION.*--permission is required/s);
  } else {
    assert.equal(implicit.status, 0, implicit.stderr);
    assert.deepEqual(JSON.parse(implicit.stdout), [true, false, false]);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
