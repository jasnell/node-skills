# End-of-Life removals (v23 → main)

Source: `doc/api/deprecations.md` at nodejs/node `ab476eccd03`. The "Gone in"
column is the version whose YAML records `End-of-Life`. On the release line
before that, the API still works and emits a runtime `DeprecationWarning`
(on v24 for the v25 rows, on v26 for the v27 rows).

`v27.0.0-alpha.0.0.0` means the v27 alpha line. No stable v27 exists yet. "main"
means unreleased (`REPLACEME` in the docs; present in the v28.0.0-pre build).

The "Verified" column records what the main build does: **undef** (property
is `undefined`), **throws** (with the code shown), or **docs** (taken from the
docs and not run here).

## v25.0.0 and later

| DEP | Stale | Write instead | Gone in | Verified |
| --- | --- | --- | --- | --- |
| 0030 | `buffer.SlowBuffer` | `Buffer.allocUnsafeSlow(n)` | v25.0.0 | undef |
| 0176 | `fs.F_OK`/`R_OK`/`W_OK`/`X_OK` | `fs.constants.*` or `fs.promises.constants.*` | v25.0.0 | undef |
| 0147 | `fs.rmdir[Sync](p, { recursive: true })`, `fsPromises.rmdir` | `fs.rm(p, { recursive: true, force: true })` | v25.0.0 | throws `ERR_INVALID_ARG_VALUE` |
| 0137 | letting a `FileHandle` be GC'd while open | `await fh.close()` or `await using fh = await open()` | v25.0.0 | uncaught `ERR_INVALID_STATE` |
| 0173 | `assert.CallTracker` | `mock.fn()` / `t.mock.fn()` from `node:test` | v25.0.0 | undef |
| 0094 | `assert.fail(actual, expected, …)` | `assert.strictEqual(a, b)`, or `assert.fail(message)` | v25.0.0 | the first arg becomes the message; no comparison |
| 0160 | `process.on('multipleResolves')` | nothing (event never fires) | v25.0.0 | listener accepted, never called (docs) |
| 0185 | `repl.REPLServer()` / `Recoverable()` without `new` | `new repl.REPLServer()` | v25.0.0 | throws `TypeError` |
| 0118 | `dns.lookup(false)` or other falsy host | validate the host first | v25.0.0 | throws `ERR_INVALID_ARG_VALUE` |
| 0154 | RSA-PSS keygen `hash`, `mgf1Hash` | `hashAlgorithm`, `mgf1HashAlgorithm` | v25.0.0 | throws `ERR_INVALID_ARG_VALUE` |
| 0170 | `url.parse()` with a non-numeric port | `new URL()` | v25.0.0 | throws `ERR_INVALID_ARG_VALUE` |
| 0132 | `worker.terminate(cb)` | `await worker.terminate()` | v25.0.0 | callback ignored |
| 0129 | `child._channel` | `child.channel` | v25.0.0 | docs |
| 0172 | `boundFn.asyncResource` | keep a reference to the `AsyncResource` | v25.0.0 | docs |
| 0152 | extra props on `'gc'`/`'http'`/`'http2'` PerformanceEntry | `entry.detail` | v25.0.0 | docs |
| 0112 | `dgram` `socket._handle`, `_bindState`, `_queue`… | public `dgram` API | v25.0.0 | docs |
| 0123 | TLS `servername` set to an IP address | omit `servername` for IPs | v25.0.0 | docs |
| 0135 | `ReadStream.open()` / `WriteStream.open()` | `fs.createReadStream()` / `createWriteStream()` | v25.0.0 | docs |
| 0077 | `Module._debug()` | nothing | v25.0.0 | docs |
| 0193 | `require('node:_stream_readable')`, `_writable`, `_duplex`, `_transform`, `_passthrough` | `require('node:stream')` | v26.0.0 | throws `ERR_UNKNOWN_BUILTIN_MODULE` |
| 0125 | `require('node:_stream_wrap')` | `node:stream` | v26.0.0 | throws `ERR_UNKNOWN_BUILTIN_MODULE` |
| 0063 | `res.writeHeader()` | `res.writeHead()` | v26.0.0 | undef |
| 0182 | GCM `decipher.setAuthTag(shortTag)` without `authTagLength` | `createDecipheriv(alg, key, iv, { authTagLength })` | v26.0.0 | throws `ERR_CRYPTO_INVALID_AUTH_TAG` |
| 0093 | `crypto.fips` (get/set) | `crypto.getFips()` / `crypto.setFips(bool)` | v27 alpha | undef |
| 0183 | `crypto.setEngine()`, `ENGINE_METHOD_*`, TLS `clientCertEngine`, `privateKeyEngine`, `privateKeyIdentifier` | no replacement (OpenSSL providers) | v27 alpha | `setEngine` undef; options throw `ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED` (docs) |
| 0184 | `zlib.Gzip()`, `Deflate()`, `BrotliCompress()`, `ZstdCompress()`… without `new` | `new zlib.Gzip()` or `zlib.createGzip()` | v27 alpha | throws `TypeError` |
| 0192 | `require('node:_tls_wrap')`, `_tls_common` | `node:tls` | v27 alpha | throws `ERR_UNKNOWN_BUILTIN_MODULE` |
| 0198 | `createHash('shake128'/'shake256')` without `outputLength` | `createHash('shake256', { outputLength: 32 })` | v27 alpha | throws (OpenSSL `ERR_OSSL_EVP_NOT_XOF_OR_INVALID_LENGTH`) |
| 0203 | passing a WebCrypto `CryptoKey` to `node:crypto` functions | `crypto.KeyObject.from(cryptoKey)` | v27 alpha | throws `ERR_INVALID_ARG_TYPE` |
| 0204 | `KeyObject.from(nonExtractableKey)` | generate the key with `extractable: true`, or stay in `crypto.subtle` | v27 alpha | throws `ERR_INVALID_ARG_VALUE` |
| 0097 | the `domain` property on `AsyncResource` / `MakeCallback` | `AsyncLocalStorage` | v27 alpha | docs |
| 0205 | `module.register()`, `--loader`, `--experimental-loader` | `module.registerHooks()` (see the `node-modules-loading` skill) | main | undef; flags give `bad option` |

