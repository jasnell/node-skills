// @node-skills {"added":["v24.8.0"]}
// WebCrypto "modern algorithms": SubtleCrypto.supports, KMAC, ChaCha20-Poly1305, AES-OCB, getPublicKey.
import assert from 'node:assert/strict';

process.removeAllListeners('warning'); // these algorithms emit ExperimentalWarning on first use
const { subtle } = globalThis.crypto;
const data = Buffer.from('payload');

// supports() is synchronous and validates the full params, not only the name:
// a bare name is false for operations whose params have required members (iv here).
assert.equal(SubtleCrypto.supports('generateKey', 'ChaCha20-Poly1305'), true);
assert.equal(SubtleCrypto.supports('encrypt', 'ChaCha20-Poly1305'), false);
assert.equal(SubtleCrypto.supports('encrypt', { name: 'ChaCha20-Poly1305', iv: new Uint8Array(12) }), true);
assert.equal(SubtleCrypto.supports('encrypt', { name: 'ChaCha20-Poly1305', iv: new Uint8Array(8) }), false);
assert.equal(SubtleCrypto.supports('sign', 'NoSuchAlg'), false);

// KMAC: the params member is `name` and outputLength (bits) is required.
const kmacKey = await subtle.generateKey({ name: 'KMAC256' }, false, ['sign', 'verify']);
const kmac = { name: 'KMAC256', outputLength: 256, customization: Buffer.from('my-app') };
const tag = await subtle.sign(kmac, kmacKey, data);
assert.equal(tag.byteLength, 32);
assert.equal(await subtle.verify(kmac, kmacKey, tag, data), true);
await assert.rejects(subtle.sign({ name: 'KMAC256' }, kmacKey, data), TypeError);

// ChaCha20-Poly1305 and AES-OCB: 12-byte iv, 16-byte tag appended to the ciphertext.
for (const alg of [{ name: 'ChaCha20-Poly1305' }, { name: 'AES-OCB', length: 256 }]) {
  const key = await subtle.generateKey(alg, false, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: alg.name, iv }, key, data);
  assert.equal(ct.byteLength, data.length + 16);
  assert.deepEqual(Buffer.from(await subtle.decrypt({ name: alg.name, iv }, key, ct)), data);
}
// Secret keys for the new algorithms use 'raw-secret' (not 'raw') and 'jwk'.
const chachaKey = await subtle.generateKey('ChaCha20-Poly1305', true, ['encrypt']);
assert.equal((await subtle.exportKey('raw-secret', chachaKey)).byteLength, 32);
await assert.rejects(subtle.exportKey('raw', chachaKey));

// getPublicKey derives the public key from a private CryptoKey (works for any asymmetric alg).
const { privateKey } = await subtle.generateKey('Ed25519', false, ['sign', 'verify']);
const pub = await subtle.getPublicKey(privateKey, ['verify']);
assert.equal(pub.type, 'public');
const sig = await subtle.sign('Ed25519', privateKey, data);
assert.equal(await subtle.verify('Ed25519', pub, sig, data), true);

// ML-DSA in WebCrypto, with an optional context (needs OpenSSL 3.5+).
if (SubtleCrypto.supports('generateKey', 'ML-DSA-44')) {
  const kp = await subtle.generateKey('ML-DSA-44', false, ['sign', 'verify']);
  const p = { name: 'ML-DSA-44', context: Buffer.from('ctx') };
  assert.equal(await subtle.verify(p, kp.publicKey, await subtle.sign(p, kp.privateKey, data), data), true);
}
