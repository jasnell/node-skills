// @node-skills {"added":["v25.9.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// Consuming streams: batches, text/bytes/array/arrayBuffer, limits, sync variants, merge.
import { from, fromSync, text, bytes, array, arrayBuffer, textSync, bytesSync, merge, pull } from 'node:stream/iter';
import assert from 'node:assert/strict';

// Iterating yields BATCHES (Uint8Array[]), not single chunks.
for await (const batch of from(['ab', 'cd'])) {
  assert.ok(Array.isArray(batch));
  assert.ok(batch.every((c) => c instanceof Uint8Array));
}

assert.equal(await text(from('héllo')), 'héllo');                // UTF-8 by default
assert.deepEqual(await bytes(from('hi')), new Uint8Array([104, 105]));
assert.equal((await arrayBuffer(from('hi'))).byteLength, 2);
assert.equal((await array(from(['a', 'b']))).length >= 1, true);  // chunks, not concatenated
assert.equal(await text(from([new Uint8Array([0x61]), 'b', [['c']]])), 'abc'); // nested input is flattened

// limit guards against unbounded input: exceeding it rejects with ERR_OUT_OF_RANGE.
await assert.rejects(text(from('0123456789'), { limit: 4 }), { code: 'ERR_OUT_OF_RANGE' });
assert.equal(await text(from('0123'), { limit: 4 }), '0123');

// AbortSignal cancels a consumer or a pipeline. Pass an already-aborted signal to the CONSUMER:
// that rejects on every version. (On v24.x, pull() with an already-aborted signal throws synchronously.)
const ac = new AbortController();
ac.abort(new Error('stop'));
await assert.rejects(text(from('x'), { signal: ac.signal }), /stop/);
// Aborting a pull() pipeline after it was created rejects the pending/next read everywhere.
const ac2 = new AbortController();
const piped = pull(from('x'), { signal: ac2.signal });
ac2.abort(new Error('late'));
await assert.rejects(text(piped), /late/);

// Sync variants for sync sources.
assert.equal(textSync(fromSync('sync')), 'sync');
assert.equal(bytesSync(fromSync('ab')).byteLength, 2);
assert.throws(() => fromSync(null), { code: 'ERR_INVALID_ARG_TYPE' });

// merge() interleaves sources in arrival order.
const merged = await text(merge(from('a'), from('b')));
assert.deepEqual([...merged].sort(), ['a', 'b']);
