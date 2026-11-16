// @node-skills {"added":["v24.9.0"]}
// Portable import (Database on v26.11+, DatabaseSync before), tag store binding, number-vs-bigint typing.
import * as sqlite from 'node:sqlite';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;
// On v26.11+ the old names are aliases of the same class.
if (sqlite.Database) assert.equal(sqlite.Database, sqlite.DatabaseSync);

const db = new Database(':memory:');
db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, tag TEXT) STRICT');

const sql = db.createTagStore(); // LRU of prepared statements, default capacity 1000
assert.equal(sql.capacity, 1000);
assert.equal(sql.db, db);

// ${} binds a parameter; it is never spliced into the SQL text.
const hostile = "x'); DROP TABLE users; --";
const r = sql.run`INSERT INTO users(name) VALUES (${hostile})`;
assert.equal(r.changes, 1);
sql.run`INSERT INTO users(name) VALUES (${'bob'})`;
assert.equal(sql.get`SELECT name FROM users WHERE id = ${1}`.name, hostile);
assert.equal(sql.all`SELECT id FROM users ORDER BY id`.length, 2);
assert.deepEqual([...sql.iterate`SELECT name FROM users WHERE id > ${1}`].map((row) => row.name), ['bob']);
// Same template text, different values: one cached statement.
assert.equal(sql.size, 4);

// A JS number always binds as REAL; use a bigint where INTEGER matters (TEXT/untyped columns, expressions).
assert.equal(db.prepare('SELECT typeof(?) AS t').get(3).t, 'real');
assert.equal(db.prepare('SELECT typeof(?) AS t').get(3n).t, 'integer');
db.exec("INSERT INTO users(name, tag) VALUES ('carol', '3')");
assert.equal(sql.get`SELECT name FROM users WHERE tag = ${3}`, undefined); // compares as '3.0'
assert.equal(sql.get`SELECT name FROM users WHERE tag = ${3n}`.name, 'carol');

db.close();
