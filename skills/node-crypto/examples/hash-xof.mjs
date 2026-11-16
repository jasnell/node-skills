// @node-skills {"added":["v24.7.0"]}
// One-shot crypto.hash, SHA-3, and XOF output lengths in node:crypto and WebCrypto.
import { hash, createHash, getHashes } from 'node:crypto';
import assert from 'node:assert/strict';

const major = Number(process.versions.node.split('.')[0]);
process.removeAllListeners('warning'); // keep DEP0198 / ExperimentalWarning noise out of the output

// crypto.hash: hex by default; outputLength (bytes) for SHAKE.
assert.equal(hash('sha3-256', 'abc').length, 64);
assert.equal(hash('shake256', 'abc', { outputLength: 16 }).length, 32);
assert.equal(hash('shake256', 'abc', { outputLength: 16, outputEncoding: 'buffer' }).length, 16);
assert.equal(createHash('shake128', { outputLength: 8 }).update('abc').digest().length, 8);

// SHAKE without outputLength: OK on v24, DEP0198 warning on v25/v26, throws from v27.
if (major >= 27) {
  assert.throws(() => hash('shake256', 'abc'), { code: 'ERR_OSSL_EVP_NOT_XOF_OR_INVALID_LENGTH' });
} else {
  assert.equal(hash('shake256', 'abc').length, 64); // old implicit 32-byte default
}

// cSHAKE in node:crypto needs OpenSSL 4.0+ (listed by getHashes when present).
if (getHashes().includes('cshake-128')) {
  assert.equal(hash('cshake-128', 'abc').length, 64); // default 32 bytes
  assert.notEqual(hash('cshake-128', 'abc', { customization: 'Email Signature' }), hash('cshake-128', 'abc'));
}

// WebCrypto: SHA3-*, cSHAKE, TurboSHAKE, KT. XOFs need an object with outputLength in BITS;
// the bare string form is rejected with a TypeError.
const { subtle } = globalThis.crypto;
const data = Buffer.from('abc');
assert.equal((await subtle.digest('SHA3-256', data)).byteLength, 32);
assert.equal((await subtle.digest({ name: 'cSHAKE256', outputLength: 512 }, data)).byteLength, 64);
await assert.rejects(subtle.digest('cSHAKE128', data), TypeError);
assert.equal(SubtleCrypto.supports('digest', 'cSHAKE128'), false);
for (const name of ['TurboSHAKE128', 'KT128']) {
  if (!SubtleCrypto.supports('digest', { name, outputLength: 256 })) continue; // v25.9.0 / v24.18.0+
  assert.equal((await subtle.digest({ name, outputLength: 256 }, data)).byteLength, 32);
  await assert.rejects(subtle.digest(name, data), TypeError);
}
// Non-empty cSHAKE customization/functionName depends on the build: feature-detect.
const custom = { name: 'cSHAKE128', outputLength: 256, customization: Buffer.from('app') };
if (SubtleCrypto.supports('digest', custom)) {
  assert.notDeepEqual(await subtle.digest(custom, data), await subtle.digest({ name: 'cSHAKE128', outputLength: 256 }, data));
} else {
  await assert.rejects(subtle.digest(custom, data), { name: 'NotSupportedError' });
}
