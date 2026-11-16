// @node-skills {"added":["v25.9.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// node:zlib/iter transforms: async and sync variants, interop with classic zlib output, file -> .gz.
import { from, fromSync, pull, pullSync, bytes, text, textSync, pipeTo } from 'node:stream/iter';
import {
  compressGzip, decompressGzip, compressGzipSync, decompressGzipSync,
  compressZstd, decompressZstd, compressBrotli, decompressBrotli, compressDeflate, decompressDeflate,
} from 'node:zlib/iter';
import { gunzipSync, gzipSync, constants } from 'node:zlib';
import { open, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const input = 'hello iterable streams '.repeat(200);

// Async round trips (compression runs on the libuv threadpool).
for (const [c, d] of [[compressGzip, decompressGzip], [compressZstd, decompressZstd],
  [compressBrotli, decompressBrotli], [compressDeflate, decompressDeflate]]) {
  const packed = await bytes(pull(from(input), c()));
  assert.ok(packed.byteLength < input.length);
  assert.equal(await text(pull(from(packed), d())), input);
}

// Output is ordinary gzip: classic zlib reads it, and the iter decompressor reads classic output.
const gz = await bytes(pull(from(input), compressGzip({ level: 9 })));
assert.equal(gunzipSync(gz).toString(), input);
assert.equal(await text(pull(from(gzipSync(input)), decompressGzip())), input);

// Brotli options use zlib.constants params, as in node:zlib.
const br = await bytes(pull(from(input), compressBrotli({ params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })));
assert.equal(await text(pull(from(br), decompressBrotli())), input);

// Sync variants pair with fromSync/pullSync/textSync and run on the main thread.
assert.equal(textSync(pullSync(pullSync(fromSync(input), compressGzipSync()), decompressGzipSync())), input);

// Transforms are stateful objects: create a fresh one per pipeline.
const dir = await mkdtemp(join(tmpdir(), 'iter-gz-'));
try {
  await writeFile(join(dir, 'in.txt'), input);
  const src = await open(join(dir, 'in.txt'));
  const dst = await open(join(dir, 'in.txt.gz'), 'w');
  await pipeTo(src.pull({ autoClose: true }), compressGzip(), dst.writer({ autoClose: true }));
  assert.equal(gunzipSync(await readFile(join(dir, 'in.txt.gz'))).toString(), input);
  const back = await open(join(dir, 'in.txt.gz'));
  assert.equal(await text(back.pull(decompressGzip(), { autoClose: true })), input);
} finally {
  await rm(dir, { recursive: true, force: true });
}
