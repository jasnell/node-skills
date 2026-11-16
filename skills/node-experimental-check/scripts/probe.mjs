#!/usr/bin/env node
// Feature probe for the Node.js that will actually run the user's code.
//
//   node probe.mjs [--node /path/to/node] [--flag F]... [--module node:x[:export[.member]]]... [--global Name]... [--list node:x]
//
// Examples:
//   node probe.mjs --module node:zlib:ZipFile --module node:perf_hooks:createHistogram
//   node probe.mjs --flag --experimental-stream-iter --module node:stream/iter
//   node probe.mjs --flag --process-timeout --global URLPattern
//   node probe.mjs --list node:bench
//
// Exit code is 1 if any probed item is missing, so it can gate a script.

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

// Allow `--flag --experimental-x` (parseArgs would reject a value starting with `--`).
const argv = process.argv.slice(2);
const args = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--flag' && i + 1 < argv.length) args.push(`--flag=${argv[++i]}`);
  else args.push(argv[i]);
}

const { values } = parseArgs({
  args,
  options: {
    node: { type: 'string', default: process.execPath },
    flag: { type: 'string', multiple: true, default: [] },
    module: { type: 'string', multiple: true, default: [] },
    global: { type: 'string', multiple: true, default: [] },
    list: { type: 'string', multiple: true, default: [] },
  },
});

const node = values.node;
const run = (args) => execFileSync(node, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_OPTIONS: '' } });

const version = run(['--version']).trim();
const help = run(['--help']);
const docBase = /-/.test(version)
  ? 'pre-release build: read doc/api/<module>.md in the matching nodejs/node checkout'
  : `https://nodejs.org/docs/${version}/api/`;
console.log(`node     ${version}  (${node})`);
console.log(`docs     ${docBase}`);

let missing = 0;
const report = (ok, what, detail = '') => {
  if (!ok) missing++;
  console.log(`${ok ? 'present ' : 'MISSING '} ${what}${detail ? `  ${detail}` : ''}`);
};

// Flags: `node --help` lists every CLI option the binary accepts, including
// experimental ones. A flag absent from --help is not supported by this build.
const enabling = [];
for (const flag of values.flag) {
  const name = flag.split('=')[0];
  const ok = new RegExp(`(^|[\\s,])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s=,\\[]|$)`, 'm').test(help);
  report(ok, `flag ${name}`);
  // Flags that take a value (e.g. --process-timeout=1s) are probed by name only;
  // pass enabling flags (no value) through to the module/global probes below.
  if (ok && !flag.includes('=') && /^--(experimental|allow|no-experimental)/.test(name)) enabling.push(name);
}

// Builtins and exports are probed in a child process that receives the
// enabling flags, because many experimental modules only exist behind them.
function probe(code) {
  try {
    return JSON.parse(run([...enabling, '--no-warnings', '--input-type=module', '-e', code]));
  } catch (err) {
    return { error: (err.stderr || err.message).split('\n').find((l) => /Error|ERR_/.test(l)) ?? 'failed' };
  }
}

for (const spec of values.module) {
  const [mod, path] = spec.startsWith('node:') ? [spec.split(':').slice(0, 2).join(':'), spec.split(':')[2]] : [spec, undefined];
  const r = probe(`
    let m; try { m = await import(${JSON.stringify(mod)}); } catch (e) { console.log(JSON.stringify({ error: e.code ?? e.message })); process.exit(0); }
    let v = m, ok = true;
    for (const k of ${JSON.stringify(path ? path.split('.') : [])}) {
      if (v == null || !(k in Object(v)) && !(v.prototype && k in v.prototype)) { ok = false; break; }
      v = k in Object(v) ? v[k] : v.prototype[k];
    }
    console.log(JSON.stringify({ ok, type: ok ? typeof v : undefined }));
  `);
  if (r.error) report(false, spec, `(${r.error})`);
  else report(r.ok, spec, r.ok ? `(${r.type})` : '');
}

for (const name of values.global) {
  const r = probe(`console.log(JSON.stringify({ ok: typeof globalThis[${JSON.stringify(name)}] !== 'undefined', type: typeof globalThis[${JSON.stringify(name)}] }))`);
  report(!r.error && r.ok, `global ${name}`, r.ok ? `(${r.type})` : r.error ? `(${r.error})` : '');
}

for (const mod of values.list) {
  const r = probe(`
    try { const m = await import(${JSON.stringify(mod)}); console.log(JSON.stringify({ keys: Object.keys(m).filter((k) => k !== 'default').sort() })); }
    catch (e) { console.log(JSON.stringify({ error: e.code ?? e.message })); }
  `);
  if (r.error) report(false, `list ${mod}`, `(${r.error})`);
  else console.log(`exports  ${mod}: ${r.keys.join(', ')}`);
}

if (missing) process.exitCode = 1;
