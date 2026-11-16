// @node-skills {"added":["v26.11.0"]}
// Buffer.stringLength, buffer.isLatin1, util.isPartialDeepStrictEqual (all v26.11.0),
// Buffer.allocUnsafe(size, alignment) (v26.8.0).
import { Buffer, isLatin1, constants } from 'node:buffer';
import { isPartialDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';

// stringLength: UTF-16 length that buf.toString(enc) WOULD produce, without decoding.
const buf = Buffer.from('€ 100');
assert.equal(buf.length, 7);
assert.equal(Buffer.stringLength(buf), 5);
assert.equal(Buffer.stringLength(buf, 'hex'), 14);
assert.equal(Buffer.stringLength(Buffer.from('😀')), 2);                 // surrogate pair
assert.equal(Buffer.stringLength(Buffer.from([0xff, 0xfe, 0x41])), 3);   // invalid bytes -> U+FFFD each
assert.ok(Buffer.stringLength(buf) <= constants.MAX_STRING_LENGTH);     // guard before toString()

// isLatin1 validates a STRING (Node 'latin1' = U+0000..U+00FF, not windows-1252).
assert.equal(isLatin1('café'), true);
assert.equal(isLatin1('\u0080'), true);
assert.equal(isLatin1('€'), false);
assert.throws(() => isLatin1(Buffer.from('a')), { code: 'ERR_INVALID_ARG_TYPE' });

// Partial deep equality as a boolean (assert.partialDeepStrictEqual without throwing).
assert.equal(isPartialDeepStrictEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } }), true);
assert.equal(isPartialDeepStrictEqual({ a: 1 }, { a: '1' }), false);     // strict
assert.equal(isPartialDeepStrictEqual([1, 2, 3], [1, 3]), true);         // ordered subsequence
assert.equal(isPartialDeepStrictEqual([1, 2, 3], [3, 1]), false);

// Aligned allocation (e.g. O_DIRECT). alignment must be a power of two <= 2**30.
assert.equal(Buffer.allocUnsafeSlow(4096, 4096).length, 4096);
assert.equal(Buffer.allocUnsafe(16, 64).length, 16);
assert.throws(() => Buffer.allocUnsafe(16, 3), { code: 'ERR_INVALID_ARG_VALUE' });
