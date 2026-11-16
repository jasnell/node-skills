// @node-skills {"added":["v26.11.0"],"timeout":20000}
// fork() children inherit the flag with their own clock; nothing kills them when the parent times out.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'pt-children-'));
try {
  const script = join(dir, 'app.cjs');
  writeFileSync(script, `
const { fork, spawn } = require('node:child_process');
const fs = require('node:fs');
const [, , role, out, parentPid] = process.argv;
if (role === 'forked') {
  setTimeout(() => {           // 800 ms after this child started (parent is gone by then)
    let parentAlive = true;
    try { process.kill(Number(parentPid), 0); } catch { parentAlive = false; }
    fs.writeFileSync(out, JSON.stringify({ execArgv: process.execArgv, parentAlive }));
  }, 800);
  setInterval(() => {}, 1000); // hangs; its own --process-timeout ends it
} else if (role === 'spawned') {
  fs.writeFileSync(out, JSON.stringify({ execArgv: process.execArgv }));
} else {
  setTimeout(() => {
    fork(__filename, ['forked', out + '.forked', String(process.pid)]);
    spawn(process.execPath, [__filename, 'spawned', out + '.spawned'], { stdio: 'inherit' });
  }, 400);
  setInterval(() => {}, 1000);
}`);
  const out = join(dir, 'out');
  const child = spawn(process.execPath, ['--process-timeout=1s', script, 'parent', out], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
  // 'close' waits for stderr, which the forked child shares, so it also waits for that child.
  const [code] = await new Promise((resolve) => child.on('close', (...a) => resolve(a)));
  assert.equal(code, 124);

  const forked = JSON.parse(readFileSync(out + '.forked', 'utf8'));
  assert.deepEqual(forked.execArgv, ['--process-timeout=1s']); // inherited via execArgv
  assert.equal(forked.parentAlive, false); // outlived the parent: not killed on timeout
  const spawned = JSON.parse(readFileSync(out + '.spawned', 'utf8'));
  assert.deepEqual(spawned.execArgv, []); // spawn(process.execPath) does not inherit execArgv
  // Two summaries: the parent's, then the forked child's on its own clock.
  assert.equal(stderr.match(/Process timed out after 1s/g).length, 2);
  assert.match(stderr, /ProcessWrap \(pid \d+\)/); // the parent saw its children as handles
} finally {
  rmSync(dir, { recursive: true, force: true });
}
