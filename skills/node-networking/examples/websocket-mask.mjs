// @node-skills {"added":["v26.12.0"]}
// http.websocketMask / websocketUnmask: native RFC 6455 payload (un)masking (replaces bufferutil).
import assert from 'node:assert/strict';
import { websocketMask, websocketUnmask } from 'node:http';

const key = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
const payload = Buffer.from('Hello');
const frame = Buffer.alloc(6 + payload.length);
websocketMask(payload, key, frame, 6, payload.length); // (source, mask, output, offset, length)
assert.deepEqual([...frame.subarray(6)], [0x7f, 0x9f, 0x4d, 0x51, 0x58]);
assert.equal(payload.toString(), 'Hello');              // source untouched

const received = frame.subarray(6);
websocketUnmask(received, key);                         // in place
assert.equal(received.toString(), 'Hello');

// In-place masking (same view for source and output) is allowed.
const buf = Buffer.from('abcdefgh');
websocketMask(buf, key, buf, 0, buf.length);
websocketUnmask(buf, key);
assert.equal(buf.toString(), 'abcdefgh');

assert.throws(() => websocketUnmask(buf, Buffer.alloc(3)));          // mask must be 4 bytes
assert.throws(() => websocketMask(payload, key, Buffer.alloc(4), 0, payload.length)); // output too small
