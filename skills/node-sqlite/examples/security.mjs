// @node-skills {"added":["v24.15.0"]}
// Running untrusted SQL: defensive mode is on by default, an allowlist authorizer, and runtime limits.
import * as sqlite from 'node:sqlite';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;
const { constants: c } = sqlite;

// Defensive mode (default since v24.14.0) blocks SQL that can corrupt the file.
const db = new Database(':memory:', { limits: { attach: 0 } });
db.exec('CREATE TABLE t(x INTEGER)');
db.exec('INSERT INTO t VALUES (1), (2)');
assert.throws(
  () => db.exec("PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql='x' WHERE name='t'"),
  { code: 'ERR_SQLITE_ERROR', message: /may not be modified/ },
);
// limits from the constructor are enforced.
assert.throws(() => db.exec("ATTACH ':memory:' AS other"), /too many attached databases/);

// Runtime limits: read, set, and reset to the compile-time maximum with Infinity.
const max = db.limits.sqlLength;
db.limits.sqlLength = 64;
assert.throws(() => db.prepare(`SELECT 1 AS ${'a'.repeat(100)}`), /too big/);
db.limits.sqlLength = Infinity;
assert.equal(db.limits.sqlLength, max);

// Read-only allowlist: anything that is not a SELECT/read/function call is denied at prepare time.
const allowed = new Set([c.SQLITE_SELECT, c.SQLITE_READ, c.SQLITE_FUNCTION]);
db.setAuthorizer((action) => (allowed.has(action) ? c.SQLITE_OK : c.SQLITE_DENY));
assert.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 2);
assert.throws(() => db.exec('DELETE FROM t'), { code: 'ERR_SQLITE_ERROR', message: /not authorized/ });
assert.throws(() => db.exec('CREATE TABLE u(y)'), /not authorized/);

// SQLITE_IGNORE on a column read turns that column into NULL instead of failing.
db.setAuthorizer((action, table, column) =>
  (action === c.SQLITE_READ && column === 'x' ? c.SQLITE_IGNORE : c.SQLITE_OK));
assert.equal(db.prepare('SELECT x FROM t LIMIT 1').get().x, null);
db.setAuthorizer(null);
assert.equal(db.prepare('SELECT x FROM t LIMIT 1').get().x, 1);

// Opt out of defensive mode only for legacy tooling that edits the schema table.
const legacy = new Database(':memory:', { defensive: false });
legacy.exec('CREATE TABLE t(x)');
legacy.exec("PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql='CREATE TABLE t(x, y)' WHERE name='t'");
legacy.enableDefensive(true);
assert.throws(() => legacy.exec("UPDATE sqlite_schema SET sql='x' WHERE name='t'"), /may not be modified/);
legacy.close();
db.close();
