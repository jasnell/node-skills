#!/usr/bin/env node
// Surveys nodejs/node docs for features a baseline Node.js version lacks, and
// reports which of them no skill mentions yet.
//
// Reads the YAML metadata blocks in doc/api/*.md. An API is "new" when its
// `added:` list is not available in the baseline (same backport semantics as
// tools/versions.mjs; REPLACEME counts as new). A `changes:` entry is "new"
// when its version is not available in the baseline and its description looks
// like a behavior change worth knowing (new option, default change, stability
// promotion, removal).
//
// Coverage: an entry counts as covered when its key identifier (the method or
// property name, or the CLI flag) appears anywhere in skills/**. This is a
// heuristic for triage, not proof: read the doc section before deciding.
//
// Usage:
//   node tools/survey.mjs --node-dir ../node --since v26.13.0 [--uncovered] [--changes] [--json] [--module zlib]

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { isAvailable } from './versions.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { values } = parseArgs({
  options: {
    'node-dir': { type: 'string', default: process.env.NODE_DIR ?? '../node' },
    since: { type: 'string', default: 'v24.0.0' },
    uncovered: { type: 'boolean', default: false },
    changes: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    module: { type: 'string', multiple: true, default: [] },
  },
});

const VERSION = /v\d+\.\d+\.\d+(?:-[\w.]+)?|REPLACEME/g;
const INTERESTING_CHANGE = /stable|no longer|unflag|without .*flag|added|support|now|option|end-of-life|removed|default|renamed|release candidate|deprecat/i;

function isNew(versions) {
  if (versions.length === 0) return false;
  if (versions.includes('REPLACEME')) return true;
  return !isAvailable(versions, values.since);
}

// Parse every `<!-- YAML ... -->` block and attribute it to the nearest heading.
function parseDoc(text) {
  const lines = text.split('\n');
  const out = [];
  let heading = null;
  let stability = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6} /.test(line)) {
      heading = line.replace(/^#+\s*/, '').trim();
      stability = null;
    }
    const s = /^> Stability: ([\d.]+ - [\w ]+?)(?:[.:–-]|$)/.exec(line);
    if (s && out.length && out.at(-1).heading === heading) out.at(-1).stability = s[1].trim();
    if (line.trim() !== '<!-- YAML') continue;
    const block = [];
    let j = i + 1;
    for (; j < lines.length && lines[j].trim() !== '-->'; j++) block.push(lines[j]);
    const entry = { heading, line: i + 1, added: [], changes: [], stability };
    for (let k = 0; k < block.length; k++) {
      const added = /^added:\s*(.*)$/.exec(block[k]);
      if (added) {
        entry.added.push(...(added[1].match(VERSION) ?? []));
        while (k + 1 < block.length && /^\s+-\s/.test(block[k + 1])) entry.added.push(...(block[++k].match(VERSION) ?? []));
      }
      const ver = /^\s*- version:\s*(.*)$/.exec(block[k]);
      if (ver) {
        const versions = [...(ver[1].match(VERSION) ?? [])];
        let m = k + 1;
        while (m < block.length && /^\s+-\s+v|^\s+- REPLACEME/.test(block[m])) versions.push(...(block[m++].match(VERSION) ?? []));
        let desc = '';
        for (; m < block.length && !/^\s*- version:/.test(block[m]); m++) {
          const d = /description:\s*(.*)$/.exec(block[m]);
          if (d) desc = d[1];
          else if (desc && /^\s{6,}\S/.test(block[m])) desc += ` ${block[m].trim()}`;
        }
        entry.changes.push({ versions, description: desc.replace(/^>-?\s*/, '').trim() });
      }
    }
    out.push(entry);
    i = j;
  }
  return out;
}

// The token most likely to appear in a skill that covers this heading.
function keyIdentifier(heading) {
  const flag = /`(--?[\w-]+)/.exec(heading);
  if (flag) return flag[1];
  const env = /`([A-Z][A-Z0-9_]{3,})(?:=|`)/.exec(heading);
  if (env) return env[1];
  const code = /`([^`]+)`/.exec(heading);
  const text = code ? code[1] : heading.replace(/^(Class|Event|Static method):\s*/, '');
  const name = text.replace(/\(.*$/, '').replace(/^new /, '').split(/[.\s]/).filter(Boolean).pop() ?? text;
  return name.replace(/^['"]|['"]$/g, '');
}

async function skillCorpus() {
  let corpus = '';
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(md|mjs|cjs|js|json)$/.test(e.name)) corpus += `${await readFile(p, 'utf8')}\n`;
    }
  }
  await walk(join(ROOT, 'skills'));
  return corpus;
}

const docDir = join(values['node-dir'], 'doc', 'api');
const corpus = await skillCorpus();
const rows = [];
for (const file of (await readdir(docDir)).filter((f) => f.endsWith('.md')).sort()) {
  const mod = file.slice(0, -3);
  if (values.module.length && !values.module.includes(mod)) continue;
  for (const entry of parseDoc(await readFile(join(docDir, file), 'utf8'))) {
    if (!entry.heading) continue;
    const id = keyIdentifier(entry.heading);
    const covered = id.length > 2 && corpus.includes(id);
    if (isNew(entry.added)) {
      rows.push({ kind: 'added', doc: `doc/api/${file}:${entry.line}`, module: mod, heading: entry.heading, versions: entry.added, stability: entry.stability, id, covered });
    }
    if (values.changes) {
      for (const c of entry.changes) {
        if (isNew(c.versions) && INTERESTING_CHANGE.test(c.description)) {
          rows.push({ kind: 'change', doc: `doc/api/${file}:${entry.line}`, module: mod, heading: entry.heading, versions: c.versions, description: c.description, id, covered });
        }
      }
    }
  }
}

const shown = values.uncovered ? rows.filter((r) => !r.covered) : rows;
if (values.json) {
  console.log(JSON.stringify({ since: values.since, rows: shown }, null, 2));
} else {
  let current = '';
  for (const r of shown) {
    if (r.module !== current) {
      current = r.module;
      console.log(`\n## ${current}`);
    }
    const mark = r.covered ? '  covered ' : '  NEW     ';
    const extra = r.kind === 'change' ? `  change: ${r.description.slice(0, 100)}` : r.stability ? `  [${r.stability}]` : '';
    console.log(`${mark}${r.heading.slice(0, 70).padEnd(70)} ${r.versions.join(', ')}${extra}  (${r.doc})`);
  }
  const added = rows.filter((r) => r.kind === 'added');
  console.log(`\nsince ${values.since}: ${added.length} new APIs (${added.filter((r) => !r.covered).length} not mentioned by any skill)` +
    (values.changes ? `, ${rows.length - added.length} notable changes (${rows.filter((r) => r.kind === 'change' && !r.covered).length} uncovered)` : ''));
}
