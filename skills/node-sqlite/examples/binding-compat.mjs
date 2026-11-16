// @node-skills {"added":["v24.0.0"]}
// Version traps: before v24.21 a boolean throws and an ArrayBuffer silently binds NULL; wrap values to be portable.
import * as sqlite from 'node:sqlite';
import assert from 'node:assert/strict';

const Database = sqlite.Database ?? sqlite.DatabaseSync;
const db = new Database(':memory:');
const typeOf = db.prepare('SELECT typeof(?) AS t');

const [major, minor] = process.versions.node.split('.').map(Number);
const modernBinding = major > 26 || (major === 26 && minor >= 8) || (major === 24 && minor >= 21);

if (modernBinding) {
  assert.equal(typeOf.get(true).t, 'integer');
  assert.equal(typeOf.get(new ArrayBuffer(2)).t, 'blob');
} else {
  assert.throws(() => typeOf.get(true), { code: 'ERR_INVALID_ARG_TYPE' });
  assert.equal(typeOf.get(new ArrayBuffer(2)).t, 'null'); // silent data loss
}

// Portable on every version: convert booleans and wrap ArrayBuffers yourself.
assert.equal(typeOf.get(Number(true)).t, 'real');
assert.equal(typeOf.get(BigInt(true)).t, 'integer');
assert.equal(typeOf.get(new Uint8Array(new ArrayBuffer(2))).t, 'blob');
assert.equal(typeOf.get(null).t, 'null'); // use null, not undefined, before v26.10
db.close();
