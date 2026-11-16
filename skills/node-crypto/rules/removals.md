# Removals and deprecations (and what to write instead)

| ID | What | Status | Fix |
| --- | --- | --- | --- |
| DEP0182 | GCM tag shorter than 16 bytes without `authTagLength` | Runtime v23.0.0, **EOL v26.0.0** | pass `authTagLength` to `createDecipheriv` |
| DEP0183 | `crypto.setEngine`, `crypto.constants.ENGINE_METHOD_*`, TLS `clientCertEngine`/`privateKeyEngine`/`privateKeyIdentifier` | Doc v22.4.0, **EOL v27.0.0** | OpenSSL providers. For HSM keys, `createPrivateKey(new URL('pkcs11:…'))` (STORE URL, v26.7.0, v24.21.0) |
| DEP0198 | SHAKE128/256 without `outputLength` | Doc v24.4.0, Runtime v25.0.0, **EOL v27.0.0** | always pass `outputLength` |
| DEP0203 | `CryptoKey` passed to `node:crypto` APIs | Doc v25.9.0/v24.15.0, Runtime v26.0.0, **EOL v27.0.0** | `KeyObject.from(cryptoKey)` |
| DEP0204 | `KeyObject.from()` with a non-extractable `CryptoKey` | same as DEP0203 | generate it extractable, or stay in WebCrypto |

Observed behavior:

- v27+ `createHmac('sha256', cryptoKey)` throws `ERR_INVALID_ARG_TYPE`. Before
  v27 it works with a DEP0203 warning. **v24.19.0 already emits DEP0203 and
  DEP0204 as runtime warnings**, even though the docs list v24.15.0 as
  documentation-only.
- v27+ `KeyObject.from(nonExtractable)` throws `ERR_INVALID_ARG_VALUE`.
- `createPrivateKey(cryptoKey)` and `createPublicKey(cryptoKey)` already
  threw on v24.19 and v26.13, and they still throw.
- v27+ `crypto.setEngine` is `undefined`, and `tls.createSecureContext({ clientCertEngine })`
  throws `ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED`.
- `keyObject.toCryptoKey(algorithm, extractable, usages)` converts the other
  way, from `KeyObject` to `CryptoKey`.

Removed earlier, but agents still suggest it: `crypto.fips` (property). Use
`getFips()`/`setFips()`.
