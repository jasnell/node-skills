// @node-skills {"added":["v25.2.0","v24.12.0"]}
// Type stripping is on by default and Stable: erasable TS runs with no flag,
// enums/runtime namespaces throw ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, `import type`
// is required for type-only imports, --no-strip-types turns it off, and .ts files
// under node_modules are refused.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

assert.equal(process.features.typescript, 'strip');
assert.equal(stripTypeScriptTypes('const a: number = 1;'), 'const a         = 1;');

const dir = mkdtempSync(join(tmpdir(), 'ts-'));
try {
  const file = (p, s) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), s); };
  file('types.ts', 'export interface User { name: string }\nexport const ok = true;');
  file('main.mts', "import type { User } from './types.ts';\nimport { ok } from './types.ts';\n" +
    "const u: User = { name: 'x' };\nconsole.log(u.name, ok);");
  file('enum.ts', 'enum E { A }\nconsole.log(E.A);');
  file('node_modules/dep/index.ts', 'export const x: number = 1;');
  file('use-dep.mts', "import './node_modules/dep/index.ts';");
  const run = (...args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });

  const ok = run('main.mts');
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.stdout.trim(), 'x true');
  assert.doesNotMatch(ok.stderr, /ExperimentalWarning/);

  assert.match(run('enum.ts').stderr, /ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX/);
  assert.match(run('--no-strip-types', 'main.mts').stderr, /SyntaxError|ERR_UNKNOWN_FILE_EXTENSION/);
  assert.match(run('use-dep.mts').stderr, /ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
