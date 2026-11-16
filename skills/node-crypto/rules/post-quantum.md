# Post-quantum crypto: ML-KEM, ML-DSA, SLH-DSA, hybrid KEM

All of these need Node.js built against **OpenSSL 3.5+** (`process.versions.openssl`).
v24.19.0 ships 3.5.7, v26.13.0 ships 3.5.9, and main ships 4.1.0. Feature-detect
with `SubtleCrypto.supports('generateKey', 'ML-KEM-768')` or by wrapping
`generateKeyPairSync()` in try/catch.

## Availability

| Feature | node:crypto | WebCrypto |
| --- | --- | --- |
| ML-DSA (`ml-dsa-44/65/87`) | v24.6.0 (Stable) | v24.7.0 (1.1) |
| ML-KEM (`ml-kem-512/768/1024`) | v24.7.0 (Stable) | v24.7.0 (1.1) |
| SLH-DSA (12 `slh-dsa-{sha2,shake}-{128,192,256}{f,s}` types) | v24.8.0 (Stable) | not available |
| `context` for ML-DSA, Ed448, SLH-DSA | v24.8.0 | `ContextParams` v24.7.0, non-empty v24.8.0 |
| `context` for Ed25519 (Ed25519ctx, OpenSSL 3.2+) | v26.1.0, v24.16.0 | — |
| Hybrid KEM `MLKEM768-P256`, `MLKEM768-X25519`, `MLKEM1024-P384` | not available | v26.10.0, v24.22.0 (1.1) |
| JWK for ML-KEM and SLH-DSA | v26.1.0, v24.18.0 | ML-KEM JWK v26.1.0, v24.18.0 |

## node:crypto KEM

```js
const { publicKey, privateKey } = generateKeyPairSync('ml-kem-768');
const { sharedKey, ciphertext } = encapsulate(publicKey);   // sync when no callback
const same = decapsulate(privateKey, ciphertext);            // Buffer, equal to sharedKey
encapsulate(publicKey, (err, { sharedKey, ciphertext }) => {}); // runs on the libuv threadpool
```

- `encapsulate` accepts anything `createPublicKey()` accepts (PEM, DER object,
  JWK, KeyObject). `decapsulate` accepts anything `createPrivateKey()` accepts.
- The same functions do RSA-SVE (`rsa`) and DHKEM (`ec` P-256/384/521,
  `x25519`, `x448`). DHKEM needs OpenSSL 3.2+.
- Measured sizes for ML-KEM-768: shared key 32 bytes, ciphertext 1088 bytes,
  raw public key 1184 bytes, seed 64 bytes.

## Signatures

```js
const { publicKey, privateKey } = generateKeyPairSync('ml-dsa-65');
const sig = sign(null, data, privateKey);                  // 3309 bytes
verify(null, data, publicKey, sig);
sign(null, data, { key: privateKey, context: Buffer.from('app/v1') }); // optional context
```

- `algorithm` must be `null`/`undefined`. `sign('sha256', …)` throws
  `ERR_OSSL_INVALID_DIGEST`, and `createSign()` throws
  `ERR_CRYPTO_UNSUPPORTED_OPERATION`. Use the one-shot `crypto.sign`/`verify`.
- A signature made with a context verifies only with the same context.
- `slh-dsa-sha2-128f` signatures are 17088 bytes. The `s` variants are smaller
  and much slower to sign.

## Key formats

From the docs' "Asymmetric key types" list:

- ML-DSA and ML-KEM support `pem`, `der`, `jwk`, `raw-public`, and
  `raw-seed`. They have **no** `raw-private` format: it throws
  `ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS`. Seeds are 32 bytes for ML-DSA and
  64 bytes for ML-KEM.
- SLH-DSA, EC, Ed25519/Ed448, and X25519/X448 support `raw-public` and
  `raw-private`.
- Importing a raw key needs `asymmetricKeyType`, plus `namedCurve` for `ec`:
  `createPrivateKey({ key: seed, format: 'raw-seed', asymmetricKeyType: 'ml-kem-768' })`.
- v26.0.0+: `'pkcs8'` export of ML-KEM/ML-DSA keys is **seed-only** by default
  when a seed is available. ML-KEM-768 PKCS#8 DER measured 86 bytes on
  v26.13/main but 2498 bytes on v24.19.
- WebCrypto `importKey('pkcs8', …)` of ML-DSA/ML-KEM keys **without** a seed
  is no longer supported (v24.15.0).
- JWK for ML-DSA uses `kty: 'AKP'`.

## WebCrypto

```js
const kp = await subtle.generateKey('ML-KEM-768', false, ['encapsulateKey', 'decapsulateKey']);
const { ciphertext, sharedKey } = await subtle.encapsulateKey('ML-KEM-768', kp.publicKey, 'AES-GCM', false, ['encrypt']);
const key = await subtle.decapsulateKey('ML-KEM-768', kp.privateKey, ciphertext, 'AES-GCM', false, ['decrypt']);
// encapsulateBits/decapsulateBits return ArrayBuffers instead of CryptoKeys
```

- The key usages are `encapsulateKey`, `decapsulateKey`, `encapsulateBits`,
  and `decapsulateBits`. They are separate usages.
- Hybrid KEMs use the same four methods. They import and export only as
  `jwk`, `raw-public`, and `raw-seed` (no spki/pkcs8). `MLKEM768-X25519` gave
  a 1120-byte ciphertext and a 32-byte shared key.
- `subtle.getPublicKey(privateKey, usages)` derives the public key. It worked
  with non-extractable private keys, and the result is always extractable.
