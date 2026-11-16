// @node-skills {"added":["v24.4.0"]}
// fs.mkdtempDisposable / mkdtempDisposableSync: temp dirs removed (recursively) by `await using` / `using`.
import { mkdtempDisposable, writeFile } from 'node:fs/promises';
import { mkdtempDisposableSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

let path;
{
  await using dir = await mkdtempDisposable(join(tmpdir(), 'nsk-'));
  path = dir.path;
  mkdirSync(join(dir.path, 'nested'));
  await writeFile(join(dir.path, 'nested', 'a.txt'), 'hi');  // contents are removed too
}
assert.equal(existsSync(path), false);

{
  using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-sync-'));
  path = dir.path;
  writeFileSync(join(dir.path, 'b.txt'), 'x');
}
assert.equal(existsSync(path), false);

// remove() is the same operation; calling it again (or disposing after it) is fine.
const manual = mkdtempDisposableSync(join(tmpdir(), 'nsk-manual-'));
manual.remove();
manual.remove();
assert.equal(existsSync(manual.path), false);
