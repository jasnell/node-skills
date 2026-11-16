// @node-skills {"added":["v26.11.0"],"timeout":20000}
// --report-on-process-timeout writes a diagnostic report when the timeout fires.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'pt-report-'));
try {
  const r = spawnSync(process.execPath, [
    '--process-timeout=300ms', '--report-on-process-timeout', `--report-directory=${dir}`,
    '-e', 'setInterval(() => {}, 1000)',
  ], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(r.status, 124);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 1);
  const report = JSON.parse(readFileSync(join(dir, files[0]), 'utf8'));
  assert.equal(report.header.trigger, 'ProcessTimeout');
  assert.equal(report.header.event, 'Process timed out (--process-timeout)');
  assert.ok(report.libuv.some((h) => h.type === 'timer' && h.is_active));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
