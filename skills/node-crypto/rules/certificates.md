# X.509 generation, inspection, and PKCS#12

## crypto.generateX509Certificate[Sync] (v27.0.0, Stability 1.2)

These are not on v24 or v26: they are only on v27+. On older versions use a
checked-in fixture or the `openssl` CLI. The docs' YAML says
`added: v27.0.0-alpha.0.1.0`.

| Option | Notes |
| --- | --- |
| `subject` | Array of RDNs: `[{ name: 'CN', value }]`, or nested arrays for multi-valued RDNs. Names: OID or `CN`, `C`, `L`, `ST`, `O`, `OU`, `serialNumber`, `streetAddress`, `postalCode`, `DC`, `UID`, `E`, `title`, `SN`, `GN` (and long forms). Or DER bytes, e.g. `other.subjectName.raw` |
| `publicKey` | anything `createPublicKey()` accepts |
| `issuer` | an `X509Certificate`; omit for self-signed |
| `serialNumber` | **bigint**, required (`ERR_MISSING_OPTION`), 1n … 2¹⁵⁹-1 |
| `notBefore`, `notAfter` | `Date`, both required, truncated to whole seconds, 1950–9999 |
| `signature` | `{ key, digest }`: `digest` required. Use `null` for Ed25519/ML-DSA (verified) |
| `extensions` | ordered list; **nothing is added implicitly** |
| `csr` + `selectExtensions(requested)` | issue from a PKCS#10 CSR; the callback is required and receives unauthenticated raw extensions |

Extension forms are `basicConstraints` (`ca`, `pathLength`), `keyUsage`
(`usages`), `extendedKeyUsage` (`usages`: `serverAuth`, `clientAuth`, …),
`subjectAltName` (`names: [{ type: 'dns'|'ip'|'email'|'uri', value }]`),
`subjectKeyIdentifier` / `authorityKeyIdentifier` (`value: 'auto'` or bytes),
and `raw` (`oid`, `value`). Each takes an optional `critical`. A `keyUsage`
containing `keyCertSign` requires `basicConstraints: { ca: true }`. Duplicate
OIDs are rejected.

The async form uses a callback (`(err, cert)`) and works with
`util.promisify`. Validation errors are thrown synchronously.

Using the result in TLS: `cert.toString()` (or `cert.toJSON()`) is PEM, and the
key PEM is `privateKey.export({ format: 'pem', type: 'pkcs8' })`. The
`x509-generate.mjs` example builds a CA and a leaf and gets
`authorized === true` on a loopback TLS connection that passes `ca:` the CA PEM.

The function does not validate paths or trust, and the result has no
`issuerCertificate`.

## New X509Certificate getters

| Getter | Added | Shape |
| --- | --- | --- |
| `signatureAlgorithm` | v24.9.0 | e.g. `'ecdsa-with-SHA256'`, `'ML-DSA-65'`, or `undefined` |
| `signatureAlgorithmOid` | v24.9.0 | dotted OID |
| `version` | v27.0.0 | `1`/`2`/`3` |
| `extensions` | v27.0.0 | `[{ oid, critical, value: Buffer }]` raw `extnValue` bytes in order |
| `subjectName`, `issuerName` | v27.0.0 | `{ raw: Buffer (DER Name), rdns: [[{ oid, value }]] }` |
| `tbs` | v27.0.0 | DER `TBSCertificate` bytes |
| `signature` | v27.0.0 | `{ algorithm: { oid, parameters? }, value: Buffer }` |

Each access returns fresh copies. Re-signing a copy:
`{ subject: src.subjectName.raw, extensions: src.extensions.map((e) => ({ type: 'raw', ...e })) }`.

There are also pending (`REPLACEME`) changes on main: `x509.verify()` and
`checkPrivateKey()` now throw on errors that previously returned `false`, and
several getters throw `ERR_CRYPTO_INVALID_X509_CERTIFICATE` on undecodable
input.

## crypto.parsePKCS12(bundle[, options]) (v26.10.0, v24.22.0)

```js
const { privateKey, certificate, additionalCertificates } = parsePKCS12(readFileSync('b.p12'), { passphrase });
```

- `bundle` is DER bytes. `passphrase` defaults to `''`.
- It returns a `KeyObject | null`, an `X509Certificate | null` (the one
  matching the key), and an `X509Certificate[]`. If there is no key, every
  certificate goes in `additionalCertificates`.
- A wrong or missing passphrase throws `ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE`.
- For TLS you can still pass the raw bundle as `pfx` to `tls.createSecureContext`.
  Use `parsePKCS12` when you need the key or certificate objects.
