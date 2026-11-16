#!/usr/bin/env node
// Measures whether skill descriptions make Claude Code load the right skill.
//
// For each [expectedSkill, prompt] in evals/trigger-prompts.json, runs
// `claude -p` with this repo loaded as a plugin, allows only the Skill tool,
// and records which skills were invoked. "NONE" rows are negative controls:
// they pass when no node-skills skill fires.
//
// Results vary run to run; compare several runs, and run more than one model
// (haiku is the most likely to miss). Costs one short model call per prompt.
//
// Usage: node tools/trigger-eval.mjs [--model sonnet] [--runs 2] [--jobs 8]

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'sonnet' },
    runs: { type: 'string', default: '1' },
    jobs: { type: 'string', default: '8' },
  },
});
const prompts = JSON.parse(readFileSync(join(ROOT, 'evals', 'trigger-prompts.json'), 'utf8'));
const cwd = mkdtempSync(join(tmpdir(), 'node-skills-trigger-'));

function one([expect, prompt]) {
  return new Promise((resolve) => {
    const c = spawn('claude', [
      '-p', '--plugin-dir', ROOT, '--model', values.model,
      '--output-format', 'stream-json', '--verbose', '--max-turns', '3',
      '--allowedTools', 'Skill',
      '--disallowedTools', 'Bash', 'Edit', 'Write', 'Read', 'Agent', 'WebFetch', 'WebSearch', 'Glob', 'Grep',
    ], { cwd });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.stdin.end(prompt); // the tools flags are variadic, so the prompt goes on stdin
    const timer = setTimeout(() => c.kill(), 240_000);
    c.on('close', () => {
      clearTimeout(timer);
      const used = [...out.matchAll(/"name":"Skill","input":\{"skill":"([^"]+)"/g)].map((m) => m[1].replace(/^node-skills:/, ''));
      const ours = used.filter((u) => u.startsWith('node-'));
      const ok = expect === 'NONE' ? ours.length === 0 : used.includes(expect);
      resolve({ expect, prompt, used, ok });
    });
  });
}

const tally = new Map();
for (let run = 1; run <= Number(values.runs); run++) {
  const results = [];
  const queue = prompts.map((p, i) => [i, p]);
  await Promise.all(Array.from({ length: Number(values.jobs) }, async () => {
    while (queue.length) {
      const [i, p] = queue.shift();
      results[i] = await one(p);
    }
  }));
  console.log(`\nrun ${run} (${values.model})`);
  for (const [i, r] of results.entries()) {
    tally.set(i, (tally.get(i) ?? 0) + (r.ok ? 1 : 0));
    console.log(`${r.ok ? 'ok  ' : 'MISS'} ${r.expect.padEnd(24)} used=[${r.used.join(', ')}]  ${r.prompt.slice(0, 60)}`);
  }
  console.log(`${results.filter((r) => r.ok).length}/${results.length}`);
}
rmSync(cwd, { recursive: true, force: true });

if (Number(values.runs) > 1) {
  console.log(`\nper-prompt hit rate over ${values.runs} runs:`);
  for (const [i, [expect, prompt]] of prompts.entries()) {
    console.log(`  ${tally.get(i)}/${values.runs}  ${expect.padEnd(24)} ${prompt.slice(0, 60)}`);
  }
}
