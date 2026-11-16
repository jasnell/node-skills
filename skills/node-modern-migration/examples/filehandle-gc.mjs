// @node-skills {"added":["v25.0.0"],"flags":["--expose-gc"]}
// DEP0137 End-of-Life (v25.0.0): a FileHandle that is garbage-collected while open
// now throws ERR_INVALID_STATE (uncaught) instead of warning. Close it, or use `await using`.
import assert from 'node:assert/strict';
import { open } from 'node:fs/promises';

let caught;
process.once('uncaughtException', (err) => { caught = err; });
(async () => { await open(import.meta.filename); })(); // leaked handle
for (let i = 0; i < 50 && !caught; i++) {
  await new Promise((r) => setTimeout(r, 10));
  globalThis.gc();
}
assert.equal(caught?.code, 'ERR_INVALID_STATE');

{
  await using fh = await open(import.meta.filename); // closed by Symbol.asyncDispose
  assert.ok((await fh.stat()).size > 0);
}
