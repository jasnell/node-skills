---
name: node-sqlite
description: "Node.js now has a built-in SQLite database, node:sqlite, with no npm dependency. Use whenever a Node.js task needs a database that runs in-process: SQLite, a local, embedded or in-memory database, or app/CLI storage; safe parameterized SQL that prevents SQL injection; running untrusted SQL; or would otherwise reach for better-sqlite3 or sqlite3. Covers Database/Statement (DatabaseSync and StatementSync are deprecated aliases), createTagStore tagged-template SQL, setAuthorizer, defensive mode (on by default), limits, serialize/deserialize, createModule virtual tables, statement.close/stat and using. Node.js 24+; some parts need 24.22+ or 26.x."
---

# node:sqlite (current API)

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| module, `DatabaseSync`/`StatementSync` | v22.5.0; unflagged v23.4.0, v22.13.0 | 1.2 RC (v25.7.0, v24.15.0) | none |
| `createTagStore`, `SQLTagStore` | v24.9.0 | 1.2 | none |
| `setAuthorizer` | v24.10.0 | 1.2 | none |
| `defensive`, `enableDefensive` | v25.1.0, v24.12.0; on by default v25.5.0, v24.14.0 | 1.2 | none |
| `database.limits` | v25.8.0, v24.15.0 | 1.2 | none |
| `serialize`, `deserialize` | v26.1.0, v24.16.0 | 1.2 | none |
| bind `boolean`, `ArrayBuffer` | v26.8.0, v24.21.0 | 1.2 | none |
| `statement.close`, `statement[Symbol.dispose]` | v26.8.0, v24.22.0 | 1.2 | none |
| `'sqlite.db.query'` channel | v26.8.0, v24.22.0 | 1 | none |
| `stat`, `resetStats`, `prepare({ persistent })` | v26.8.0 (not v24) | 1.2 | none |
| bind `undefined` as NULL | v26.10.0 (not v24) | 1.2 | none |
| `Database`/`Statement` names, `createModule` | v26.11.0 (not v24) | 1.2 | none |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Portable import

```js
import * as sqlite from 'node:sqlite';
const Database = sqlite.Database ?? sqlite.DatabaseSync; // v24 has only DatabaseSync
```

On v24, `import { Database }` is a link-time SyntaxError.

## Tagged-template queries

```js
const db = new Database('app.db');
const sql = db.createTagStore(); // LRU cache of prepared statements (default 1000)
sql.run`INSERT INTO users(name) VALUES (${name})`; // ${} binds; it never interpolates
const user = sql.get`SELECT * FROM users WHERE id = ${id}`;
```

## Statements and disposal

```js
using db = new Database(':memory:');
{
  using stmt = db.prepare('INSERT INTO t VALUES (?, ?)'); // v24.22+/v26.8+
  stmt.run(1n, 'a');
} // finalized here
```

## Untrusted SQL

```js
const { constants: c } = sqlite;
const ok = new Set([c.SQLITE_SELECT, c.SQLITE_READ, c.SQLITE_FUNCTION]);
db.setAuthorizer((action) => (ok.has(action) ? c.SQLITE_OK : c.SQLITE_DENY));
db.limits.sqlLength = 10_000; // or new Database(p, { limits: { ... } })
```

## Pitfalls

- A JS number always binds as REAL. Use a bigint where INTEGER matters (TEXT or untyped columns, expressions, virtual tables).
- Before v24.21, a boolean throws and an `ArrayBuffer` silently binds NULL. Pass `BigInt(flag)` and `new Uint8Array(ab)` instead.
- Before v26.10, an anonymous `undefined` parameter throws. Use `null`.
- Never put `?` in tag-store SQL. v24.22+ and v26 throw `ERR_INVALID_ARG_VALUE`, while v24.19 silently binds NULL.
- Defensive mode blocks `writable_schema` edits. Use `{ defensive: false }` only for legacy tooling.
- The authorizer must not use its own connection. Since v24.22 that throws `ERR_INVALID_STATE`; older versions recurse.
- On v24, `prepare({ persistent })` is silently ignored. All calls are synchronous.

## Don't

- Don't add `better-sqlite3`/`sqlite3` when `node:sqlite` covers the need, and don't pass `--experimental-sqlite`.
- Don't build SQL with string concatenation or with an untagged template passed to `exec()`. Use the tag store or `?` parameters.
- Don't write `DatabaseSync` in code that only targets v26.11+.

## Reference

- [rules/api.md](rules/api.md): constructor options, every Database/Statement/SQLTagStore method, binding rules
- [rules/security.md](rules/security.md): authorizer action codes, defensive mode, limits, untrusted database files
- [rules/advanced.md](rules/advanced.md): createModule, serialize, stat counters, diagnostics channel, sessions, backup
