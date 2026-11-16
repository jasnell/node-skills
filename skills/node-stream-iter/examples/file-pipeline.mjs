// @node-skills {"added":["v25.9.0","v24.20.0"],"flags":["--experimental-stream-iter"]}
// file -> transforms -> file with filehandle.pull()/writer() and pipeTo(); stateless and stateful transforms.
import { open, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeTo, pull, from, text, tap } from 'node:stream/iter';
import assert from 'node:assert/strict';

const dir = await mkdtemp(join(tmpdir(), 'iter-file-'));
try {
  await writeFile(join(dir, 'in.txt'), 'alpha\nbeta\ngamma\n');

  // Stateless transform: called once per batch (Uint8Array[]), then once with null (flush).
  const upper = (chunks) => chunks === null ? null
    : chunks.map((c) => new TextEncoder().encode(new TextDecoder().decode(c).toUpperCase()));

  // Stateful transform: a generator over the whole upstream; it sees null after the source ends.
  const numberLines = {
    async *transform(source) {
      let partial = '';
      let n = 0;
      for await (const chunks of source) {
        if (chunks === null) { if (partial) yield [new TextEncoder().encode(`${++n} ${partial}`)]; continue; }
        for (const c of chunks) {
          const lines = (partial + new TextDecoder().decode(c)).split('\n');
          partial = lines.pop();
          yield lines.map((l) => new TextEncoder().encode(`${++n} ${l}\n`));
        }
      }
    },
  };

  let seen = 0;
  const count = tap((chunks) => { if (chunks) for (const c of chunks) seen += c.byteLength; });

  const src = await open(join(dir, 'in.txt'));
  const dst = await open(join(dir, 'out.txt'), 'w');
  const written = await pipeTo(
    src.pull({ autoClose: true }),             // AsyncIterable<Uint8Array[]>, 128 KiB reads by default
    upper, numberLines, count,
    dst.writer({ autoClose: true }),           // end() closes the handle
  );
  assert.equal(await readFile(join(dir, 'out.txt'), 'utf8'), '1 ALPHA\n2 BETA\n3 GAMMA\n');
  assert.equal(written, 23);
  assert.equal(seen, 23);
  await assert.rejects(src.stat(), { code: 'EBADF' }); // autoClose closed the source too

  // Ranged read: start/limit use positioned reads.
  const fh = await open(join(dir, 'in.txt'));
  assert.equal(await text(fh.pull({ start: 6, limit: 4, autoClose: true })), 'beta');

  // Transforms can also be passed straight to filehandle.pull().
  const fh2 = await open(join(dir, 'in.txt'));
  assert.equal(await text(fh2.pull(upper, { autoClose: true })), 'ALPHA\nBETA\nGAMMA\n');

  // Writer without autoClose: end() resolves to the byte count; close the handle yourself.
  const out = await open(join(dir, 'w.txt'), 'w');
  const w = out.writer();
  await w.write('a');
  await w.writev(['b', new Uint8Array([0x63])]);
  assert.equal(await w.end(), 3);
  await out.close();
  assert.equal(await readFile(join(dir, 'w.txt'), 'utf8'), 'abc');

  // pull() is lazy: nothing is read until the result is iterated.
  const lazy = pull(from('xyz'), upper);
  assert.equal(await text(lazy), 'XYZ');
} finally {
  await rm(dir, { recursive: true, force: true });
}
