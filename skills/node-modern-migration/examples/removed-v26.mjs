// @node-skills {"added":["v26.0.0"]}
// End-of-Life in v26.0.0.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
// DEP0193 / DEP0125: internal stream modules are gone; use node:stream.
for (const m of ['_stream_readable', '_stream_writable', '_stream_duplex', '_stream_transform',
  '_stream_passthrough', '_stream_wrap']) {
  assert.throws(() => require(`node:${m}`), { code: 'ERR_UNKNOWN_BUILTIN_MODULE' }, m);
}

// DEP0063: writeHeader() -> writeHead().
assert.equal(http.ServerResponse.prototype.writeHeader, undefined);
assert.equal(typeof http.ServerResponse.prototype.writeHead, 'function');

// DEP0182: short GCM tags need authTagLength on the decipher.
const key = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const c = crypto.createCipheriv('aes-128-gcm', key, iv, { authTagLength: 8 });
const ct = Buffer.concat([c.update('hi'), c.final()]);
const tag = c.getAuthTag();
assert.throws(() => crypto.createDecipheriv('aes-128-gcm', key, iv).setAuthTag(tag),
  { code: 'ERR_CRYPTO_INVALID_AUTH_TAG' });
const d = crypto.createDecipheriv('aes-128-gcm', key, iv, { authTagLength: 8 });
d.setAuthTag(tag);
assert.equal(Buffer.concat([d.update(ct), d.final()]).toString(), 'hi');
