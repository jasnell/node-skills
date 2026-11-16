// @node-skills {"added":["v26.1.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// Interop: classic Readable/Writable and Web Streams in and out of stream/iter.
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, gunzipSync } from 'node:zlib';
import { from, pull, text, pipeTo, fromReadable, fromWritable, toReadable, toReadableSync, toWritable, fromSync, push } from 'node:stream/iter';
import { compressGzip } from 'node:zlib/iter';
import assert from 'node:assert/strict';

// Classic Readable -> iter: from()/pull() accept it directly (Readable implements Stream.toAsyncStreamable).
assert.equal(await text(from(Readable.from(['a', 'b']))), 'ab');
assert.equal(typeof Readable.prototype[Symbol.for('Stream.toAsyncStreamable')], 'function');
const r = Readable.from([Buffer.from('x')]);
assert.equal(fromReadable(r), fromReadable(r)); // cached per instance
assert.equal(await text(fromReadable(r)), 'x');

// iter -> classic Readable: use in an ordinary stream.pipeline().
const parts = [];
await pipeline(toReadable(pull(from('to classic'))), createGzip(),
  new Writable({ write(c, _e, cb) { parts.push(c); cb(); } }));
assert.equal(gunzipSync(Buffer.concat(parts)).toString(), 'to classic');
assert.equal(toReadableSync(fromSync('now')).read().toString(), 'now');

// iter -> classic Writable: 'unbounded' is the policy recommended for pipeTo().
const got = [];
const sink = new Writable({ write(c, _e, cb) { got.push(c); cb(); } });
await pipeTo(from('hello'), compressGzip(), fromWritable(sink, { backpressure: 'unbounded' }));
assert.equal(gunzipSync(Buffer.concat(got)).toString(), 'hello');
assert.equal(sink.writableFinished, true);

// classic Writable API over an iter writer.
const { writer, readable } = push();
const w = toWritable(writer);
const collected = text(readable);
w.write('via ');
w.end('toWritable');
assert.equal(await collected, 'via toWritable');

// Web ReadableStream is async-iterable, so from() takes it (byte and string chunks).
const web = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('web ')); c.enqueue('stream'); c.close(); } });
assert.equal(await text(from(web)), 'web stream');

// iter -> Web ReadableStream via a classic Readable.
const back = Readable.toWeb(toReadable(pull(from('to web'))));
let s = '';
for await (const chunk of back) s += Buffer.from(chunk).toString();
assert.equal(s, 'to web');

// iter -> Web WritableStream: any object with write() is a Writer; add end()/fail() for close/abort.
const received = [];
const ws = new WritableStream({ write(chunk) { received.push(chunk); } });
const ww = ws.getWriter();
const bytesWritten = await pipeTo(from(['to ', 'writable']), {
  write: (chunk) => ww.write(chunk),
  end: () => ww.close(),
  fail: (reason) => ww.abort(reason),
});
assert.equal(bytesWritten, 11);
assert.equal(Buffer.concat(received).toString(), 'to writable');
