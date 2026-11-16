// @node-skills {"added":["v27.0.0-alpha.0.0.0"]}
// v27 alpha default changes: http.Server keepAliveTimeout 5s -> 65s; mkdtemp with a
// Buffer prefix returns a Buffer; --no-experimental-repl-await is rejected.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const server = http.createServer();
assert.equal(server.keepAliveTimeout, 65_000);
assert.equal(http.createServer({ keepAliveTimeout: 5_000 }).keepAliveTimeout, 5_000); // opt back

const d = fs.mkdtempSync(Buffer.from(`${os.tmpdir()}/mk-`));
try {
  assert.ok(Buffer.isBuffer(d));
} finally {
  fs.rmSync(d, { recursive: true, force: true });
}
// Docs say an explicit encoding returns a string; on main it is still a Buffer
// (see meta.json discrepancies). Use a string prefix when you need a string.
const s = fs.mkdtempSync(Buffer.from(`${os.tmpdir()}/mk-`), { encoding: 'utf8' });
try {
  assert.ok(Buffer.isBuffer(s));
} finally {
  fs.rmSync(s, { recursive: true, force: true });
}
const str = fs.mkdtempSync(`${os.tmpdir()}/mk-`);
try {
  assert.equal(typeof str, 'string');
} finally {
  fs.rmSync(str, { recursive: true, force: true });
}

const repl = spawnSync(process.execPath, ['--no-experimental-repl-await', '-e', '0'], { encoding: 'utf8' });
assert.notEqual(repl.status, 0);
assert.match(repl.stderr, /invalid negation/);
