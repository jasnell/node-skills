// @node-skills {"added":["v24.8.0"]}
// Password hashing with built-in Argon2id (node:crypto and WebCrypto). Needs OpenSSL 3.2+.
import { argon2, argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

// Node returns raw bytes, not a PHC string: store the salt and parameters yourself.
const params = { parallelism: 1, tagLength: 32, memory: 19456, passes: 2 }; // memory is in KiB
async function hashPassword(password) {
  const nonce = randomBytes(16);
  const tag = await promisify(argon2)('argon2id', { ...params, message: password, nonce });
  return { ...params, nonce: nonce.toString('base64'), tag: tag.toString('base64') };
}
async function verifyPassword(password, stored) {
  const { nonce, tag, ...p } = stored;
  const got = await promisify(argon2)('argon2id', { ...p, message: password, nonce: Buffer.from(nonce, 'base64') });
  return timingSafeEqual(got, Buffer.from(tag, 'base64'));
}
const stored = await hashPassword('correct horse');
assert.equal(await verifyPassword('correct horse', stored), true);
assert.equal(await verifyPassword('wrong', stored), false);

// Sync form and validation: nonce must be >= 8 bytes, every numeric param is required.
assert.equal(argon2Sync('argon2id', { ...params, memory: 64, message: 'pw', nonce: randomBytes(8) }).length, 32);
assert.throws(() => argon2Sync('argon2id', { ...params, message: 'pw', nonce: randomBytes(7) }), { code: 'ERR_OUT_OF_RANGE' });
assert.throws(() => argon2Sync('argon2id', { message: 'pw', nonce: randomBytes(16), parallelism: 1, tagLength: 32, memory: 64 }), { code: 'ERR_INVALID_ARG_TYPE' });

// WebCrypto: import with 'raw-secret' (not 'raw'), then deriveBits; length is in bits.
const { subtle } = globalThis.crypto;
const algo = { name: 'Argon2id', nonce: randomBytes(16), parallelism: 1, memory: 64, passes: 1 };
assert.equal(SubtleCrypto.supports('deriveBits', algo, 256), true);
await assert.rejects(subtle.importKey('raw', Buffer.from('pw'), 'Argon2id', false, ['deriveBits']), { name: 'NotSupportedError' });
const key = await subtle.importKey('raw-secret', Buffer.from('pw'), 'Argon2id', false, ['deriveBits']);
assert.equal((await subtle.deriveBits(algo, key, 256)).byteLength, 32);
