// @node-skills {"added":["v24.2.0","v22.18.0"]}
// import.meta.main is true only in the entry module (ESM `require.main === module`).
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(import.meta.main, true);
const dir = mkdtempSync(join(tmpdir(), 'main-'));
try {
  writeFileSync(join(dir, 'lib.mjs'), 'export const isMain = import.meta.main;');
  assert.equal((await import(pathToFileURL(join(dir, 'lib.mjs')))).isMain, false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
