// @node-skills {"added":["v27.0.0-alpha.0.0.0"]}
// End-of-Life in the v27 alpha line (and main). Runtime-deprecated on v26.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
assert.equal(crypto.fips, undefined);                       // DEP0093 -> getFips()/setFips()
assert.equal(typeof crypto.getFips, 'function');
assert.equal(crypto.setEngine, undefined);                  // DEP0183, no replacement
assert.throws(() => zlib.Gzip(), TypeError);                // DEP0184 -> new zlib.Gzip()
for (const m of ['_tls_wrap', '_tls_common']) {             // DEP0192 -> node:tls
  assert.throws(() => require(`node:${m}`), { code: 'ERR_UNKNOWN_BUILTIN_MODULE' });
}
// DEP0198: SHAKE needs an explicit outputLength.
assert.throws(() => crypto.createHash('shake256').update('x').digest());
assert.equal(crypto.createHash('shake256', { outputLength: 32 }).update('x').digest().length, 32);

// DEP0203 / DEP0204: CryptoKey is not accepted by node:crypto; convert with KeyObject.from().
const extractable = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
assert.throws(() => crypto.createHmac('sha256', extractable), { code: 'ERR_INVALID_ARG_TYPE' });
assert.equal(crypto.createHmac('sha256', crypto.KeyObject.from(extractable)).update('x').digest().length, 32);
const locked = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
assert.throws(() => crypto.KeyObject.from(locked), { code: 'ERR_INVALID_ARG_VALUE' });
