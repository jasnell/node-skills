// @node-skills {"added":["v26.0.0"]}
// v26.0.0 default changes: readable.read() with no size returns ONE buffered chunk;
// localStorage without --localstorage-file is unusable (undefined + warning, see meta.json).
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const r = new Readable({ read() {} });
r.push('a'); r.push('b'); r.push('c');
assert.equal(String(r.read()), 'a');        // v24: 'abc'
assert.equal(String(r.read()), 'b');
assert.equal(String(r.read(1)), 'c');        // explicit size still works

const ls = spawnSync(process.execPath, ['-p', 'String(globalThis.localStorage)'], { encoding: 'utf8' });
assert.equal(ls.stdout.trim(), 'undefined');
assert.match(ls.stderr, /--localstorage-file was not provided/);
const dir = mkdtempSync(join(tmpdir(), 'ls-'));
try {
  const ok = spawnSync(process.execPath, [`--localstorage-file=${join(dir, 'store')}`, '-p',
    "localStorage.setItem('k', 'v'); localStorage.getItem('k')"], { encoding: 'utf8' });
  assert.equal(ok.stdout.trim(), 'v', ok.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
