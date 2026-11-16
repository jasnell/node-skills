// @node-skills {"added":["v27.0.0"]}
// --allow-env: ungranted variables are removed at startup (also from children); NODE_ENV is not kept.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const script = `
  const e = process.env;
  const out = { app: e.APP_PORT, secret: e.SECRET, nodeEnv: e.NODE_ENV, path: typeof e.PATH,
                has: [process.permission.has('env', 'APP_PORT'), process.permission.has('env', 'SECRET')] };
  out.child = require('node:child_process')
    .execFileSync(process.execPath, ['-p', 'JSON.stringify([process.env.APP_PORT, process.env.SECRET])'], { encoding: 'utf8' }).trim();
  const db = e.DB_URL;
  process.permission.drop('env', 'DB_URL');      // read a secret, then remove it
  out.db = [db, 'DB_URL' in process.env];
  try { process.permission.drop('env', 'APP_*'); } catch (err) { out.wild = err.code; }
  console.log(JSON.stringify(out));
`;
const r = spawnSync(process.execPath,
  ['--permission', '--allow-fs-read=*', '--allow-child-process', '--allow-env=APP_*,DB_URL', '-e', script],
  { encoding: 'utf8', env: { PATH: process.env.PATH, APP_PORT: '8080', SECRET: 's3cr3t', NODE_ENV: 'production', DB_URL: 'pg://x' } });
assert.equal(r.status, 0, r.stderr);
const out = JSON.parse(r.stdout);
assert.equal(out.app, '8080');
assert.equal(out.secret, undefined);
assert.equal(out.nodeEnv, undefined);      // grant NODE_ENV explicitly if the app reads it
assert.equal(out.path, 'string');          // Node's own variables are always kept
assert.deepEqual(out.has, [true, false]);
assert.equal(out.child, '["8080",null]');  // the child never sees SECRET
assert.deepEqual(out.db, ['pg://x', false]);
assert.equal(out.wild, 'ERR_INVALID_ARG_VALUE');
assert.match(r.stderr, /removed the environment variable "SECRET" at startup/);
