# TLS additions

Source: `doc/api/tls.md` at nodejs/node `ab476eccd03`. Examples: `tls-cert-compression.mjs`,
`tls-socket-socket.mjs` (they share the test-only `fixture-cert.cjs`).

## Certificate compression, RFC 8879 (v26.4.0, v24.19.0)

* `tls.getCertificateCompressionAlgorithms()` returns the names this OpenSSL build supports,
  for example `['zlib', 'brotli', 'zstd']` on all tested binaries. It returns `[]` when unsupported.
* `certificateCompression: ['zstd', 'zlib']` is an option of `tls.createSecureContext()`, which means it is also accepted
  by `tls.createServer()`, `tls.connect()`, and `https`. The list is in preference order. Default `[]` (off).
* **Both peers must enable it.** Server-only or client-only settings change nothing
  (measured: a 6-cert chain handshake dropped from about 4600 to about 2470 server bytes only when both sides used `zlib`).
  It applies to TLS 1.3 only.
* An unknown name throws `ERR_INVALID_ARG_VALUE`.

## `tlsSocket.socket` (v27.0.0; docs say `v27.0.0-alpha.0.0.0`)

* Server side: the raw connection from the server's `'connection'` event.
* Client created with `tls.connect({ socket })`: that socket.
* Client created with `tls.connect({ port | path })`: `null`. Read `remoteAddress` and similar from the TLSSocket.
* It remains set after destroy, which is useful in `server.on('tlsClientError', (err, tlsSocket) => ...)`
  to identify the raw connection.
* On v26.13/v24.19 the property is `undefined`.

## Other TLS changes in range (not exercised)

* `tlsSocket.authorized` (v26.8.0, v24.22.0): a TLS 1.3 resumed session in which the client
  presented no certificate is no longer reported as authorized.
* v27: the `clientCertEngine`, `privateKeyEngine`, and `privateKeyIdentifier` options throw
  `ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED`.
