// @node-skills {"added":["v26.11.0"]}
// Database/Statement names, createModule virtual tables, statement.stat(), prepare({ persistent }).
import { Database, Statement, DatabaseSync, StatementSync } from 'node:sqlite';
import assert from 'node:assert/strict';

assert.equal(Database, DatabaseSync);
assert.equal(Statement, StatementSync);

const db = new Database(':memory:');
db.createModule('series', {
  columns: [
    { name: 'value', type: 'INTEGER' },
    { name: 'stop', type: 'INTEGER', hidden: true }, // hidden column = table-valued function argument
  ],
  *rows(stop) {
    assert.ok(stop === null || typeof stop === 'number');
    stop ??= 3; // an omitted argument arrives as null, so a default parameter would not apply
    for (let i = 1n; i <= BigInt(stop); i++) yield [i]; // yield bigint for INTEGER storage
  },
});
assert.deepEqual(db.prepare('SELECT value FROM series(4)').all().map((r) => r.value), [1, 2, 3, 4]);
assert.equal(db.prepare('SELECT typeof(value) AS t FROM series(1)').get().t, 'integer');
assert.equal(db.prepare('SELECT count(*) AS n FROM series').get().n, 3); // eponymous use, stop is null
db.exec('CREATE VIRTUAL TABLE s USING series');
assert.equal(db.prepare('SELECT count(*) AS n FROM s').get().n, 3);
assert.throws(() => db.createModule('bad', { columns: [{ name: 'a', type: 'VARCHAR' }], rows: () => [] }),
  { code: 'ERR_INVALID_ARG_VALUE' });

db.exec('CREATE TABLE t(a INTEGER PRIMARY KEY, b TEXT)');
db.exec("INSERT INTO t(b) VALUES ('x'), ('y'), ('z')");
const scan = db.prepare('SELECT * FROM t WHERE b = ?', { persistent: true });
assert.ok(scan instanceof Statement);
scan.all('z');
assert.ok(scan.stat('fullscanStep') > 0); // no index on b
assert.equal(scan.stat('run'), 1);
scan.resetStats();
assert.equal(scan.stat('fullscanStep'), 0);
assert.ok(scan.stat('memused') > 0); // memused is not reset
const byKey = db.prepare('SELECT * FROM t WHERE a = ?');
byKey.get(2n);
assert.equal(byKey.stat('fullscanStep'), 0); // uses the primary key
assert.throws(() => scan.stat('nope'), { code: 'ERR_INVALID_ARG_VALUE' });

// undefined binds as NULL since v26.10.0.
assert.equal(db.prepare('SELECT ? AS v').get(undefined).v, null);
db.close();
