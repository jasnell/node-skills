// @node-skills {"added":["v26.4.0","v24.19.0"],"timeout":60000}
// `node inspect --probe file:line --expr e [--max-hit n] --json`: logpoints without editing code (JSON schema v2).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'probe-'));
try {
  const app = join(dir, 'app.js');
  writeFileSync(app, [
    'let total = 0;',
    'for (let i = 0; i < 5; i++) {',
    '  total += i;', // line 3
    '}',
  ].join('\n'));

  const r = spawnSync(process.execPath, [
    'inspect', '--json',
    '--probe', 'app.js:3', '--expr', 'i', '--max-hit', '2',
    '--probe', 'app.js:99', '--expr', 'total', // never reached
    app,
  ], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.v, 2);
  assert.deepEqual(report.probes[0], { expr: 'i', target: { suffix: 'app.js', line: 3 }, maxHit: 2 });
  const hits = report.results.filter((e) => e.event === 'hit');
  assert.deepEqual(hits.map((h) => h.result.value), [0, 1]); // stopped after 2 hits
  assert.equal(hits[0].probe, 0);
  assert.deepEqual(hits[0].location, { url: new URL(`file://${app}`).href, line: 3, column: 3 });
  // --max-hit reached -> terminal "completed"; an unreached probe would otherwise give "miss".
  assert.deepEqual(report.results.at(-1), { event: 'completed' });

  const miss = JSON.parse(spawnSync(process.execPath, [
    'inspect', '--json', '--probe', 'app.js:99', '--expr', 'total', app,
  ], { encoding: 'utf8' }).stdout);
  assert.deepEqual(miss.results.at(-1), { event: 'miss', pending: [0] });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
