// @node-skills {"added":["v25.0.0"]}
// End-of-Life in v25.0.0: these were runtime-deprecated (warn) on v24 and are gone now.
import assert from 'node:assert/strict';
import buffer from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns';
import url from 'node:url';
import repl from 'node:repl';
import { PassThrough } from 'node:stream';

assert.equal(buffer.SlowBuffer, undefined);                 // DEP0030 -> Buffer.allocUnsafeSlow
assert.equal(fs.F_OK, undefined);                           // DEP0176 -> fs.constants.F_OK
assert.equal(fs.R_OK, undefined);
assert.equal(assert.CallTracker, undefined);                // DEP0173 -> mock.fn() from node:test

// DEP0147: rmdir no longer takes `recursive`.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmdir-'));
try {
  assert.throws(() => fs.rmdirSync(dir, { recursive: true }), { code: 'ERR_INVALID_ARG_VALUE' });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// DEP0094: the two-argument form no longer compares; the first arg is the message.
assert.throws(() => assert.fail('a', 'b'), { code: 'ERR_ASSERTION', message: 'a' });

// DEP0185: REPL classes need `new`.
assert.throws(() => repl.REPLServer({ input: new PassThrough(), output: new PassThrough() }), TypeError);

// DEP0118: falsy host names throw synchronously.
assert.throws(() => dns.lookup(false, () => {}), { code: 'ERR_INVALID_ARG_VALUE' });

// DEP0154: RSA-PSS `hash`/`mgf1Hash` -> `hashAlgorithm`/`mgf1HashAlgorithm`.
assert.throws(() => crypto.generateKeyPairSync('rsa-pss', { modulusLength: 1024, hash: 'sha256' }),
  { code: 'ERR_INVALID_ARG_VALUE' });

// DEP0170: url.parse() rejects non-numeric ports.
process.noDeprecation = true; // url.parse() itself is DEP0169
assert.throws(() => url.parse('http://a.com:xyz/'), { code: 'ERR_INVALID_ARG_VALUE' });
