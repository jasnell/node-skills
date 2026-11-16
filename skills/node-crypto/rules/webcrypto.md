# WebCrypto: modern algorithms and SubtleCrypto.supports

The "Modern Algorithms in the Web Cryptography API" features are Stability
**1.1** even though WebCrypto itself is Stable. Many of them emit an
`ExperimentalWarning` on first use. The set of warning algorithms differs by
version: v24.19 warned for ML-KEM/ML-DSA/ChaCha20/supports/getPublicKey, and
main did not warn for those.

## SubtleCrypto.supports(operation, algorithm[, lengthOrAdditionalAlgorithm]) (v24.7.0)

- It is a static and **synchronous** method that returns a boolean.
- It normalizes the **full** parameter dictionary, so required members
  matter: `supports('encrypt', 'ChaCha20-Poly1305')` is `false`, and
  `supports('encrypt', { name: 'ChaCha20-Poly1305', iv: new Uint8Array(12) })`
  is `true`. An 8-byte iv gives `false`.
- The third argument is the length for `deriveBits`, or the derived, wrapped,
  or encapsulated key algorithm for `deriveKey`, `wrapKey`/`unwrapKey`, and
  `encapsulateKey`/`decapsulateKey`.
- Operations: encrypt, decrypt, sign, verify, digest, generateKey,
  deriveKey, deriveBits, importKey, exportKey, getPublicKey, wrapKey,
  unwrapKey, encapsulateBits, encapsulateKey, decapsulateBits,
  decapsulateKey.
- It is the right gate for OpenSSL-dependent algorithms (ML-*, hybrid KEM,
  cSHAKE customization).

## Algorithm matrix (docs, webcrypto.md "Algorithm support")

| Operation | New algorithms |
| --- | --- |
| generateKey/importKey/exportKey | AES-OCB, ChaCha20-Poly1305, KMAC128/256, ML-DSA-44/65/87, ML-KEM-512/768/1024, MLKEM768-P256, MLKEM768-X25519, MLKEM1024-P384 |
| importKey only | Argon2d/i/id (`raw-secret`) |
| getPublicKey | any asymmetric algorithm (ECDH, ECDSA, Ed*, X*, RSA*, ML-*) |
| encrypt/decrypt, wrapKey/unwrapKey | AES-OCB, ChaCha20-Poly1305 |
| sign/verify | KMAC128/256, ML-DSA-* (`ContextParams.context`) |
| deriveBits/deriveKey | Argon2d/i/id |
| encapsulate*/decapsulate* | ML-KEM-*, hybrid MLKEM* |
| digest | SHA3-256/384/512, cSHAKE128/256, TurboSHAKE128/256, KT128/256 |

SLH-DSA, AES-SIV, and AES-GCM-SIV are **not** in WebCrypto. Use `node:crypto`.

## Key formats

- `'raw-secret'` is for AES-OCB, ChaCha20-Poly1305, KMAC, and Argon2.
  `'raw'` is rejected for them, though it still works for AES-GCM/HMAC.
- `'raw-public'` and `'raw-seed'` are for ML-DSA/ML-KEM. Hybrid KEMs use
  `jwk`, `raw-public`, or `raw-seed` only.
- `'raw-public'` also works for EC and Ed/X curves.

## Versions

| Item | Added |
| --- | --- |
| SHA-3, SHAKE→cSHAKE, ML-DSA, ML-KEM, AES-OCB, ChaCha20-Poly1305, `supports`, `getPublicKey`, encapsulate/decapsulate | v24.7.0 |
| Argon2, KMAC, non-empty ML-DSA context | v24.8.0 |
| `outputLength` rename (cSHAKE, KMAC) | v25.9.0, v24.15.0 |
| TurboSHAKE, KangarooTwelve, ML-KEM JWK | v25.9.0, v24.18.0 |
| cSHAKE named variants and non-empty customization | v26.4.0, v24.19.0 |
| Hybrid KEMs | v26.10.0, v24.22.0 |
