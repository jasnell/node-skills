// @node-skills {"added":["v26.1.0"]}
// node:ffi under the permission model: --allow-ffi, and what process.permission.drop('ffi') does NOT revoke.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'linux') { console.log('skip: uses glibc libc.so.6'); process.exit(77); }

const script = `
const ffi = require('node:ffi');               // importing is allowed without --allow-ffi
const out = { has: process.permission.has('ffi') };
try {
  const lib = new ffi.DynamicLibrary('libc.so.6');
  const abs = lib.getFunction('abs', { arguments: ['int32'], return: 'int32' });
  process.permission.drop('ffi');
  out.afterDrop = { has: process.permission.has('ffi'), call: abs(-3) };
  try { lib.getFunction('labs', { arguments: ['int64'], return: 'int64' }); out.afterDrop.getFunction = 'ok'; } catch (e) { out.afterDrop.getFunction = e.code; }
  try { new ffi.DynamicLibrary('libm.so.6'); out.afterDrop.newLib = 'ok'; } catch (e) { out.afterDrop.newLib = e.code; }
  try { ffi.toString(0n); out.afterDrop.toString = 'ok'; } catch (e) { out.afterDrop.toString = e.code; }
} catch (e) { out.open = e.code; }
console.log(JSON.stringify(out));`;
const run = (...flags) => JSON.parse(spawnSync(process.execPath,
  ['--no-warnings', '--permission', '--allow-fs-read=*', ...flags, '-e', script], { encoding: 'utf8' }).stdout);

assert.deepEqual(run(), { has: false, open: 'ERR_ACCESS_DENIED' });
assert.deepEqual(run('--allow-ffi'), {
  has: true,
  afterDrop: { has: false, call: 3, getFunction: 'ok', newLib: 'ERR_ACCESS_DENIED', toString: 'ERR_ACCESS_DENIED' },
});

// --no-experimental-ffi removes the module.
const off = spawnSync(process.execPath, ['--no-experimental-ffi', '-e', 'require("node:ffi")'], { encoding: 'utf8' });
assert.match(off.stderr, /ERR_UNKNOWN_BUILTIN_MODULE/);
