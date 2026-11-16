// @node-skills {"added":["v24.0.0"]}
// CryptoKey into node:crypto (DEP0203/DEP0204, EOL in v27) and engine APIs (DEP0183, EOL in v27).
import * as nodeCrypto from 'node:crypto';
const { createHmac, KeyObject, sign, verify } = nodeCrypto;
import assert from 'node:assert/strict';

const major = Number(process.versions.node.split('.')[0]);
process.removeAllListeners('warning');
const { subtle } = globalThis.crypto;

const hmacKey = await subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
if (major >= 27) {
  assert.throws(() => createHmac('sha256', hmacKey), { code: 'ERR_INVALID_ARG_TYPE' });
}
// Portable: convert explicitly. KeyObject.from() needs an extractable CryptoKey from v27.
const ko = KeyObject.from(hmacKey);
assert.equal(createHmac('sha256', ko).update('x').digest().length, 32);

const ed = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const priv = KeyObject.from(ed.privateKey);
const sig = sign(null, Buffer.from('m'), priv);
assert.equal(verify(null, Buffer.from('m'), KeyObject.from(ed.publicKey), sig), true);
// The other direction: KeyObject -> CryptoKey for WebCrypto.
const back = priv.toCryptoKey('Ed25519', false, ['sign']);
assert.equal((await subtle.sign('Ed25519', back, Buffer.from('m'))).byteLength, 64);

const nonExtractable = await subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
if (major >= 27) {
  assert.throws(() => KeyObject.from(nonExtractable), { code: 'ERR_INVALID_ARG_VALUE' });
  assert.equal(nodeCrypto.setEngine, undefined); // crypto.setEngine and ENGINE_METHOD_* are gone
}
