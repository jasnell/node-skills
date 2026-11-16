// @node-skills {"added":["v24.15.0"]}
// ML-DSA and SLH-DSA signatures, context strings, and raw key formats. Needs OpenSSL 3.5+.
import { generateKeyPairSync, sign, verify, createSign, createPrivateKey, createPublicKey } from 'node:crypto';
import assert from 'node:assert/strict';

if (!SubtleCrypto.supports('generateKey', 'ML-DSA-65')) {
  console.log(`skip: ML-DSA needs OpenSSL 3.5+ (have ${process.versions.openssl})`);
  process.exit(77);
}
const msg = Buffer.from('release-1.2.3.tgz');

// algorithm must be null/undefined: the key type picks the scheme.
const ml = generateKeyPairSync('ml-dsa-65');
const sig = sign(null, msg, ml.privateKey);
assert.equal(sig.length, 3309);
assert.equal(verify(null, msg, ml.publicKey, sig), true);
assert.throws(() => sign('sha256', msg, ml.privateKey));
assert.throws(() => createSign('sha256').update(msg).sign(ml.privateKey), { code: 'ERR_CRYPTO_UNSUPPORTED_OPERATION' });

// Context strings: a signature made with a context only verifies with the same context.
const ctx = Buffer.from('my-app/v1');
const sigCtx = sign(null, msg, { key: ml.privateKey, context: ctx });
assert.equal(verify(null, msg, { key: ml.publicKey, context: ctx }, sigCtx), true);
assert.equal(verify(null, msg, ml.publicKey, sigCtx), false);

// SLH-DSA (stateless hash-based) is node:crypto only; signatures are large.
const slh = generateKeyPairSync('slh-dsa-sha2-128f');
const slhSig = sign(null, msg, slh.privateKey);
assert.equal(slhSig.length, 17088);
assert.equal(verify(null, msg, slh.publicKey, slhSig), true);
assert.equal(SubtleCrypto.supports('generateKey', 'SLH-DSA-SHA2-128f'), false);

// Raw formats: ML-* private keys are a 32/64-byte seed ('raw-seed'), not 'raw-private'.
const seed = ml.privateKey.export({ format: 'raw-seed' });
assert.equal(seed.length, 32);
assert.throws(() => ml.privateKey.export({ format: 'raw-private' }), { code: 'ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS' });
const restored = createPrivateKey({ key: seed, format: 'raw-seed', asymmetricKeyType: 'ml-dsa-65' });
assert.equal(verify(null, msg, ml.publicKey, sign(null, msg, restored)), true);
const pub = createPublicKey({ key: ml.publicKey.export({ format: 'raw-public' }), format: 'raw-public', asymmetricKeyType: 'ml-dsa-65' });
assert.equal(verify(null, msg, pub, sig), true);
// EC and Ed25519 use 'raw-public' / 'raw-private'; EC also needs namedCurve on import.
const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ecRaw = ec.publicKey.export({ format: 'raw-public' });
assert.equal(ecRaw.length, 65);
assert.equal(createPublicKey({ key: ecRaw, format: 'raw-public', asymmetricKeyType: 'ec', namedCurve: 'P-256' }).asymmetricKeyType, 'ec');
