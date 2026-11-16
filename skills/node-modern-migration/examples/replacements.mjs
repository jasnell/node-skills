// @node-skills {"added":["v24.0.0"]}
// The replacement for each removed API already works on v24 LTS, so migrate unconditionally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import repl from 'node:repl';
import { Readable, Writable, Duplex, Transform, PassThrough } from 'node:stream';
import { mock } from 'node:test';

assert.ok(Buffer.isBuffer(Buffer.allocUnsafeSlow(4)));                   // SlowBuffer
assert.equal(typeof fs.constants.F_OK, 'number');                        // fs.F_OK
assert.equal(typeof fs.promises.constants.R_OK, 'number');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-'));               // rmdir({recursive})
fs.mkdirSync(path.join(dir, 'a', 'b'), { recursive: true });
fs.rmSync(dir, { recursive: true, force: true });
assert.equal(fs.existsSync(dir), false);

const fn = mock.fn();                                                    // assert.CallTracker
fn(1);
assert.equal(fn.mock.callCount(), 1);

assert.equal(typeof crypto.getFips(), 'number');                         // crypto.fips
assert.ok(new zlib.Gzip() instanceof zlib.Gzip);                         // zlib.Gzip()
const r = new repl.REPLServer({ input: new PassThrough(), output: new PassThrough() });
r.close();                                                               // repl.REPLServer()
for (const C of [Readable, Writable, Duplex, Transform, PassThrough]) {  // _stream_*
  assert.equal(typeof C, 'function');
}
assert.equal(crypto.createHash('shake256', { outputLength: 16 }).update('x').digest().length, 16);
const { privateKey } = crypto.generateKeyPairSync('rsa-pss', {          // RSA-PSS options
  modulusLength: 1024, hashAlgorithm: 'sha256', mgf1HashAlgorithm: 'sha256',
});
assert.equal(privateKey.asymmetricKeyDetails.hashAlgorithm, 'sha256');
assert.equal(Error.isError(new TypeError()), true);                      // util.types.isNativeError
assert.equal(new URL('http://a.com:8080/').port, '8080');                // url.parse()
