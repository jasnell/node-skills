# Changed defaults and behavior (v24 → main)

Each row says what code written for older Node.js must now do differently.
**Verified** means the behavior was run on the main build (v28.0.0-pre) and
compared with v26.13.0 and v24.19.0. **Docs** means the row comes from the
YAML and was not run.

## Already on v24 LTS

| Change | Versions | What to do | Status |
| --- | --- | --- | --- |
| `Buffer.poolSize` 8192 → **65536** | v26.3.0, v24.18.0 (so **not** in v25.x or v26.0–26.2) | `Buffer.allocUnsafe(n)` for n < 32 KiB is sliced from a 64 KiB pool. Don't hold small slices long-term if memory matters; use `Buffer.allocUnsafeSlow()` or copy them | verified |
| SQLite `defensive: true` by default | v25.5.0, v24.14.0 | `PRAGMA writable_schema = ON` and other schema-corrupting operations are silently ignored. Pass `{ defensive: false }` to `new DatabaseSync()` only for trusted maintenance | verified |
| type stripping is stable and on by default | v25.2.0, v24.12.0 | see the `node-modules-loading` skill | verified |

## v25 / v26

| Change | Versions | What to do | Status |
| --- | --- | --- | --- |
| Web Storage on by default (`localStorage`, `sessionStorage`) | v25.0.0 | `'localStorage' in globalThis` is now `true`. Don't use it to detect a browser | verified |
| `localStorage` without `--localstorage-file` | v26.0.0 | The docs say access throws a `DOMException`. **Actual behavior (v26.13.0 and main):** the value is `undefined`, with an `ExperimentalWarning` saying "--localstorage-file was not provided". Pass `--localstorage-file=path` or don't use it. `sessionStorage` is in-memory and works | verified (differs from docs) |
| `readable.read()` with no `size` | v26.0.0 | Returns **one buffered chunk** per call instead of everything that is buffered. Loop until `null`, or concatenate with `for await` | verified |
| HTTP `'upgrade'` with a request body | v26.0.0 | The body is parsed and emitted on `req` (`'data'`). The upgraded stream starts after the body. Attach `req.on('data')` **before** reading the stream. Code that read the body from `head` or the socket gets only the post-body bytes | verified |
| `process.execve()` failure | v26.1.0 | A failed `execve(2)` throws (for example `ENOENT`) instead of aborting the process. Wrap it in `try`. Native `AtExit` callbacks no longer run before exec | verified (throw); docs (AtExit) |
| `--use-largepages` | v26.9.0 | No-op. Prints "--use-largepages is no longer supported." to stderr and continues. Remove it from scripts | verified |
| `stripTypeScriptTypes({ mode: 'transform' })`, `sourceMap`, `--experimental-transform-types` | v26.0.0 | removed: see the `node-modules-loading` skill | verified |

## v27 alpha line

| Change | Versions | What to do | Status |
| --- | --- | --- | --- |
| `http.Server` `keepAliveTimeout` 5000 → **65000** ms | v27.0.0-alpha.0.0.0 | Idle keep-alive sockets stay open 65 s. Pass `keepAliveTimeout` to `createServer()` (or set `server.keepAliveTimeout`) to choose a value. Keep it above the load balancer's idle timeout | verified |
| `fs.mkdtemp*` with a `Buffer` prefix | v27.0.0-alpha.0.0.0 | Returns a `Buffer`. The docs say an explicit `encoding` still yields a string, but on main a Buffer prefix **always** returned a Buffer (sync, callback and promises, with `encoding: 'utf8'` too). Use a string prefix, or `.toString()` the result | verified (differs from docs) |
| REPL top-level `await` always on | v27.0.0-alpha.0.0.0 | `--no-experimental-repl-await` now **fails** ("invalid negation"). `--experimental-repl-await` is still accepted as a no-op, even though the docs say it was removed. Drop both | verified |
| `dns.reverse()` ignores hosts files | v27.0.0-alpha.0.0.0 | Reverse lookups query DNS only, so `/etc/hosts` entries no longer answer `dns.reverse()` | docs |
| http classes without `new` | v27.0.0-alpha.0.0.0 (runtime deprecation) | Still works, with a warning (DEP0195) | verified |
| `module.register()` removed | main (unreleased) | see the `node-modules-loading` skill | verified |
