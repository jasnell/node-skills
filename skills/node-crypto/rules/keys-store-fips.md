# Raw key formats, OpenSSL STORE URLs, FIPS indicator events

## Raw key formats (v24.15.0)

`keyObject.export({ format })`, `createPublicKey({ key, format, asymmetricKeyType, namedCurve })`,
and `createPrivateKey(…)` accept these formats:

- `'raw-public'`: EC (uncompressed point, 65 bytes for P-256), Ed25519/448,
  X25519/448, ML-DSA, ML-KEM, SLH-DSA.
- `'raw-private'`: EC, Ed*/X*, SLH-DSA.
- `'raw-seed'`: ML-DSA (32 bytes), ML-KEM (64 bytes).

`asymmetricKeyType` is required when importing raw keys. `namedCurve` is
required for `'ec'`. The docs say `'raw-public'` is generally the fastest
public-key import.

WebCrypto equivalents (Modern Algorithms, 1.1) are `'raw-public'`,
`'raw-secret'` (symmetric keys), and `'raw-seed'`.

## createPrivateKey(new URL(...)) — OpenSSL STORE (v26.7.0, v24.21.0, Stability 1.1)

```js
createPrivateKey(new URL('file:///etc/keys/k.pem'));
createPrivateKey({ key: new URL('pkcs11:object=mykey'), passphrase: pin, properties: 'provider=pkcs11' });
```

- Only a **`URL` object** is sent to the STORE loader. A URL *string* is parsed
  as PEM and fails (`ERR_OSSL_UNSUPPORTED`). On v24.19.0 a URL object throws
  `ERR_INVALID_ARG_TYPE`.
- `format`, `type`, `asymmetricKeyType`, and `namedCurve` are ignored for URLs.
  `passphrase` is the PIN. Do not embed credentials in the URI.
- `properties` is the OpenSSL property query used to pick the loader.
- The scheme does not prove which loader answered. OpenSSL may resolve an
  opaque `pkcs11:` URI as a local file.
- Per the docs' type lists, `sign`, `decapsulate`, `diffieHellman`, and
  `generateX509Certificate` `signature.key` also accept a URL for the private
  key. Only `createPrivateKey` was exercised here.

Under `--permission`, the call throws `ERR_ACCESS_DENIED` with
`err.permission === 'OpenSSLStore'` unless you pass `--allow-openssl-store`.
That flag prints a `PERM0007` SecurityWarning, and
`process.permission.has('openssl.store')` reports it. Loaders are **not**
bound by `fs.read`, `fs.write`, or `net`: with `--allow-openssl-store` and no
read grant for the key's directory, the key still loaded. Loaders are bound by
`--allow-env`. See the `node-permissions` skill.

## FIPS indicator events (v26.9.0, v24.22.0, Stability 1)

- `--enable-fips-indicator-events` publishes OpenSSL FIPS indicator results
  to the `diagnostics_channel` named `'crypto.fips.indicator'`. Messages have
  `{ operation, reason, blocked, count, dropped }`.
- Requires OpenSSL 3.4+. The flag does not enable FIPS.
- Messages are async and best-effort (a queue of 256, overflow counted in
  `dropped`), arrive only on the main thread, and should not be treated as an
  audit log.
- `--force-fips=strict` (v26.9.0, v24.22.0; OpenSSL 3.4+) rejects
  non-approved operations reported by the indicator. `--force-fips=provider`
  is the default.

Only the flag and subscription wiring were verified (the flag is accepted on
v26.13 and main; it is a bad option on v24.19). Delivery of messages needs a
configured FIPS provider, which was not available, so it is **unverified**.

`crypto.fips` (the property) is gone. Use `crypto.getFips()` and
`crypto.setFips()`.
