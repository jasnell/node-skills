// @node-skills {"added":["v28.0.0"]}
// DEP0205 End-of-Life (unreleased, main/v28.0.0-pre): module.register() is gone and
// --loader / --experimental-loader are rejected. Use module.registerHooks().
import assert from 'node:assert/strict';
import module from 'node:module';
import { spawnSync } from 'node:child_process';

assert.equal(module.register, undefined);
assert.equal(typeof module.registerHooks, 'function');
for (const flag of ['--loader=./x.mjs', '--experimental-loader=./x.mjs']) {
  const r = spawnSync(process.execPath, [flag, '-e', '0'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /bad option/);
}
