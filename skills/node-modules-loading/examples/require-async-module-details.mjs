// @node-skills {"added":["v26.5.0","v24.20.0"]}
// ERR_REQUIRE_ASYNC_MODULE carries non-enumerable `requireStack` always, and
// `topLevelAwaitLocations` only under --experimental-print-required-tla.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'tla-'));
try {
  writeFileSync(join(dir, 'tla.mjs'), 'await 0;\nexport const x = 1;');
  writeFileSync(join(dir, 'main.cjs'), `
    try { require('./tla.mjs'); } catch (e) {
      console.log(JSON.stringify({ code: e.code, keys: Object.keys(e),
        requireStack: e.requireStack, tla: e.topLevelAwaitLocations }));
    }`);
  const run = (...flags) => JSON.parse(spawnSync(process.execPath, [...flags, join(dir, 'main.cjs')], { encoding: 'utf8' }).stdout);

  const plain = run();
  assert.equal(plain.code, 'ERR_REQUIRE_ASYNC_MODULE');
  assert.deepEqual(plain.keys, ['code']); // the new properties are non-enumerable
  assert.deepEqual(plain.requireStack, [join(dir, 'main.cjs')]);
  assert.equal(plain.tla, undefined);

  const [loc] = run('--experimental-print-required-tla').tla;
  assert.match(loc.url, /^file:.*tla\.mjs$/);
  assert.equal(loc.line, 1);
  assert.equal(loc.column, 1);
  assert.equal(loc.sourceLine, 'await 0;');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
