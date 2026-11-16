// @node-skills {"added":["v26.0.0"]}
// v26 removed --experimental-transform-types and the stripTypeScriptTypes()
// `transform`/`sourceMap` options. Only mode 'strip' (+ sourceUrl) remains.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';

assert.throws(() => stripTypeScriptTypes('enum E { A }', { mode: 'transform' }), { code: 'ERR_INVALID_ARG_VALUE' });
assert.throws(() => stripTypeScriptTypes('let a: 1', { sourceMap: true }), { code: 'ERR_INVALID_ARG_VALUE' });
assert.throws(() => stripTypeScriptTypes('enum E { A }'), { code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX' });
// sourceUrl appends a //# sourceURL comment (no trailing semicolon).
assert.equal(stripTypeScriptTypes('const a: number = 1;', { mode: 'strip', sourceUrl: 'source.ts' }),
  'const a         = 1;\n\n//# sourceURL=source.ts');

const r = spawnSync(process.execPath, ['--experimental-transform-types', '-e', '0'], { encoding: 'utf8' });
assert.notEqual(r.status, 0);
assert.match(r.stderr, /bad option: --experimental-transform-types/);

// The pre-rename flag spellings are still accepted as aliases.
for (const flag of ['--experimental-strip-types', '--no-experimental-strip-types']) {
  assert.equal(spawnSync(process.execPath, [flag, '-e', '0']).status, 0, flag);
}
