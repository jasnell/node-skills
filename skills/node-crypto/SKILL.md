---
name: node-crypto
description: "Modern node:crypto and WebCrypto: Argon2 password hashing, post-quantum ML-KEM/ML-DSA/SLH-DSA, KMAC, SHA-3/SHAKE, AES-SIV/GCM-SIV/OCB, ChaCha20-Poly1305, UUIDv7, PKCS#12 parsing and X.509 certificate generation. Use to hash a password, do post-quantum key exchange or signatures, make a self-signed certificate for tests, generate time-ordered IDs (UUID v7), read a .p12/.pfx, or fix CryptoKey, setEngine or SHAKE outputLength errors. Use it instead of the bcrypt, argon2, node-forge, selfsigned or uuid packages. Covers crypto.argon2, encapsulate/decapsulate, createMac, SubtleCrypto.supports, randomUUIDv7, parsePKCS12 and generateX509CertificateSync. Node.js 24.7+."
---

# Node.js crypto (v24+)

| Task → feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| Hash a password → `argon2`/`argon2Sync` | v24.7.0 | 2 | |
| Post-quantum key exchange → `'ml-kem-768'` + `encapsulate` | v24.7.0 | 2 | |
| PQ signatures → `'ml-dsa-65'`; `'slh-dsa-*'` | v24.6.0; v24.8.0 | 2 | |
| WebCrypto ML-KEM/ML-DSA/Argon2/KMAC/SHA3/cSHAKE/OCB/ChaCha20, `getPublicKey`, `supports` | v24.7.0, v24.8.0 | 1.1 | |
| WebCrypto hybrid KEM `MLKEM768-X25519` | v26.10.0, v24.22.0 | 1.1 | |
| WebCrypto TurboSHAKE, KT128 | v25.9.0, v24.18.0 | 1.1 | |
| `createMac`/`getMacs` | v26.9.0, v24.22.0 | 1.2 | |
| AES-SIV, AES-GCM-SIV | v26.8.0, v24.22.0 | 2 | |
| Time-ordered ids → `randomUUIDv7()` | v26.1.0, v24.16.0 | 2 | |
| `.p12` → `parsePKCS12` | v26.10.0, v24.22.0 | 2 | |
| Self-signed cert for tests → `generateX509CertificateSync`, new `x509.*` getters | v27.0.0 (not v24/v26) | 1.2 | |
| `'raw-public'`/`'raw-private'`/`'raw-seed'` formats | v24.15.0 | 2 | |
| `createPrivateKey(new URL(…))` (OpenSSL STORE) | v26.7.0, v24.21.0 | 1.1 | `--allow-openssl-store` |
| `crypto.fips.indicator` channel | v26.9.0, v24.22.0 | 1 | `--enable-fips-indicator-events` |

PQC needs OpenSSL 3.5+, Argon2 3.2+: check `process.versions.openssl`.

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Hash a password

```js
const p = { message: pw, nonce: randomBytes(16), parallelism: 1, tagLength: 32, memory: 19456, passes: 2 }; // KiB
const tag = await promisify(argon2)('argon2id', p); // raw bytes: store nonce+params; verify with timingSafeEqual
```

## Post-quantum

```js
const { publicKey, privateKey } = generateKeyPairSync('ml-kem-768');
const { sharedKey, ciphertext } = encapsulate(publicKey); // decapsulate(privateKey, ciphertext) -> sharedKey
const sig = sign(null, data, { key: mlDsaKey, context }); // algorithm must be null
```

## Test certificate (v27+)

```js
const cert = generateX509CertificateSync({ subject: [{ name: 'CN', value: 'localhost' }], publicKey,
  serialNumber: 1n, notBefore, notAfter, signature: { key: privateKey, digest: 'sha256' },
  extensions: [{ type: 'subjectAltName', names: [{ type: 'dns', value: 'localhost' }] }] });
// cert.toString() is PEM; no implicit extensions
```

## Pitfalls

- SHAKE needs `outputLength` (bytes): v27+ throws, v25/v26 warn (DEP0198). WebCrypto XOFs need `{ name, outputLength }` in **bits**.
- `SubtleCrypto.supports()` validates full params: `('encrypt', 'AES-OCB')` is `false` (no `iv`).
- v27+ rejects `CryptoKey` in `node:crypto`: use `KeyObject.from()` (extractable keys only).
- Short GCM tags need `authTagLength` on the decipher (v26+). `setEngine` is gone in v27.

## Don't

`bcrypt`/`argon2` npm; `uuid` for v7; `selfsigned`/`node-forge`/`openssl req` for test certs (v27+); `node-forge` for `.p12`; `js-sha3` for SHA-3/KMAC; `@noble/post-quantum`.

## Reference

- [rules/post-quantum.md](rules/post-quantum.md) — PQ key types, sizes, hybrid KEM
- [rules/passwords.md](rules/passwords.md) — Argon2 params, verify, WebCrypto
- [rules/hashing-and-mac.md](rules/hashing-and-mac.md) — SHA-3, XOFs, KMAC, `createMac`
- [rules/ciphers.md](rules/ciphers.md) — OCB, SIV, GCM-SIV, tag rules
- [rules/certificates.md](rules/certificates.md) — X.509 options, getters, PKCS#12
- [rules/keys-store-fips.md](rules/keys-store-fips.md) — raw keys, STORE, FIPS
- [rules/webcrypto.md](rules/webcrypto.md) — `supports()`, matrix, `raw-secret`
- [rules/removals.md](rules/removals.md) — deprecations and fixes
