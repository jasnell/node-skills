# node:sqlite API reference (delta from Node 22)

The docs are pinned at nodejs/node `ab476eccd03`. Every API here is synchronous.
The module is only available as `node:sqlite` (the `node:` prefix is required).

## Names

| Name | Versions | Notes |
| --- | --- | --- |
| `Database`, `Statement` | v26.11.0 only (not on v24.x as of v24.22.3) | The new names |
| `DatabaseSync`, `StatementSync` | v22.5.0 | Documentation-only deprecated aliases (DEP0210, DEP0211, v26.11.0). They are the same class objects (`Database === DatabaseSync`) and emit no warning |

The docs give `Class: Database` as `added: v22.5.0`. That date is when the class
first shipped, but the `Database` *name* only exists from v26.11.0 (see
CHANGELOG_V26 #65988). Portable code:

```js
import * as sqlite from 'node:sqlite';
const Database = sqlite.Database ?? sqlite.DatabaseSync;
// CommonJS: const { Database = require('node:sqlite').DatabaseSync } = require('node:sqlite');
```

## `new Database(path[, options])`

`path` is a string, Buffer, or URL, or `':memory:'`. Options:

| Option | Default | Since |
| --- | --- | --- |
| `open` | `true` | v22.5.0 |
| `readOnly` | `false` | v22.5.0 |
| `enableForeignKeyConstraints` | `true` | v22.5.0 |
| `enableDoubleQuotedStringLiterals` | `false` | v22.5.0 |
| `allowExtension` | `false` | v23.5.0, v22.13.0 |
| `timeout` (busy timeout, ms) | `0` | v24.0.0, v22.16.0 |
| `readBigInts`, `returnArrays`, `allowBareNamedParameters` (`true`), `allowUnknownNamedParameters` (`false`) | | v24.4.0, v22.18.0 |
| `defensive` | `true` since v25.5.0, v24.14.0 (was `false`) | v25.1.0, v24.12.0 |
| `limits` `{ length, sqlLength, column, exprDepth, compoundSelect, vdbeOp, functionArg, attach, likePatternLength, variableNumber, triggerDepth }` | SQLite compile-time | verified on v24.19.0; no separate YAML entry |

## Database methods and properties

| Member | Versions | Notes |
| --- | --- | --- |
| `exec(sql)` | v22.5.0 | Runs one or more statements and returns nothing. Never interpolate input into it |
| `prepare(sql[, options])` | v22.5.0 | The options are `readBigInts`, `returnArrays`, `allowBareNamedParameters`, `allowUnknownNamedParameters` and `persistent` (v26.8.0, a hint that sets `SQLITE_PREPARE_PERSISTENT`). On v24, unknown options are ignored. SQL with no statement (for example only a comment) throws `ERR_INVALID_ARG_VALUE` since v26.8.0, v24.21.0 |
| `createTagStore([maxSize=1000])` | v24.9.0 | Returns a `SQLTagStore` |
| `setAuthorizer(fn \| null)` | v24.10.0 | See `rules/security.md` |
| `enableDefensive(bool)` | v25.1.0, v24.12.0 | |
| `limits` | v25.8.0, v24.15.0 | Get or set at runtime. `Infinity` resets a limit to the compile-time maximum |
| `serialize([dbName='main'])` | v26.1.0, v24.16.0 | Returns a `Uint8Array` file image |
| `deserialize(bytes[, { dbName }])` | v26.1.0, v24.16.0 | Replaces the database. It finalizes **all** existing statements (using one afterwards throws `ERR_INVALID_STATE`), and the result is writable |
| `createModule(name, options)` | v26.11.0 | Virtual tables. See `rules/advanced.md` |
| `function(name[, opts], fn)`, `aggregate(name, opts)` | v23.5.0 / v24.0.0, v22.16.0 | User-defined functions |
| `loadExtension(path[, entryPoint])`, `enableLoadExtension(bool)` | v23.5.0, v22.13.0 | Requires `allowExtension: true` at construction |
| `location([dbName])` | v24.0.0, v22.16.0 | Returns `null` for an in-memory database |
| `isOpen`, `isTransaction` | v23.11.0 / v24.0.0 | |
| `open()`, `close()` | v22.5.0 | |
| `[Symbol.dispose]()` | v23.11.0, v22.15.0 (stable since v24.2.0) | Closes the database. Has no effect if it is already closed |
| `createSession()`, `applyChangeset()` | v23.3.0, v22.12.0 | `session[Symbol.dispose]` is from v24.9.0 |

## Statement

| Member | Versions | Notes |
| --- | --- | --- |
| `run(...)` | v22.5.0 | Returns `{ changes, lastInsertRowid }` (number or bigint) |
| `get(...)`, `all(...)` / `iterate(...)` | v22.5.0 / v23.4.0, v22.13.0 | Rows are null-prototype objects (or arrays with `returnArrays`). `get` returns `undefined` when there is no row |
| `close()` | v26.8.0, v24.22.0 | Finalizes the statement. Calling it again throws `ERR_INVALID_STATE`, and so does any later use. While the statement is executing (from inside its own UDF callback), it throws `ERR_INVALID_STATE` |
| `[Symbol.dispose]()` | v26.8.0, v24.22.0 | Like `close()`, but has no effect if the statement is already finalized |
| `stat(counter)`, `resetStats()` | v26.8.0 (not v24) | See `rules/advanced.md` |
| `columns()` | v23.11.0, v22.16.0 | |
| `setReadBigInts`, `setReturnArrays`, `setAllowBareNamedParameters`, `setAllowUnknownNamedParameters` | | |
| `sourceSQL`, `expandedSQL` | v22.5.0 | |

## Binding (all/get/iterate/run and the tag store)

- Anonymous parameters: `?` and `?NNN`. Named parameters: `$x`, `:x`, `@x`, bound
  from an object passed as the first argument. A bare key (`{ x: 1 }`) works
  by default, but `$x` and `@x` in the same statement make the name ambiguous,
  which throws.
- An unknown key throws `ERR_INVALID_STATE` unless `allowUnknownNamedParameters`.
- An unbound parameter is NULL. A named parameter set to `undefined` is NULL on
  every version. An *anonymous* `undefined` throws `ERR_INVALID_ARG_TYPE` before
  v26.10.0 (still the case on v24.22.3).
- Accepted types: `null`, number (always REAL), bigint (INTEGER; outside the int64
  range it throws `ERR_INVALID_ARG_VALUE`), string, TypedArray/DataView/Buffer,
  and also:
  - `boolean` binds as INTEGER 1/0 and reads back as a number. Since v26.8.0, v24.21.0.
    Earlier versions throw `ERR_INVALID_ARG_TYPE`.
  - `ArrayBuffer`/`SharedArrayBuffer` bind as a BLOB since v26.8.0, v24.21.0.
    **Before that they silently bind NULL** (verified on v24.19.0; v24.22.3 binds a BLOB).
- Reading an INTEGER outside the safe-integer range without `readBigInts` throws
  `ERR_OUT_OF_RANGE`. A BLOB reads back as `Uint8Array`.

## SQLTagStore (v24.9.0)

- `all`, `get`, `iterate` and `run` are template tags only. Each `${value}` is a bound
  parameter. The cache key is the literal template text (case-sensitive,
  including where the placeholders are), so `${id}` and a literal `12345` produce different statements.
- Do not write `?`/`$x` in the template. On v24.22.3, v26.13.0 and main that throws
  `ERR_INVALID_ARG_VALUE` ("SQLite parameters must be bound using template
  literal placeholders"). On v24.19.0 the extra `?` silently binds NULL.
- `size` (a getter since v25.5.0, v24.13.1; before that it was a method `size()`), `capacity`,
  `db`, and `clear()`.
- Executing a tagged statement from inside a callback that the same statement
  triggered throws `ERR_INVALID_STATE`.
