// @node-skills {"added":["v24.0.0"]}
// AEAD ciphers in node:crypto: AES-OCB, ChaCha20-Poly1305, AES-SIV, AES-GCM-SIV, and GCM tag-length rules.
import { createCipheriv, createDecipheriv, randomBytes, getCiphers } from 'node:crypto';
import assert from 'node:assert/strict';

const major = Number(process.versions.node.split('.')[0]);
process.removeAllListeners('warning');

function seal(alg, key, iv, pt, opts) {
  const c = createCipheriv(alg, key, iv, opts);
  const ct = Buffer.concat([c.update(pt), c.final()]);
  return { ct, tag: c.getAuthTag() };
}
function open(alg, key, iv, { ct, tag }, opts) {
  const d = createDecipheriv(alg, key, iv, opts);
  d.setAuthTag(tag); // before update(): required for SIV/GCM-SIV/CCM, fine for others
  return Buffer.concat([d.update(ct), d.final()]).toString();
}

// OCB requires authTagLength; chacha20-poly1305 defaults to a 16-byte tag.
assert.throws(() => createCipheriv('aes-256-ocb', randomBytes(32), randomBytes(12)), { code: 'ERR_CRYPTO_INVALID_AUTH_TAG' });
let k = randomBytes(32), iv = randomBytes(12);
assert.equal(open('aes-256-ocb', k, iv, seal('aes-256-ocb', k, iv, 'hi', { authTagLength: 16 }), { authTagLength: 16 }), 'hi');
assert.equal(open('chacha20-poly1305', k, iv, seal('chacha20-poly1305', k, iv, 'hi')), 'hi');

// SIV / GCM-SIV: v26.8.0+ / v24.22.0+ (feature-detect with getCiphers).
if (getCiphers().includes('aes-128-siv')) {
  // AES-SIV: double-length key, no IV (null); a nonce, if any, goes in as the last setAAD().
  k = randomBytes(32);
  const sealed = seal('aes-128-siv', k, null, 'hi');
  assert.equal(sealed.tag.length, 16);
  assert.equal(open('aes-128-siv', k, null, sealed), 'hi');
  // AES-GCM-SIV: nonce-misuse resistant; 12-byte IV, 16-byte tag only.
  k = randomBytes(32); iv = randomBytes(12);
  assert.equal(open('aes-256-gcm-siv', k, iv, seal('aes-256-gcm-siv', k, iv, 'hi')), 'hi');
}

// GCM: a truncated tag is rejected unless decipher sets authTagLength (DEP0182 EOL in v26).
k = randomBytes(16); iv = randomBytes(12);
const full = seal('aes-128-gcm', k, iv, 'hi');
const short = { ct: full.ct, tag: full.tag.subarray(0, 8) };
if (major >= 26) {
  assert.throws(() => open('aes-128-gcm', k, iv, short), { code: 'ERR_CRYPTO_INVALID_AUTH_TAG' });
}
const s8 = seal('aes-128-gcm', k, iv, 'hi', { authTagLength: 8 });
assert.equal(open('aes-128-gcm', k, iv, s8, { authTagLength: 8 }), 'hi');
