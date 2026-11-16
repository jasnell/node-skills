# Hashing, XOFs, KMAC, and createMac

## crypto.hash (Stable since v25.5.0, v24.13.1)

`crypto.hash(algorithm, data[, options])` is a one-shot digest. It returns hex
by default. `options` may be an encoding string or an object with
`outputEncoding` (`'buffer'` for a Buffer) and `outputLength` (bytes, for XOFs;
v24.4.0). The docs recommend it for inputs of 5 MB or less; use `createHash()`
for streams.

## SHAKE and other XOFs: outputLength (DEP0198)

| Version | `hash('shake256', data)` without `outputLength` |
| --- | --- |
| v24 | works, using the implicit default (32 bytes for shake256, 16 for shake128). Warns only with `--pending-deprecation` |
| v25, v26 | works, emits `DEP0198` DeprecationWarning |
| v27+ | **throws** `ERR_OSSL_EVP_NOT_XOF_OR_INVALID_LENGTH` (observed on main with OpenSSL 4.1) |

Always pass `{ outputLength }`, which is in bytes. The same rule applies to
`createHash('shake128', { outputLength })`.

## Provider hashes and cSHAKE (v26.9.0, v24.22.0)

`getHashes()`, `hash()`, and `createHash()` now include names exposed by OpenSSL
providers (for example `shake-128`, `cshake-128`). cSHAKE in `node:crypto`
(`cshake-128`, `cshake-256`, with default outputs of 32 and 64 bytes) needs
**OpenSSL 4.0+**. It was absent on v26.13.0 (OpenSSL 3.5) and present on main.
`functionName` and `customization` options apply to cSHAKE only. Strings are
UTF-8 with no NUL bytes allowed, and the built-in `functionName` values are
`''`, `'KMAC'`, `'TupleHash'`, and `'ParallelHash'`. Feature-detect with
`getHashes().includes('cshake-128')`.

TurboSHAKE and KangarooTwelve are **WebCrypto only**; they were not in
`getHashes()` on any tested build.

## WebCrypto digests (Stability 1.1)

| Algorithm | Added | Params |
| --- | --- | --- |
| `SHA3-256/384/512` | v24.7.0 | string is fine |
| `cSHAKE128/256` | v24.7.0; `outputLength` v25.9.0, v24.15.0 | `{ name, outputLength, functionName?, customization? }` |
| `TurboSHAKE128/256` | v25.9.0, v24.18.0 | `{ name, outputLength, domainSeparation? }` (0x01–0x7f, default 0x1f) |
| `KT128/KT256` | v25.9.0, v24.18.0 | `{ name, outputLength, customization? }` (≤ 512 bytes) |

- `outputLength` is in **bits** and required. The bare string form
  (`digest('cSHAKE128', data)`) rejects with a `TypeError`, and
  `SubtleCrypto.supports('digest', 'cSHAKE128')` is `false`.
- The member was renamed from `length` to `outputLength` in v25.9.0 and
  v24.15.0. `{ length }` is now rejected.
- Non-empty cSHAKE `customization`/`functionName`: the docs say OpenSSL 4.0+.
  In tests, main (4.1) accepted it, v26.13.0 (3.5.9) rejected it with
  `NotSupportedError`, and v24.19.0 (3.5.7) accepted it. Feature-detect with
  `SubtleCrypto.supports('digest', { name: 'cSHAKE128', outputLength: 256, customization })`.

## KMAC in WebCrypto (v24.8.0, Stability 1.1)

```js
const key = await subtle.generateKey({ name: 'KMAC256' }, false, ['sign', 'verify']);
const tag = await subtle.sign({ name: 'KMAC256', outputLength: 256, customization }, key, data);
```

- The algorithm member is `name`; the docs' heading says `kmacParams.algorithm`.
  `outputLength` (bits, multiple of 8) is required, and omitting it is a
  `TypeError`. It was renamed from `length` in v25.9.0 and v24.15.0.
- Keys import and export as `raw-secret` or `jwk`. The generated default
  length is 128 bits for KMAC128.

## crypto.createMac / getMacs (v26.9.0, v24.22.0, Stability 1.2)

`createMac(algorithm, key[, options])` returns a `Mac`, a Transform stream
with `update()` and `final([encoding])`. It wraps OpenSSL EVP_MAC.

| MAC | Required options | Optional |
| --- | --- | --- |
| `HMAC` | `digest` (else `ERR_INVALID_ARG_VALUE`) | — |
| `CMAC` | `cipher` (CBC, e.g. `'AES-128-CBC'`) | — |
| `GMAC` | `cipher` (GCM), non-empty `iv` | — |
| `KMAC128`/`KMAC256` | — | `customization`, `outputLength` |
| BLAKE2 MAC | — | `customization`, `salt`, `outputLength` |
| `Poly1305` | — | — (one message per key) |
| `SipHash` | — | `outputLength` |

- Here `outputLength` is in **bytes**. The KMAC256 default was 64 bytes.
- An option the selected MAC does not support **throws**; it is not silently
  ignored.
- A `Mac` is single-use. After `final()` or `end()`, further calls throw
  `ERR_CRYPTO_MAC_FINALIZED`. Do not call both `end()` and `final()`.
- `getMacs()` returns sorted lowercase names and aliases (`hmac`, `kmac128`,
  `kmac-128`, `cmac`, `gmac`, `poly1305`, `siphash`, `blake2bmac`, …). Names
  are case-insensitive in `createMac`.
- The key is bytes or a secret `KeyObject`. Compare tags with `timingSafeEqual`.
