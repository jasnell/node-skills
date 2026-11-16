// @node-skills {"added":["v26.8.0","v24.22.0"]}
// The 'sqlite.db.query' diagnostics channel reports each finished statement.
import * as sqlite from 'node:sqlite';
import dc from 'node:diagnostics_channel';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;
const db = new Database(':memory:');
const seen = [];
const onQuery = ({ sql, database, duration }) => seen.push({ sql, same: database === db, duration });
dc.subscribe('sqlite.db.query', onQuery);

db.exec('CREATE TABLE t(x)');
db.prepare('INSERT INTO t VALUES (?)').run('hi');
dc.unsubscribe('sqlite.db.query', onQuery);
db.exec('SELECT 1');

assert.equal(seen.length, 2);
assert.equal(seen[1].sql, "INSERT INTO t VALUES ('hi')"); // expanded SQL: bound values are visible to subscribers
assert.ok(seen.every((e) => e.same && typeof e.duration === 'number')); // duration in nanoseconds
db.close();
