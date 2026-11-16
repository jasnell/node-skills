// @node-skills {"added":["v26.3.0","v24.20.0"]}
// process.permission.drop(): irreversible; must name the exact grant; a path inside a granted dir is a silent no-op.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'perm-drop-')));
try {
  mkdirSync(join(dir, 'conf'));
  writeFileSync(join(dir, 'conf', 'app.json'), '{"port":1}');
  const script = `
    const fs = require('node:fs');
    const out = [];
    out.push(JSON.parse(fs.readFileSync('conf/app.json', 'utf8')).port);
    process.permission.drop('fs.read', 'conf/app.json');          // not the granted path: no effect, no error
    out.push(process.permission.has('fs.read', 'conf/app.json'));
    process.permission.drop('fs.read', './conf');                  // the exact grant
    out.push(process.permission.has('fs.read', 'conf/app.json'));
    try { fs.readFileSync('conf/app.json'); out.push('read'); } catch (e) { out.push(e.code); }
    process.permission.drop('child');                              // whole scope
    out.push(process.permission.has('child'));
    console.log(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath,
    ['--permission', '--allow-fs-read=./conf', '--allow-child-process', '-e', script],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [1, true, false, 'ERR_ACCESS_DENIED', false]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
