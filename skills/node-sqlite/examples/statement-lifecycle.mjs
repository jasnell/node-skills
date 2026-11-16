// @node-skills {"added":["v26.8.0","v24.22.0"]}
// statement.close() / `using`, boolean and ArrayBuffer parameters, empty-SQL rejection.
import * as sqlite from 'node:sqlite';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;
using db = new Database(':memory:');
db.exec('CREATE TABLE t(flag INTEGER, data BLOB)');

{
  using insert = db.prepare('INSERT INTO t VALUES (?, ?)');
  insert.run(true, new Uint8Array([1, 2]).buffer); // boolean -> 1, ArrayBuffer -> BLOB
  insert.run(false, new Uint8Array([3]));
} // insert is finalized here

const q = db.prepare('SELECT flag, data FROM t ORDER BY rowid');
const rows = q.all();
assert.deepEqual(rows.map((r) => r.flag), [1, 0]); // booleans read back as numbers
assert.ok(rows[0].data instanceof Uint8Array);
assert.deepEqual([...rows[0].data], [1, 2]);
q.close();
assert.throws(() => q.get(), { code: 'ERR_INVALID_STATE' });
assert.throws(() => q.close(), { code: 'ERR_INVALID_STATE' }); // close() twice throws; dispose is a no-op

assert.throws(() => db.prepare('-- just a comment'), { code: 'ERR_INVALID_ARG_VALUE' });

// The tag store refuses `?` placeholders; only ${} binds.
const sql = db.createTagStore();
assert.throws(() => sql.get`SELECT ${1} AS a, ? AS b`, { code: 'ERR_INVALID_ARG_VALUE' });
