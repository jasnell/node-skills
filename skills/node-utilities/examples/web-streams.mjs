// @node-skills {"added":["v26.5.0","v24.19.0"]}
// blob.textStream(), ReadableStreamTee(stream, cloneForBranch2), streamConsumers.bytes (v25.6.0,
// v24.14.0), stream.compose (Stable in v26.2.0, v24.19.0).
import { ReadableStreamTee } from 'node:stream/web';
import { bytes, text } from 'node:stream/consumers';
import { Readable, compose, Transform } from 'node:stream';
import assert from 'node:assert/strict';

// textStream(): string chunks, like blob.stream().pipeThrough(new TextDecoderStream()).
const chunks = await Array.fromAsync(new Blob(['héllo ', 'wörld']).textStream());
assert.ok(chunks.every((c) => typeof c === 'string'));
assert.equal(chunks.join(''), 'héllo wörld');

// ReadableStreamTee(..., true): branch 2 gets structured clones, so mutating one side is safe.
const src = () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.close(); } });
const [x, y] = ReadableStreamTee(src(), true);
const [cx, cy] = await Promise.all([x.getReader().read(), y.getReader().read()]);
assert.notEqual(cx.value, cy.value);
assert.deepEqual([...cy.value], [1, 2]);
const [p, q] = src().tee();                                   // .tee() shares the same chunk object
const [cp, cq] = await Promise.all([p.getReader().read(), q.getReader().read()]);
assert.equal(cp.value, cq.value);

// bytes(): a Uint8Array (not a Buffer) from Node or web streams or async iterables.
const u8 = await bytes(Readable.from([Buffer.from('ab'), Buffer.from('c')]));
assert.equal(u8.constructor, Uint8Array);
assert.equal(Buffer.isBuffer(u8), false);
assert.equal((await bytes(new Blob(['xyz']).stream())).length, 3);

// compose(): several stages as one Duplex.
const upper = compose(
  new Transform({ transform(chunk, _, cb) { cb(null, chunk.toString().toUpperCase()); } }),
  async function* (source) { for await (const c of source) yield `[${c}]`; },
);
assert.equal(await text(Readable.from(['a', 'b']).pipe(upper)), '[A][B]');
