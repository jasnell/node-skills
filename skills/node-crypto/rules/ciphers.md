# AEAD ciphers

| Cipher | node:crypto | WebCrypto |
| --- | --- | --- |
| `aes-*-ocb` | since v10.10.0; `authTagLength` **required** | `AES-OCB` v24.7.0 (1.1) |
| `chacha20-poly1305` | since v11.2.0; 16-byte tag default | `ChaCha20-Poly1305` v24.7.0 (1.1) |
| `aes-{128,192,256}-siv` | v26.8.0, v24.22.0 | — |
| `aes-{128,192,256}-gcm-siv` (OpenSSL 3.2+) | v26.8.0, v24.22.0 | — |

Feature-detect with `getCiphers().includes('aes-256-gcm-siv')`.
`getCipherInfo()` reports `mode: 'siv'` / `'gcm-siv'`.

## SIV and GCM-SIV rules (from the docs, exercised in `ciphers.mjs`)

- The tag is always 16 bytes.
- AES-SIV keys are **double length**: `aes-128-siv` takes a 32-byte key.
- AES-SIV uses no IV, so pass `null`. If the protocol has a nonce, pass it as
  the **last** `setAAD()` call. Up to 126 AAD inputs are allowed.
- AES-GCM-SIV takes a 12-byte IV and is nonce-misuse resistant.
- Call `update()` exactly once (the whole message), then `final()`. Streaming
  with `write()`/`pipe()` may fail.
- On decrypt, `setAuthTag()` must come **before** `update()`. The same is true
  for CCM. GCM, OCB, and chacha20-poly1305 only need it before `final()`.
- Zero-length plaintext needs OpenSSL 3.5+.

## Provider ciphers (v26.9.0, v24.22.0)

`createCipheriv` also exposes provider ciphers such as SM4-GCM, SM4-CCM,
SM4-XTS, CBC-CTS (option `ctsMode: 'CS1'|'CS2'|'CS3'`), and AES key-wrap
variants (`xtsStandard: 'GB'|'IEEE'` for sm4-xts). These were not exercised
here.

## GCM tag length (DEP0182)

Decrypting with a tag shorter than 16 bytes without `authTagLength` on the
decipher:

- v24: works, emits a DEP0182 warning.
- v26+: throws `ERR_CRYPTO_INVALID_AUTH_TAG` ("Invalid authentication tag length").

Fix: pass the same `authTagLength` to both `createCipheriv` and
`createDecipheriv`.

## WebCrypto

`AES-OCB` and `ChaCha20-Poly1305` take `{ name, iv, additionalData?, tagLength? }`.
The 16-byte tag is appended to the ciphertext. Keys use `'raw-secret'` or
`'jwk'`; `'raw'` is not accepted.
