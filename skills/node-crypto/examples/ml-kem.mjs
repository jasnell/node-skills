// @node-skills {"added":["v24.7.0"]}
// Post-quantum key exchange with ML-KEM (FIPS 203). Needs OpenSSL 3.5+.
import { generateKeyPairSync, encapsulate, decapsulate } from 'node:crypto';
import assert from 'node:assert/strict';

if (!SubtleCrypto.supports('generateKey', 'ML-KEM-768')) {
  console.log(`skip: ML-KEM needs OpenSSL 3.5+ (have ${process.versions.openssl})`);
  process.exit(77);
}

// node:crypto: the receiver publishes a public key; the sender encapsulates.
const { publicKey, privateKey } = generateKeyPairSync('ml-kem-768');
const { sharedKey, ciphertext } = encapsulate(publicKey); // sender keeps sharedKey, sends ciphertext
assert.equal(sharedKey.length, 32);
assert.equal(ciphertext.length, 1088);
assert.deepEqual(decapsulate(privateKey, ciphertext), sharedKey); // receiver recovers it
// PEM/DER inputs are accepted directly, like createPublicKey/createPrivateKey.
const pem = publicKey.export({ format: 'pem', type: 'spki' });
const again = encapsulate(pem);
assert.deepEqual(decapsulate(privateKey, again.ciphertext), again.sharedKey);
// The same API does DHKEM for x25519/x448/ec keys (OpenSSL 3.2+).
assert.equal(encapsulate(generateKeyPairSync('x25519').publicKey).sharedKey.length, 32);

// WebCrypto: encapsulateKey yields a ready-to-use CryptoKey.
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey('ML-KEM-768', false, ['encapsulateKey', 'decapsulateKey']);
const enc = await subtle.encapsulateKey('ML-KEM-768', kp.publicKey, 'AES-GCM', false, ['encrypt']);
const dec = await subtle.decapsulateKey('ML-KEM-768', kp.privateKey, enc.ciphertext, 'AES-GCM', false, ['decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, enc.sharedKey, Buffer.from('hi'));
assert.equal(Buffer.from(await subtle.decrypt({ name: 'AES-GCM', iv }, dec, ct)).toString(), 'hi');

// Hybrid KEMs (WebCrypto only): v26.10.0+ / v24.22.0+.
if (SubtleCrypto.supports('generateKey', 'MLKEM768-X25519')) {
  const h = await subtle.generateKey('MLKEM768-X25519', false, ['encapsulateBits', 'decapsulateBits']);
  const e = await subtle.encapsulateBits('MLKEM768-X25519', h.publicKey);
  const s = await subtle.decapsulateBits('MLKEM768-X25519', h.privateKey, e.ciphertext);
  assert.deepEqual(Buffer.from(s), Buffer.from(e.sharedKey));
  assert.equal(e.ciphertext.byteLength, 1120);
}