## Older removals agents still emit (gone before or at the v24 floor)

| DEP | Stale | Write instead | Gone in |
| --- | --- | --- | --- |
| 0045–0058 | `util.isBoolean`, `isBuffer`, `isDate`, `isError`, `isFunction`, `isNull`, `isNullOrUndefined`, `isNumber`, `isObject`, `isPrimitive`, `isRegExp`, `isString`, `isSymbol`, `isUndefined` | `typeof`, `Buffer.isBuffer`, `util.types.isDate`, `Error.isError`, `util.types.isRegExp` | v23.0.0 |
| 0059 | `util.log()` | `console.log()` | v23.0.0 |
| 0100 | `process.assert()` | `node:assert` | v23.0.0 |
| 0108 | `zlib.bytesRead` | `zlib.bytesWritten` | v23.0.0 |
| 0106 | `crypto.createCipher/createDecipher` | `createCipheriv/createDecipheriv` with a real IV | v22.0.0 |
| 0178 | `dirent.path` | `dirent.parentPath` | v24.0.0 |
| 0064 / 0043 | `tls.createSecurePair()`, `tls.SecurePair` | `tls.TLSSocket` | v24.0.0 |
| 0066 | `res._headers`, `_headerNames` | `res.getHeaders()`, `getHeaderNames()` | v24.0.0 |
| 0081 | `fs.truncate(fd)` | `fs.ftruncate(fd)` | v24.0.0 |
| 0095/0096/0126/0127 | `timers.enroll`, `unenroll`, `active`, `_unrefActive` | `setTimeout` / `timeout.refresh()` | v24.0.0 |
| 0121 / 0122 | `net._setSimultaneousAccepts()`, `tlsServer.setOptions()` | nothing / create a new server | v24.0.0 |

`util.isArray` (DEP0044) and `util._extend` (DEP0060) are still present but
runtime-deprecated: use `Array.isArray` and `Object.assign`.

## Codemods

`deprecations.md` lists `npx codemod@latest @nodejs/<recipe>` migrations for
several rows: `slow-buffer-to-buffer-alloc-unsafe-slow`, `rmdir`,
`fs-access-mode-constants`, `crypto-fips-to-getFips`, `repl-classes-with-new`,
`crypto-rsa-pss-update`, `http-classes-with-new` and `types-is-native-error`.
They need network access and were not run for this skill.
