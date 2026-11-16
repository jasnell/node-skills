// @node-skills {"added":["v26.1.0","v24.16.0"]}
// crypto.randomUUIDv7(): RFC 9562 version 7 UUIDs (48-bit ms timestamp prefix).
import { randomUUIDv7 } from 'node:crypto';
import assert from 'node:assert/strict';

const before = Date.now();
const id = randomUUIDv7();
const after = Date.now();
assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
// The first 48 bits are Unix milliseconds.
const ms = parseInt(id.replaceAll('-', '').slice(0, 12), 16);
assert.ok(ms >= before && ms <= after);
assert.match(randomUUIDv7({ disableEntropyCache: true }), /^[0-9a-f-]{36}$/);
// Ids from different milliseconds sort by time; within one ms the order is random.
const a = randomUUIDv7();
const t = Date.now(); while (Date.now() === t);
const b = randomUUIDv7();
assert.ok(a < b);
