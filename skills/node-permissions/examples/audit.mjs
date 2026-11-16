// @node-skills {"added":["v25.8.0","v24.20.0"]}
// --permission-audit: nothing throws; violations go to node:permission-model:<scope> diagnostics channels.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const script = `
  const dc = require('node:diagnostics_channel');
  const seen = [];
  for (const c of ['fs', 'child'])
    dc.channel('node:permission-model:' + c).subscribe((m) => seen.push([c, m.permission, m.resource]));
  let threw = null;
  try { require('node:fs').readFileSync('/etc/hostname'); } catch (e) { threw = e.code; }
  try { require('node:child_process').spawnSync('true'); } catch (e) { threw = e.code; }
  console.log(JSON.stringify({ threw, has: process.permission.has('child'), seen }));
`;
const run = (flags) => {
  const r = spawnSync(process.execPath, [...flags, '-e', script],
    { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

const audit = run(['--permission-audit']);
assert.equal(audit.threw, null);          // access is not denied
assert.equal(audit.has, false);           // has() still reports the real status
assert.ok(audit.seen.some(([c, p]) => c === 'fs' && p === 'FileSystemRead'));
assert.ok(audit.seen.some(([c, p, res]) => c === 'child' && p === 'ChildProcess' && res === 'true'));

// Docs: --permission wins over --permission-audit. Observed: true on v28.0.0-pre, but on v26.13.0
// audit mode wins (nothing throws). Don't pass both. The channel is published in enforce mode too.
const both = run(['--permission-audit', '--permission', '--allow-fs-read=*']);
if (Number(process.versions.node.split('.')[0]) >= 27) assert.equal(both.threw, 'ERR_ACCESS_DENIED');
else assert.ok(both.threw === null || both.threw === 'ERR_ACCESS_DENIED');
assert.ok(both.seen.some(([c]) => c === 'child'));
const enforce = run(['--permission', '--allow-fs-read=*']);
assert.equal(enforce.threw, 'ERR_ACCESS_DENIED');
assert.ok(enforce.seen.some(([c, p]) => c === 'child' && p === 'ChildProcess'));
