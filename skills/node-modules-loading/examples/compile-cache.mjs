// @node-skills {"added":["v25.4.0","v24.15.0"]}
// Compile cache (Stable): enableCompileCache() never throws; it returns a status.
// `portable: true` (v25.0.0, v24.12.0) keys entries by path relative to the cache dir.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'ccache-'));
try {
  const cache = join(dir, 'cache');
  writeFileSync(join(dir, 'app.mjs'), `
    import module, { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const { constants: { compileCacheStatus: S } } = module;
    const r = module.enableCompileCache({ directory: ${JSON.stringify(cache)}, portable: true });
    const again = module.enableCompileCache();
    await import('./dep.mjs');
    module.flushCompileCache();
    console.log(JSON.stringify({ first: r.status === S.ENABLED, again: again.status === S.ALREADY_ENABLED,
      // getCompileCacheDir() is a per-version subdirectory of r.directory, not equal to it.
      dir: module.getCompileCacheDir().startsWith(r.directory + require('node:path').sep) }));`);
  writeFileSync(join(dir, 'dep.mjs'), 'export const x = 1;');
  const out = spawnSync(process.execPath, [join(dir, 'app.mjs')], { encoding: 'utf8', env: { ...process.env, NODE_COMPILE_CACHE: '' } });
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout), { first: true, again: true, dir: true });
  assert.ok(readdirSync(cache, { recursive: true }).length > 0, 'cache entries written');

  // NODE_DISABLE_COMPILE_CACHE=1 wins over the API.
  const off = spawnSync(process.execPath, ['-p',
    "require('node:module').enableCompileCache().status === require('node:module').constants.compileCacheStatus.DISABLED"],
  { encoding: 'utf8', env: { ...process.env, NODE_DISABLE_COMPILE_CACHE: '1' } });
  assert.equal(off.stdout.trim(), 'true');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
