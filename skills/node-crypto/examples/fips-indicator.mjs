// @node-skills {"added":["v26.9.0","v24.22.0"]}
// --enable-fips-indicator-events + 'crypto.fips.indicator' channel. Only checks the wiring:
// messages need an OpenSSL 3.4+ FIPS provider configured for non-approved operations.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const child = `
  const dc = require('node:diagnostics_channel');
  dc.subscribe('crypto.fips.indicator', (m) => console.log(m.operation, m.reason, m.blocked));
  require('node:crypto').hash('md5', 'x');
  console.log('done', require('node:crypto').getFips());`;
const r = spawnSync(process.execPath, ['--enable-fips-indicator-events', '-e', child], { encoding: 'utf8' });
assert.equal(r.status, 0, r.stderr);
assert.match(r.stdout, /done [01]/);
