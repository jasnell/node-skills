#!/usr/bin/env node
// Runs every skills/*/examples/*.mjs with $NODE (default: `node` on PATH).
//
// Line 1 of each example is a header:
//   // @node-skills {"added":["v26.11.0","v24.22.0"],"flags":["--x"],"timeout":10000}
// Examples whose `added` range excludes the target version are skipped, so
// the same corpus can be run against v24 LTS, current, and a main build.
//
// An example that discovers at runtime that it cannot run (a build without
// node:quic, an OpenSSL without an algorithm) must exit with code 77 (the
// automake "skipped" convention) and print the reason on stdout. Exiting 0
// would report a pass for something that never ran.
//
// Usage:
//   NODE=/path/to/node node tools/run-examples.mjs [skill-name ...]

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { availableParallelism } from 'node:os';
import { isAvailable } from './versions.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NODE = process.env.NODE || 'node';
const SKIP = 77;

const { stdout: versionOut } = await run(NODE, ['--version']);
const version = versionOut.trim();

const only = new Set(process.argv.slice(2));
const jobs = [];
for (const skill of (await readdir(join(ROOT, 'skills'))).sort()) {
  if (only.size && !only.has(skill)) continue;
  let files;
  try {
    files = (await readdir(join(ROOT, 'skills', skill, 'examples'))).filter((f) => /\.m?js$/.test(f)).sort();
  } catch {
    continue;
  }
  for (const file of files) {
    const path = join(ROOT, 'skills', skill, 'examples', file);
    const first = (await readFile(path, 'utf8')).split('\n')[0];
    const m = /^\/\/ @node-skills (\{.*\})\s*$/.exec(first);
    const header = m ? JSON.parse(m[1]) : null;
    jobs.push({ name: `${skill}/${file}`, path, header });
  }
}

let passed = 0;
let failed = 0;
let skipped = 0;

async function runOne(job) {
  if (!job.header) {
    failed++;
    console.log(`FAIL ${job.name}: missing @node-skills header`);
    return;
  }
  if (!isAvailable(job.header.added, version)) {
    skipped++;
    console.log(`skip ${job.name} (needs ${job.header.added.join(' | ')})`);
    return;
  }
  try {
    await run(NODE, [...(job.header.flags ?? []), job.path], {
      cwd: join(ROOT, 'skills', job.name.split('/')[0], 'examples'),
      timeout: job.header.timeout ?? 30_000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    passed++;
    console.log(`ok   ${job.name}`);
  } catch (err) {
    if (err.code === SKIP) {
      skipped++;
      console.log(`skip ${job.name} (${String(err.stdout ?? '').trim().split('\n').at(-1) || 'self-skipped'})`);
      return;
    }
    failed++;
    console.log(`FAIL ${job.name}`);
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || err.message;
    console.log(out.split('\n').slice(-25).map((l) => `     ${l}`).join('\n'));
  }
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: Math.min(availableParallelism(), 8) }, async () => {
    while (queue.length) await runOne(queue.shift());
  }),
);

console.log(`\n${version}: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed) process.exitCode = 1;
