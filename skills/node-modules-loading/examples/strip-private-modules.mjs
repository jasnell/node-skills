// @node-skills {"added":["v27.0.0-alpha.0.0.0"]}
// --experimental-strip-private-modules allows .ts inside node_modules only when the
// package root's package.json has "private": true (e.g. a linked workspace package).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'tspriv-'));
try {
  const file = (p, s) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), s); };
  file('node_modules/@ws/lib/package.json', '{"name":"@ws/lib","private":true,"type":"module","exports":"./index.ts"}');
  file('node_modules/@ws/lib/index.ts', 'export const n: number = 42;');
  file('node_modules/pub/package.json', '{"name":"pub","type":"module","exports":"./index.ts"}');
  file('node_modules/pub/index.ts', 'export const n: number = 1;');
  file('a.mjs', "import { n } from '@ws/lib'; console.log(n);");
  file('b.mjs', "import 'pub';");
  const run = (...args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });

  assert.match(run('a.mjs').stderr, /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/);
  const ok = run('--no-warnings', '--experimental-strip-private-modules', 'a.mjs');
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), '42');
  // Non-private packages are still refused, even with the flag.
  assert.match(run('--experimental-strip-private-modules', 'b.mjs').stderr,
    /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
