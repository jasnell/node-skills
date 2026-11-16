# Advanced node:sqlite features

## Virtual tables: `db.createModule(name, options)` (v26.11.0, not on v24)

```js
db.createModule('series', {
  columns: [
    { name: 'value', type: 'INTEGER' },
    { name: 'stop', type: 'INTEGER', hidden: true }, // hidden = function argument
  ],
  *rows(stop) {            // receives the hidden columns in order
    stop ??= 10;           // an omitted argument arrives as null, not undefined
    for (let i = 1n; i <= BigInt(stop); i++) yield [i];
  },
  // directOnly: true      -> not usable from triggers or views
  // useBigIntArguments: true
});
db.prepare('SELECT value FROM series(5)').all();  // table-valued function
db.prepare('SELECT * FROM series').all();         // eponymous table
db.exec('CREATE VIRTUAL TABLE s USING series');   // named virtual table
```

- `type` must be one of `INTEGER`, `TEXT`, `REAL`, `BLOB` or `ANY`. Any other type throws
  `ERR_INVALID_ARG_VALUE`.
- `rows` returns any iterable of row arrays (a generator works).
- No affinity is applied: a yielded number is REAL even in an INTEGER column.
  Yield bigints when you need INTEGER storage.
- Because the arguments of an omitted hidden column are `null`, a JS default parameter
  (`rows(stop = 10)`) does not apply. Use `??=`.

## Snapshots: `serialize()` / `deserialize()` (v26.1.0, v24.16.0)

- `db.serialize([dbName])` returns a `Uint8Array` that holds a complete database file
  (it starts with `SQLite format 3`). Use it to save, clone, or transfer an
  in-memory database, for example with `fs.writeFileSync`, `postMessage`, or a
  `Blob`.
- `db.deserialize(bytes[, { dbName }])` replaces the target database, and the result is
  writable. It **finalizes every existing prepared statement first**, even if
  deserialization then fails. Calling it from inside a callback (a UDF, the
  authorizer, or a changeset handler) throws `ERR_INVALID_STATE`.
- For a file-to-file copy with progress reporting, use `sqlite.backup(db, path, { rate, progress })`
  instead (it returns a Promise, v23.8.0, v22.16.0).

## Statement counters: `stat(counter)` / `resetStats()` (v26.8.0, not on v24)

`stmt.stat(name)` returns a number. The counters are `fullscanStep`, `sort`, `autoindex`,
`vmStep`, `reprepare`, `run`, `filterMiss`, `filterHit` and `memused`. An unknown name
throws `ERR_INVALID_ARG_VALUE`. `resetStats()` zeroes every counter except
`memused`.

To guard against a query that falls back to a full table scan, for example in a test:

```js
const q = db.prepare('SELECT * FROM t WHERE email = ?');
q.get(email);
assert.equal(q.stat('fullscanStep'), 0); // fails if the index is missing
```

`filterMiss` and `filterHit` require SQLite 3.38 or later. The bundled versions are 3.53.3 in v24.19.0,
3.54.0 in v26.13.0, and 3.54.1 on main.

## Diagnostics: `'sqlite.db.query'` channel (v26.8.0, v24.22.0, Stability 1)

```js
import dc from 'node:diagnostics_channel';
dc.subscribe('sqlite.db.query', ({ sql, database, duration }) => { /* ... */ });
```

- The event fires once after each statement finishes, including each `exec()` statement.
- `sql` is the **expanded** SQL with the bound values substituted. For example, `run(5)`
  shows `INSERT INTO t VALUES (5.0)`, because a number binds as REAL.
- `duration` is SQLite's estimate of the run time, in nanoseconds.
- The event is not a tracing span: there is no start event and no async context. To get spans,
  wrap your calls in a `TracingChannel` yourself.
- There is no cost when nothing subscribes. Subscribers must not close the database or
  the statement.

## Sessions and changesets (older, unchanged)

`db.createSession({ table?, db? })` with `session.changeset()`/`patchset()`, and
`db.applyChangeset(bytes, { filter, onConflict })` (v23.3.0, v22.12.0).
`session[Symbol.dispose]` was added in v24.9.0.
`session.close()` throws `ERR_INVALID_STATE` when it is called from a callback that SQLite invoked.

## User-defined functions

`db.function(name, { deterministic, directOnly, useBigIntArguments, varargs }, fn)`
and `db.aggregate(name, { start, step, result, inverse, ... })` (v24.0.0, v22.16.0).
A statement cannot be re-entered from its own UDF: `close()` or re-running it
throws `ERR_INVALID_STATE`, but other statements remain usable.
