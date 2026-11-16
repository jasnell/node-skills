// @node-skills {"added":["v26.8.0"]}
// readOnly / NODE_COMPILE_CACHE_READONLY=1 (v26.8.0, not on v24): reuse a shipped
// cache, never write to it, never create a missing directory (status FAILED).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ccro-'));
try {
  const cache = join(dir, 'cache');
  const missing = join(dir, 'missing');
  writeFileSync(join(dir, 'a.mjs'), 'export const a = 1;');
  writeFileSync(join(dir, 'b.mjs'), 'export const b = 2;');
  const run = (code, env = {}) => spawnSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, NODE_COMPILE_CACHE: '', ...env } });
  const S = "(await import('node:module')).constants.compileCacheStatus";

  // Build the cache for a.mjs (normal, writable mode).
  run(`import m from 'node:module'; m.enableCompileCache(${JSON.stringify(cache)}); await import('./a.mjs');`);
  const before = readdirSync(cache, { recursive: true }).sort();
  assert.ok(before.length > 0);

  // Read-only: loading a new module (b.mjs) must not add entries.
  const ro = run(`import m from 'node:module';
    const r = m.enableCompileCache({ directory: ${JSON.stringify(cache)}, readOnly: true });
    await import('./a.mjs'); await import('./b.mjs'); m.flushCompileCache();
    console.log(r.status === ${S}.ENABLED);`);
  assert.equal(ro.stdout.trim(), 'true', ro.stderr);
  assert.deepEqual(readdirSync(cache, { recursive: true }).sort(), before);

  // Env-var form, missing directory: not created, status FAILED.
  const fail = run(`import m from 'node:module';
    console.log(m.enableCompileCache(${JSON.stringify(missing)}).status === ${S}.FAILED);`,
  { NODE_COMPILE_CACHE_READONLY: '1' });
  assert.equal(fail.stdout.trim(), 'true', fail.stderr);
  assert.equal(existsSync(missing), false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
