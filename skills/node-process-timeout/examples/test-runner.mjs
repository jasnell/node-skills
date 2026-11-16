// @node-skills {"added":["v26.11.0"],"timeout":20000}
// node --process-timeout=… --test: the whole run and every test-file process get the timeout.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'pt-test-'));
try {
  writeFileSync(join(dir, 'leaky.test.cjs'), `
const test = require('node:test');
const fs = require('node:fs');
test('passes but leaks a handle', () => {
  fs.writeFileSync(${JSON.stringify(join(dir, 'argv.json'))}, JSON.stringify(process.execArgv));
  setInterval(() => {}, 1000);
});`);
  writeFileSync(join(dir, 'ok.test.cjs'), `require('node:test')('ok', () => {});`);

  const run = spawn(process.execPath, ['--process-timeout=2s', '--test', '--test-reporter=tap', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  run.stdout.setEncoding('utf8').on('data', (d) => { stdout += d; });
  run.stderr.setEncoding('utf8').on('data', (d) => { stderr += d; });
  const [code] = await new Promise((resolve) => run.on('close', (...a) => resolve(a)));

  assert.equal(code, 124); // the run fails instead of hanging, although every test passed
  assert.match(stdout, /ok \d+ - passes but leaks a handle/);
  assert.match(stderr, /Process timed out after 2s/);
  // The runner names a pid, not the file. It does not kill that child, but the child
  // received the flag too, so it exits on its own clock (started a bit later).
  const pid = Number(/ProcessWrap \(pid (\d+)\)/.exec(stderr)[1]);
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  assert.ok(alive());
  const deadline = Date.now() + 5000;
  while (alive() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.ok(!alive(), 'test-file process should time out by itself');
  const argv = JSON.parse(readFileSync(join(dir, 'argv.json'), 'utf8'));
  assert.ok(argv.includes('--process-timeout=2s')); // passed to each test-file process
} finally {
  rmSync(dir, { recursive: true, force: true });
}
