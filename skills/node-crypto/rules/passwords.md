# Password hashing and KDFs: Argon2

`crypto.argon2(algorithm, parameters, callback)` and `crypto.argon2Sync()` were
added in v24.7.0 (Stable). They need OpenSSL 3.2+. There is no promise form, so
use `util.promisify(crypto.argon2)`. The async form runs on the libuv
threadpool.

| Parameter | Rule |
| --- | --- |
| `algorithm` | `'argon2d'`, `'argon2i'`, `'argon2id'` (use `argon2id` for passwords) |
| `message` | required; the password |
| `nonce` | required, **≥ 8 bytes** (else `ERR_OUT_OF_RANGE`). Use 16 random bytes |
| `parallelism` | required, 1 … 2²⁴-1 |
| `tagLength` | required, ≥ 4 bytes |
| `memory` | required, **KiB**, ≥ 8 × parallelism; rounded down to a multiple of 4 × parallelism |
| `passes` | required, ≥ 1 |
| `secret` | optional pepper; do not store it with the hash |
| `associatedData` | optional |

None of the numeric parameters has a default. A missing one throws
`ERR_INVALID_ARG_TYPE`. 19456 KiB / 2 passes / parallelism 1 (the OWASP
minimum for argon2id) took about 30 ms per hash on the test machine.

## Storing and verifying

The result is a raw `Buffer`, not a PHC `$argon2id$v=19$…` string. You have to
store the algorithm, the parameters, the nonce, and the tag yourself. To
verify, recompute with the stored values and compare using
`crypto.timingSafeEqual()`. Lengths must match, so check them first. The
`argon2.mjs` example has a complete hash and verify pair.

If you must interoperate with PHC strings made by the `argon2` npm package,
encode or parse that format yourself. Node does not provide it.

## WebCrypto (v24.8.0, Stability 1.1)

```js
const key = await subtle.importKey('raw-secret', pwBytes, 'Argon2id', false, ['deriveBits', 'deriveKey']);
const bits = await subtle.deriveBits({ name: 'Argon2id', nonce, parallelism: 1, memory: 19456, passes: 2 }, key, 256);
```

- The import format must be `'raw-secret'`. `'raw'` rejects with
  `NotSupportedError`. Argon2 keys cannot be exported.
- `Argon2Params` contains `name` (`Argon2d`/`Argon2i`/`Argon2id`), `nonce`,
  `parallelism`, `memory` (KiB), `passes`, and the optional `secretValue`,
  `associatedData`, and `version` (only `19`/`0x13`). The output length is
  the `deriveBits` length argument, in **bits**.
- `SubtleCrypto.supports('importKey', 'Argon2id')` returns `true`; use it to
  fall back to PBKDF2. The docs' "Checking for runtime algorithm support"
  example shows the pattern.
