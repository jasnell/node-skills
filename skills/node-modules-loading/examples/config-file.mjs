// @node-skills {"added":["v26.12.0"]}
// --config-file (Stable since v26.12.0; on v24 it is --experimental-config-file).
// Bare --config-file reads ./node.config.json; CLI flags override the file; and if
// NODE_OPTIONS is set at all (even empty), the file's nodeOptions are ignored.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
try {
  writeFileSync(join(dir, 'node.config.json'), JSON.stringify({ nodeOptions: { 'stack-trace-limit': 7 } }));
  writeFileSync(join(dir, 'custom.json'), JSON.stringify({ nodeOptions: { 'stack-trace-limit': 3 } }));
  const { NODE_OPTIONS, ...cleanEnv } = process.env;
  const limit = (flags, env = cleanEnv) => spawnSync(process.execPath, [...flags, '-p', 'Error.stackTraceLimit'],
    { cwd: dir, encoding: 'utf8', env }).stdout.trim();

  assert.equal(limit(['--config-file']), '7');
  assert.equal(limit(['--config-file=custom.json']), '3');
  assert.equal(limit(['--config-file', '--stack-trace-limit=5']), '5'); // CLI wins
  assert.equal(limit(['--experimental-config-file=custom.json']), '3'); // old name kept as alias

  // Any NODE_OPTIONS (even empty or unrelated) disables the file's nodeOptions entirely.
  assert.equal(limit(['--config-file'], { ...cleanEnv, NODE_OPTIONS: '' }), '10');
  assert.equal(limit(['--config-file'], { ...cleanEnv, NODE_OPTIONS: '--no-deprecation' }), '10');

  // Unknown keys are rejected.
  writeFileSync(join(dir, 'bad.json'), JSON.stringify({ nodeOptions: { 'no-such-flag': true } }));
  assert.notEqual(spawnSync(process.execPath, ['--config-file=bad.json', '-e', '0'], { cwd: dir, env: cleanEnv }).status, 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
