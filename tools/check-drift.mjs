#!/usr/bin/env node
// Reports doc changes upstream that may make a skill stale.
//
// Each skill's meta.json pins `nodejsCommit` and lists `sources` (paths inside
// a nodejs/node checkout). This diffs those files from the pinned commit to the
// checkout's HEAD and prints the lines that matter for skills: YAML `added:`,
// `changes:` entries, `version:`/`description:` lines, Stability markers, and
// headings. A skill with no relevant changes is reported as current.
//
// Usage:
//   node tools/check-drift.mjs --node-dir /path/to/node [--ref main] [skill ...]
//   node tools/check-drift.mjs --node-dir ../node --bump   rewrite nodejsCommit to HEAD for current skills

import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const git = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'node-dir': { type: 'string', default: process.env.NODE_DIR ?? '../node' },
    ref: { type: 'string', default: 'HEAD' },
    bump: { type: 'boolean', default: false },
  },
});

const nodeDir = values['node-dir'];
const { stdout: headOut } = await git('git', ['-C', nodeDir, 'rev-parse', '--short=11', values.ref]);
const head = headOut.trim();

const RELEVANT = /^[+-](?!\+\+|--)\s*(added:|- v\d|- REPLACEME|changes:|- version:|version:|description:|> Stability:|#{1,6} |<!-- YAML|removed:|deprecated:)/;

let stale = 0;
for (const skill of (await readdir(join(ROOT, 'skills'))).sort()) {
  if (positionals.length && !positionals.includes(skill)) continue;
  const metaPath = join(ROOT, 'skills', skill, 'meta.json');
  let meta;
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    continue;
  }
  const { stdout } = await git('git', ['-C', nodeDir, 'diff', '--unified=0', `${meta.nodejsCommit}..${head}`, '--', ...meta.sources], { maxBuffer: 64 * 1024 * 1024 });
  const lines = stdout.split('\n').filter((l) => RELEVANT.test(l));
  if (lines.length === 0) {
    console.log(`current  ${skill} (${meta.nodejsCommit}..${head})`);
    if (values.bump && meta.nodejsCommit !== head) {
      meta.nodejsCommit = head;
      await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    }
    continue;
  }
  stale++;
  console.log(`\nDRIFT    ${skill} (${meta.nodejsCommit}..${head}): ${lines.length} relevant line(s)`);
  for (const l of lines.slice(0, 40)) console.log(`  ${l}`);
  if (lines.length > 40) console.log(`  ... ${lines.length - 40} more`);
}

if (stale) {
  console.log(`\n${stale} skill(s) may be stale. Review, update the skill, then re-pin nodejsCommit.`);
  process.exitCode = 1;
}
