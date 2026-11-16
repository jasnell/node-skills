// @node-skills {"added":["v26.8.0","v24.21.0"]}
// tty setRawMode('raw' | 'io') and readStream.rawMode. Needs a real TTY: runs the check under
// a pseudo-terminal via util-linux `script` when available, otherwise skips (exit 77).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempDisposableSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

if (process.platform !== 'linux' || !existsSync('/usr/bin/script')) { console.log('skip: needs Linux util-linux script(1) for a pty'); process.exit(77); }
const child = `
const s = process.stdin, out = [];
const rec = (label) => out.push(label + '=' + JSON.stringify(s.rawMode) + '/' + s.isRaw);
rec('init');
s.setRawMode('raw'); rec('raw');
s.setRawMode('io'); rec('io');
s.setRawMode(true); rec('true');
s.setRawMode(false); rec('false');
try { s.setRawMode('bogus'); } catch (e) { out.push(e.code); }
console.log('RESULT ' + out.join(' '));
process.exit(0);
`;
using dir = mkdtempDisposableSync(join(tmpdir(), 'nsk-'));
const file = join(dir.path, 'raw.cjs');
writeFileSync(file, child);
const quote = (p) => `'${p.replace(/'/g, `'\\''`)}'`;
const r = spawnSync('/usr/bin/script', ['-qec', `${quote(process.execPath)} ${quote(file)}`, '/dev/null'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
const line = /^RESULT (.*)$/m.exec(r.stdout.replace(/\r/g, ''))?.[1];
if (line === undefined) { console.log('skip: no usable pty'); process.exit(77); }
assert.equal(line, 'init=false/false raw="raw"/true io="io"/true true="raw"/true false=false/false ERR_INVALID_ARG_VALUE');
