// @node-skills {"added":["v26.1.0","v24.16.0"]}
// Snapshot an in-memory database to bytes and load it into another connection.
import * as sqlite from 'node:sqlite';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;

const src = new Database(':memory:');
src.exec("CREATE TABLE kv(k TEXT PRIMARY KEY, v TEXT); INSERT INTO kv VALUES ('a', '1')");
const bytes = src.serialize(); // Uint8Array, a complete database file image
assert.ok(bytes instanceof Uint8Array);
assert.equal(Buffer.from(bytes.subarray(0, 15)).toString(), 'SQLite format 3');
src.close();

const clone = new Database(':memory:');
const stale = clone.prepare('SELECT 1');
clone.deserialize(bytes); // replaces the database; finalizes existing statements
assert.throws(() => stale.get(), { code: 'ERR_INVALID_STATE' });
clone.exec("INSERT INTO kv VALUES ('b', '2')"); // the result is writable
assert.deepEqual(clone.prepare('SELECT k FROM kv ORDER BY k').all().map((r) => r.k), ['a', 'b']);
clone.close();
