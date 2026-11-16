// @node-skills {"added":["v26.1.0"],"flags":["--no-warnings"]}
// Native memory helpers and JS callbacks (qsort), on Linux/glibc.
import ffi from 'node:ffi';
import assert from 'node:assert/strict';

if (process.platform !== 'linux') { console.log('skip: uses glibc libc.so.6'); process.exit(77); }

using libc = new ffi.DynamicLibrary('libc.so.6');
const { malloc, free, strlen, qsort } = libc.getFunctions({
  malloc: { arguments: ['uint64'], return: 'pointer' },   // uint64 accepts safe-integer numbers
  free: { arguments: ['pointer'] },
  strlen: { arguments: ['pointer'], return: 'uint64' },
  qsort: { arguments: ['pointer', 'uint64', 'uint64', 'function'] },
});

const p = malloc(16);
assert.equal(typeof p, 'bigint');
try {
  ffi.exportString('hi!', p, 16);                 // copies + NUL; length must cover both
  assert.equal(ffi.toString(p), 'hi!');
  assert.equal(strlen(p), 3n);
  assert.throws(() => ffi.exportString('toolong', p, 3), { code: 'ERR_OUT_OF_RANGE' });

  ffi.setInt32(p, 8, -7);                          // setters need an explicit offset
  assert.equal(ffi.getInt32(p, 8), -7);

  const copy = ffi.toBuffer(p, 4);                 // default: copied
  copy[0] = 0x58;
  assert.equal(ffi.toString(p), 'hi!');
  const view = ffi.toBuffer(p, 4, false);          // zero-copy view: writes hit native memory
  view[0] = 0x58;
  assert.equal(ffi.toString(p), 'Xi!');
  assert.equal(ffi.toArrayBuffer(p, 4).byteLength, 4);
} finally {
  free(p); // `view` is now dangling: never touch it again
}

// JS memory -> raw pointer (valid only while the buffer is alive and not detached/resized).
const b = Buffer.from('xyz\0');
assert.equal(strlen(ffi.getRawPointer(b)), 3n);

// Callbacks: register to get a function pointer; a plain JS function is NOT accepted.
const arr = new Int32Array([5, 1, 4, 2, 3]);
assert.throws(() => qsort(arr, arr.length, 4, () => 0), { code: 'ERR_INVALID_ARG_VALUE' });
const cmp = libc.registerCallback(
  { arguments: ['pointer', 'pointer'], return: 'int32' },
  (a, b) => ffi.getInt32(a) - ffi.getInt32(b),      // must not throw: a throwing callback aborts the process
);
assert.equal(typeof cmp, 'bigint');
qsort(arr, arr.length, arr.BYTES_PER_ELEMENT, cmp);  // typed array passes its backing memory
assert.deepEqual([...arr], [1, 2, 3, 4, 5]);
libc.unregisterCallback(cmp);                      // only once native code can no longer call it
