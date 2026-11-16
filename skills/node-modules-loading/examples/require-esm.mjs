// @node-skills {"added":["v25.4.0","v24.15.0"]}
// require(esm) (Stable): require() returns the namespace of a synchronous ES module,
// `export { x as 'module.exports' }` customizes the return value, and a graph with
// top-level await throws ERR_REQUIRE_ASYNC_MODULE.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

assert.equal(process.features.require_module, true);
const dir = mkdtempSync(join(tmpdir(), 'reqesm-'));
try {
  const file = (p, s) => writeFileSync(join(dir, p), s);
  file('lib.mjs', 'export default 1; export const named = 2;');
  file('cls.mjs', "export default class P {}; export { P as 'module.exports' };");
  file('tla.mjs', 'await 0; export const x = 1;');
  file('mid.mjs', "import './tla.mjs';");
  const require = createRequire(join(dir, 'entry.cjs'));

  const ns = require('./lib.mjs');
  assert.equal(ns.default, 1);
  assert.equal(ns.named, 2);
  assert.equal(ns.__esModule, true); // added because there is a default export
  assert.equal(require('./cls.mjs').name, 'P');

  // TLA anywhere in the required graph (here: a dependency) throws.
  assert.throws(() => require('./mid.mjs'), { code: 'ERR_REQUIRE_ASYNC_MODULE' });
  assert.equal((await import(join(dir, 'tla.mjs'))).x, 1); // use import() instead
} finally {
  rmSync(dir, { recursive: true, force: true });
}
