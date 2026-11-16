// @node-skills {"added":["v26.9.0","v24.22.0"]}
// crypto.createMac / getMacs (Stability 1.2): HMAC, KMAC, CMAC through OpenSSL EVP_MAC.
import { createMac, createHmac, getMacs, randomBytes, timingSafeEqual } from 'node:crypto';
import assert from 'node:assert/strict';

const macs = getMacs(); // lowercase names and aliases, e.g. 'hmac', 'kmac128', 'kmac-128', 'cmac'
assert.ok(macs.includes('hmac') && macs.includes('kmac256'));

const key = randomBytes(32);
// HMAC needs options.digest; result matches createHmac.
const a = createMac('HMAC', key, { digest: 'sha256' }).update('msg').final();
assert.deepEqual(a, createHmac('sha256', key).update('msg').digest());
assert.throws(() => createMac('HMAC', key), { code: 'ERR_INVALID_ARG_VALUE' });

// KMAC: optional customization; outputLength is in BYTES here (WebCrypto uses bits).
const k1 = createMac('KMAC256', key, { customization: Buffer.from('app'), outputLength: 32 }).update('msg').final();
assert.equal(k1.length, 32);
assert.equal(createMac('KMAC256', key).update('msg').final().length, 64); // provider default
const k2 = createMac('kmac256', key, { customization: Buffer.from('app'), outputLength: 32 }).update('msg').final('hex');
assert.ok(timingSafeEqual(k1, Buffer.from(k2, 'hex')));

// CMAC needs a CBC cipher name. Unsupported options throw instead of being ignored.
assert.equal(createMac('CMAC', randomBytes(16), { cipher: 'AES-128-CBC' }).update('m').final().length, 16);
assert.throws(() => createMac('HMAC', key, { digest: 'sha256', salt: Buffer.alloc(4) }), { code: 'ERR_INVALID_ARG_VALUE' });

// Single use: after final(), update()/final() throw.
const m = createMac('HMAC', key, { digest: 'sha256' });
m.final();
assert.throws(() => m.update('x'), { code: 'ERR_CRYPTO_MAC_FINALIZED' });

// Mac is a Transform stream: write data, read one tag.
const s = createMac('HMAC', key, { digest: 'sha256' });
s.end('msg');
const chunks = [];
for await (const c of s) chunks.push(c);
assert.deepEqual(Buffer.concat(chunks), a);
