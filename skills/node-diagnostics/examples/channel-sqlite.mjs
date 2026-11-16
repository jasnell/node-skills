// @node-skills {"added":["v26.8.0","v24.22.0"]}
// Built-in 'sqlite.db.query': one profiling event per finished statement (no start event, no span).
import assert from 'node:assert/strict';
import { subscribe } from 'node:diagnostics_channel';
import * as sqlite from 'node:sqlite';

const Database = sqlite.Database ?? sqlite.DatabaseSync; // Database is the newer name
const seen = [];
subscribe('sqlite.db.query', (m) => seen.push({ sql: m.sql, same: m.database === db, ns: typeof m.duration }));
const db = new Database(':memory:');
db.exec('CREATE TABLE t(a)');
db.prepare('INSERT INTO t VALUES (?)').run(42);
db.prepare('SELECT a FROM t').all();
db.close();
assert.deepEqual(seen, [
  { sql: 'CREATE TABLE t(a)', same: true, ns: 'number' },
  { sql: 'INSERT INTO t VALUES (42.0)', same: true, ns: 'number' }, // expanded SQL; JS numbers bind as REAL
  { sql: 'SELECT a FROM t', same: true, ns: 'number' },
]);
