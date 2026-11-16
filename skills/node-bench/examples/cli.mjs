// @node-skills {"added":["v26.9.0"],"timeout":20000}
// node --experimental-bench --bench: process isolation, json reporter, CLI overrides.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'node-bench-'));
try {
  writeFileSync(join(dir, 'a.bench.mjs'), `
import { bench, suite } from 'node:bench';
suite('str', () => {
  bench('concat', { samples: 50, warmup: 5 }, (b) => {
    let s = '';
    b.start();
    for (let i = 0; i < 1000; i++) s += 'x';
    b.end(1000);
    if (s.length !== 1000) throw new Error('bad');
  });
  bench('repeat', (b) => { b.start(); const s = 'x'.repeat(1000); b.end(1); if (!s) throw 0; });
});
console.log('from the child'); // becomes a bench:diagnostic record
`);
  writeFileSync(join(dir, 'b.bench.mjs'), `
import { bench } from 'node:bench';
bench('fails', { samples: 1, warmup: 0 }, (b) => { throw new Error('boom'); });
`);

  const res = spawnSync(process.execPath, [
    '--no-warnings', '--experimental-bench', '--bench',
    '--bench-reporter=json', '--bench-samples=3', '--bench-warmup=1',
    '*.bench.mjs', // glob, quoted in a shell
  ], { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 1, res.stderr); // any failed benchmark => exit 1

  const records = res.stdout.trim().split('\n').map((l) => JSON.parse(l));
  // main emits a 'bench:environment' record first; v26.13.0 has no environment record.
  const envIndex = records.findIndex((r) => r.type === 'bench:environment');
  assert.ok(envIndex <= 0);
  if (envIndex === 0) assert.equal(records[0].data.node, process.version);
  const plans = records.filter((r) => r.type === 'bench:plan');
  assert.deepEqual(plans.map((p) => p.data.samples), [3, 3, 3]); // CLI override
  assert.ok(plans.every((p) => p.data.warmup === 1));
  assert.equal(new Set(plans.map((p) => p.data.fileRunId)).size, 2); // one child per file

  const done = records.filter((r) => r.type === 'bench:complete');
  const concat = done.find((r) => r.data.name === 'concat');
  assert.equal(concat.data.samples.length, 3);
  assert.equal(typeof concat.data.samples[0].duration_ns, 'string'); // bigint -> decimal string in JSON
  assert.equal(done.find((r) => r.data.name === 'fails').data.error.message, 'boom');
  assert.ok(records.some((r) => r.type === 'bench:diagnostic' && r.data.message.includes('from the child')));

  // --bench-name-pattern skips non-matching benchmarks.
  const only = spawnSync(process.execPath, [
    '--no-warnings', '--experimental-bench', '--bench', '--bench-reporter=json',
    '--bench-samples=2', '--bench-name-pattern=concat', 'a.bench.mjs',
  ], { cwd: dir, encoding: 'utf8' });
  assert.equal(only.status, 0, only.stderr);
  const skipped = only.stdout.trim().split('\n').map((l) => JSON.parse(l))
    .filter((r) => r.type === 'bench:complete' && r.data.skip);
  assert.deepEqual(skipped.map((r) => r.data.name), ['repeat']);

  // --experimental-bench is required, and --bench cannot be combined with --test.
  const noFlag = spawnSync(process.execPath, ['--bench', 'a.bench.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(noFlag.status, 0);
  assert.match(noFlag.stderr, /--experimental-bench is required/);
  const withTest = spawnSync(process.execPath, ['--experimental-bench', '--bench', '--test', 'a.bench.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(withTest.status, 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
