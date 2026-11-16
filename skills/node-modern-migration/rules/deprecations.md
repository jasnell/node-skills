# Deprecations that still work (v24 → main)

These still work but are on the removal track. **Runtime** deprecations
print a `DeprecationWarning` once per process. **Documentation-only** ones
are silent unless the docs say they support `--pending-deprecation`.
**Application** deprecations warn only for code outside `node_modules`.

Versions are copied from the YAML `changes:` entries in
`doc/api/deprecations.md`. Where the type changed, the version is that of the
current type.

| DEP | API | Type (since) | Use instead |
| --- | --- | --- | --- |
| 0032 | `node:domain` | Runtime (v27 alpha) | `AsyncLocalStorage`, explicit error handling |
| 0195 | `http.Agent()`, `ServerResponse()`, `IncomingMessage()`… without `new` | Runtime (v27 alpha; doc-only v24.2.0, v22.17.0) | `new http.Agent()` |
| 0199 | `require('node:_http_agent')`, `_http_client`, `_http_common`, `_http_incoming`, `_http_outgoing`, `_http_server` | Runtime (v27 alpha; doc-only v24.6.0, v22.19.0) | `node:http` |
| 0206 | calling `hmac.digest()` twice (returns an empty buffer) | Runtime (v27 alpha; doc-only v26.2.0, v24.18.0) | create a new `Hmac` |
| 0208 | `net.Server.prototype._listen2` | Runtime (v27 alpha; doc-only v26.8.2, v24.22.0) | `server.listen()` |
| 0201 | `Duplex.toWeb(d, { type })` | Runtime (v26.0.0; doc-only v25.7.0, v24.15.0) | `{ readableType }` |
| 0031 | `ecdh.setPublicKey()` | Runtime (v25.0.0) | nothing: the docs say the method is not useful |
| 0187 | `fs.existsSync()` with an invalid argument type | Runtime (v24.0.0) | pass a string, Buffer or URL |
| 0190 | `spawn`/`execFile` with `args` **and** `shell: true` | Runtime (v24.0.0) | drop `shell` and pass `args`, or escape the values yourself in one command string |
| 0044 / 0060 | `util.isArray()`, `util._extend()` | Runtime | `Array.isArray()`, `Object.assign()` |
| 0005 | `new Buffer()` / `Buffer()` | Application | `Buffer.from()`, `Buffer.alloc()` |
| 0169 | `url.parse()` (also `url.format(string)`, `url.resolve()`) | Application (v24.0.0) | `new URL()` |
| 0040 | `node:punycode` | Application | a userland alternative (the docs name none) |
| 0212 | `util.TextEncoder`, `util.TextDecoder` | Doc-only (main) | the global `TextEncoder`/`TextDecoder` |
| 0210 / 0211 | `sqlite.DatabaseSync`, `StatementSync` | Doc-only (v26.11.0) | `sqlite.Database`, `Statement`. These names are **not** on v24.19 (verified), so keep the old names while v24 is supported |
| 0209 | `AbortSignal` used to dispose of long-lived resources (`server.listen({ signal })`) | Doc-only (v26.8.2, v24.22.0) | `await using server = …` |
| 0207 | `stream.aborted` / `'aborted'` in **`node:http2`** | Doc-only (v27 alpha) | `'error'` with `ERR_HTTP2_STREAM_ABORTED`/`ERR_HTTP2_STREAM_ERROR`, `'close'` + `writableFinished` |
| 0202 | HTTP/2 `Http1IncomingMessage`/`Http1ServerResponse` options | Doc-only (v25.7.0, v24.15.0) | `http1Options: { IncomingMessage, ServerResponse }` |
| 0200 | letting an `fs.Dir` be GC'd while open | Doc-only (v24.9.0) | `dir.close()` or `await using dir = await opendir()` |
| 0197 | `util.types.isNativeError()` | Doc-only (v24.2.0) | `Error.isError()` (present on v24.19, verified) |
| 0196 | `{ shell: '' }` in `child_process` | Doc-only (v24.2.0, v22.17.0) | `shell: true` or omit it |
| 0191 | `repl.builtinModules` | Doc-only, `--pending-deprecation` (v24.0.0, v22.16.0) | `module.builtinModules` |
| 0111 | `process.binding()` | Doc-only, `--pending-deprecation` | public APIs (unavailable under the permission model) |
| 0034 | `fs.exists(path, cb)` | Doc-only | `fs.access()` / `fs.stat()` |

## Revoked: do not "fix" these

- DEP0033 `EventEmitter.listenerCount()`: revoked in v25.4.0 and v24.14.0.
- DEP0116 legacy URL API: revoked. `url.parse()` is still deprecated under DEP0169.
- DEP0163 `channel.subscribe()`/`unsubscribe()`: revoked in v24.8.0 and v22.20.0.

## Finding them

```sh
node --throw-deprecation app.js        # turn every runtime deprecation into an exception
node --pending-deprecation app.js      # also warn for the --pending-deprecation doc-only ones
node --trace-deprecation app.js        # print a stack trace for each warning
```
