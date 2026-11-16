// @node-skills {"added":["v24.0.0"]}
// The probe must report present items, report missing ones, and exit 1 when anything is missing.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const probe = fileURLToPath(new URL('../scripts/probe.mjs', import.meta.url));
const ok = spawnSync(process.execPath, [probe, '--module', 'node:fs:promises.readFile', '--global', 'fetch', '--flag', '--watch'], { encoding: 'utf8' });
assert.equal(ok.status, 0, ok.stdout + ok.stderr);
assert.match(ok.stdout, /present\s+node:fs:promises\.readFile/);

const bad = spawnSync(process.execPath, [probe, '--module', 'node:does-not-exist', '--flag', '--no-such-flag-xyz'], { encoding: 'utf8' });
assert.equal(bad.status, 1);
assert.match(bad.stdout, /MISSING\s+flag --no-such-flag-xyz/);
assert.match(bad.stdout, /MISSING\s+node:does-not-exist/);
