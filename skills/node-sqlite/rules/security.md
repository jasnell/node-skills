# Running untrusted SQL or opening untrusted database files

## Defensive mode

- The `defensive` option (v25.1.0, v24.12.0) is **on by default since v25.5.0,
  v24.14.0**. It sets `SQLITE_DBCONFIG_DEFENSIVE`, which disables the SQL
  features that can deliberately corrupt the file. With it on, for example,
  `PRAGMA writable_schema=ON; UPDATE sqlite_schema ...` fails with
  `ERR_SQLITE_ERROR: table sqlite_master may not be modified` (verified on
  v24.19.0, v26.13.0 and main).
- `new Database(path, { defensive: false })` or `db.enableDefensive(false)`
  turns it off. Do that only for legacy tooling that edits the schema table.
- Code written for v24.12 and earlier that relied on writable_schema now
  breaks unless it opts out.

## Authorizer: `db.setAuthorizer(callback | null)` (v24.10.0)

The callback is `(actionCode, arg1, arg2, dbName, triggerOrView) => result`.
SQLite calls it while it **prepares** a statement, and again whenever it
re-prepares one after a schema change, so a denied statement throws at
`prepare()`/`exec()` time with `ERR_SQLITE_ERROR: not authorized`.

It must return one of:

- `constants.SQLITE_OK` (0): allow.
- `constants.SQLITE_DENY` (1): fail the statement.
- `constants.SQLITE_IGNORE` (2): skip the action silently. For a `SQLITE_READ` of a column, the value reads as NULL.

Common action codes in `sqlite.constants` include `SQLITE_SELECT`, `SQLITE_READ` (arg1 is
the table, arg2 the column), `SQLITE_INSERT`, `SQLITE_UPDATE`, `SQLITE_DELETE`,
`SQLITE_FUNCTION` (arg2 is the function name), `SQLITE_PRAGMA`, `SQLITE_ATTACH`,
`SQLITE_CREATE_TABLE` and `SQLITE_DROP_TABLE`. The full list is in
`doc/api/sqlite.md` under "Authorization action codes".

An allowlist is safer than a denylist:

```js
const { constants: c } = sqlite;
const ok = new Set([c.SQLITE_SELECT, c.SQLITE_READ, c.SQLITE_FUNCTION]);
db.setAuthorizer((action) => (ok.has(action) ? c.SQLITE_OK : c.SQLITE_DENY));
```

Re-entrancy rules:

- Since v26.8.0 and v24.22.0, the callback must not touch the connection that invoked it. A call to
  `prepare`, `exec`, statement execution, an iterator, a tag store, or
  `setAuthorizer` throws `ERR_INVALID_STATE`. Other connections stay usable.
- On older versions (verified on v24.19.0; v24.22.3 throws as described above) such a call is *allowed* and causes the authorizer to
  recurse. Never do it.

## Limits: resource caps against hostile input

- At construction: `new Database(p, { limits: { sqlLength, length, attach, ... } })`.
- At runtime (v25.8.0, v24.15.0): read or set `db.limits.sqlLength = 10_000`.
  `Infinity` resets a limit to the compile-time maximum (1e9 for `length` and `sqlLength` on the
  bundled SQLite).
- An exceeded limit throws `ERR_SQLITE_ERROR` (for example "string or blob too big" or
  "too many attached databases - max 0").
- Useful settings for untrusted SQL: `attach: 0`, a small `sqlLength`, `exprDepth`,
  `compoundSelect`, `variableNumber`, `length` (the maximum string/BLOB size), and
  `likePatternLength`.

## Checklist for untrusted input

1. Bind user values. Use the tag store or `?` parameters, never `exec()` with
   interpolated values.
2. If users supply whole SQL statements: open the file with `readOnly: true`, set an allowlist
   authorizer and tight `limits`, and keep `defensive` on. Do not set
   `allowExtension: true`.
3. If users supply database files: open them `readOnly` with `defensive` on and an
   authorizer. The authorizer also sees accesses made by triggers and views (the
   fifth argument, `triggerOrView`, names them).
4. Every call is synchronous. Run heavy or untrusted queries in a `Worker` so a
   slow query cannot block the event loop. `timeout` only covers waiting
   for locks.
5. The `'sqlite.db.query'` channel publishes the *expanded* SQL, with bound values
   substituted. Treat its subscribers as having access to the data.
