---
name: node-modern-migration
description: "Fixes Node.js code that uses APIs removed or deprecated in v25-v28, or that relies on changed defaults. Use when upgrading Node.js; when fixing a DEP0xxx DeprecationWarning, ERR_UNKNOWN_BUILTIN_MODULE, \"cannot be invoked without 'new'\" or \"is not a function\" after an upgrade; or when reviewing code written for Node 22 or older. Covers SlowBuffer, fs.F_OK, fs.rmdir recursive, assert.CallTracker, node:_stream_*, crypto.fips, setEngine, CryptoKey in node:crypto, SHAKE outputLength, and the zlib/REPL classes that now need new. Also covers the new defaults for keepAliveTimeout (65s), Buffer.poolSize, readable.read() and localStorage. Node.js 24+."
---

# Removed APIs and changed defaults (v24 → main)

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| EOL removals below | v25.0.0, v26.0.0, v27.0.0-alpha.0.0.0, main | removed | — |
| Changed defaults below | per row | — | — |
| `localStorage` on by default | v25.0.0 | 1.2 RC | `--localstorage-file` |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

`v27.0.0-alpha.0.0.0` is an alpha line: no stable v27 exists yet. On v26
those rows still work but print a runtime `DeprecationWarning`.

## Stale pattern → write instead

Each replacement already works on v24, so migrate without a version gate.

| Stale | Write | Gone in |
| --- | --- | --- |
| `SlowBuffer(n)` | `Buffer.allocUnsafeSlow(n)` | v25.0.0 |
| `fs.F_OK`, `fs.R_OK`… | `fs.constants.F_OK` | v25.0.0 |
| `fs.rmdir(p, { recursive })` | `fs.rm(p, { recursive: true, force: true })` | v25.0.0 |
| `assert.CallTracker` | `mock.fn()` from `node:test` | v25.0.0 |
| `assert.fail(a, b)` | `assert.strictEqual(a, b)` | v25.0.0 |
| `repl.REPLServer()` | `new repl.REPLServer()` | v25.0.0 |
| leaked `FileHandle` | `await using fh = await open()` | v25.0.0 (throws) |
| `require('node:_stream_readable')` | `require('node:stream')` | v26.0.0 |
| `res.writeHeader()` | `res.writeHead()` | v26.0.0 |
| `crypto.fips` | `crypto.getFips()` / `setFips()` | v27 alpha |
| `zlib.Gzip()` | `new zlib.Gzip()` or `zlib.createGzip()` | v27 alpha |
| `createHash('shake256')` | `createHash('shake256', { outputLength })` | v27 alpha |
| `CryptoKey` into `node:crypto` | `KeyObject.from(key)` | v27 alpha |
| `crypto.setEngine`, `clientCertEngine` | none (OpenSSL providers) | v27 alpha |
| `module.register()`, `--loader` | `module.registerHooks()`: see `node-modules-loading` | main |
| `--experimental-transform-types` | erasable TS only, no flag: see `node-modules-loading` | v26.0.0 |

## Changed defaults

- `server.keepAliveTimeout` is **65000** ms, was 5000 (v27 alpha). Set it explicitly if a proxy needs it shorter.
- `Buffer.poolSize` is **65536**, was 8192 (v26.3.0, v24.18.0).
- `readable.read()` with no size returns **one chunk** (v26.0.0). Loop `while ((c = r.read()) !== null)`.
- `localStorage` without `--localstorage-file` is `undefined` plus a warning (v26.0.0, verified; the docs say it throws).
- `new DatabaseSync(path)` has `defensive: true` by default (v25.5.0, v24.14.0).
- `fs.mkdtemp(Buffer)` returns a Buffer, even with `encoding: 'utf8'` (v27 alpha). Pass a string prefix to get a string.

## Pitfalls

- On v26, run tests with `--throw-deprecation` to surface the v27/main removals.
- `http` classes without `new` only warn (DEP0195). Add `new` anyway.
- `sqlite.Database` (the new name for `DatabaseSync`) is not on v24.19. Keep using `DatabaseSync` while v24 is supported.

## Don't

- Don't use the `util.isDate`/`isString`/… helpers, `util.log` (EOL v23.0.0), `crypto.createCipher` (v22.0.0) or `dirent.path` (v24.0.0).
- Don't load `node:domain` (runtime-deprecated in v27 alpha) or `node:_http_*`.

## Reference

- [rules/removals.md](rules/removals.md): every End-of-Life since v23, with what throws and how. Read it for any API missing from the table above.
- [rules/deprecations.md](rules/deprecations.md): runtime and documentation-only deprecations that still work but warn.
- [rules/changed-defaults.md](rules/changed-defaults.md): every changed default with details (upgrade event, dns.reverse, REPL await, execve, largepages).
