// @node-skills {"added":["v26.3.0","v24.18.0"]}
// Defaults already changed on v24 LTS: Buffer.poolSize 8192 -> 65536 (v26.3.0, v24.18.0);
// SQLite `defensive` on by default (v25.5.0, v24.14.0).
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

assert.equal(Buffer.poolSize, 65536);

const pragma = (db) => { db.exec('PRAGMA writable_schema = ON'); return db.prepare('PRAGMA writable_schema').get().writable_schema; };
assert.equal(pragma(new DatabaseSync(':memory:')), 0);                       // defensive: ignored
assert.equal(pragma(new DatabaseSync(':memory:', { defensive: false })), 1); // opt out explicitly
