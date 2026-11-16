// @node-skills {"added":["v26.1.0"],"flags":["--no-warnings"]}
// Call libc's strlen/abs/getpid through node:ffi, finding libc by feature detection.
import ffi from 'node:ffi';
import assert from 'node:assert/strict';

// Only the Linux/glibc name is verified. 'libc.so' is a linker script there ("invalid ELF header").
const candidates = {
  linux: ['libc.so.6', 'libc.musl-x86_64.so.1', 'libc.musl-aarch64.so.1'],
  darwin: ['/usr/lib/libSystem.B.dylib'],
  win32: ['msvcrt.dll'],
}[process.platform] ?? [`libc.${ffi.suffix}`];

function openLibc() {
  for (const name of candidates) {
    try { return new ffi.DynamicLibrary(name); } catch { /* try next */ }
  }
  return null;
}

{
  using libc = openLibc();
  if (!libc) { console.log(`skip: no libc among ${candidates}`); process.exit(77); }
  const { strlen, abs, getpid } = libc.getFunctions({
    strlen: { arguments: ['string'], return: 'uint64' },
    abs: { arguments: ['int32'], return: 'int32' },
    getpid: { return: 'int32' }, // `arguments` defaults to []
  });

  assert.equal(strlen('héllo'), 6n);               // strings go in as temporary UTF-8; 64-bit returns are bigint
  assert.equal(strlen(Buffer.from('abc\0')), 3n);   // Buffers pass a pointer to their memory
  assert.equal(abs(-5), 5);
  assert.equal(getpid(), process.pid);

  // Strict argument validation: no coercion.
  for (const bad of [1.5, 5n, '5', true]) assert.throws(() => abs(bad), { code: 'ERR_INVALID_ARG_VALUE' });

  // A 'string' RETURN type is just a pointer (bigint); decode it with ffi.toString().
  const getenv = libc.getFunction('getenv', { arguments: ['string'], return: 'string' });
  process.env.NODE_FFI_DEMO = 'ok';
  assert.equal(typeof getenv('NODE_FFI_DEMO'), 'bigint');
  assert.equal(ffi.toString(getenv('NODE_FFI_DEMO')), 'ok');
  assert.equal(ffi.toString(getenv('NODE_FFI_DOES_NOT_EXIST')), null); // NULL -> 0n -> null

  // Same symbol, different signature: rejected. Same signature: same wrapper.
  assert.throws(() => libc.getFunction('abs', { arguments: ['int64'], return: 'int64' }), { code: 'ERR_INVALID_ARG_VALUE' });
  assert.equal(libc.getFunction('abs', { arguments: ['int32'], return: 'int32' }), abs);
  assert.equal(ffi.dlsym(libc, 'abs'), abs.pointer);
  assert.throws(() => libc.getSymbol('no_such_symbol_xyz'), { code: 'ERR_FFI_CALL_FAILED' });

  // Declaring the wrong return width silently truncates: glibc isdigit() returns int 2048, not 0/1.
  if (process.report.getReport().header.glibcVersionRuntime) {
    const isdigitAsBool = libc.getFunction('isdigit', { arguments: ['int32'], return: 'bool' });
    assert.equal(isdigitAsBool(0x35), 0); // '5' IS a digit, but 2048 & 0xff === 0
  }

  // toFunction(pointer, signature) wraps a raw function address (main only; absent in v26.13.0).
  if (typeof libc.toFunction === 'function') {
    const toupper = libc.toFunction(libc.getSymbol('toupper'), { arguments: ['int32'], return: 'int32' });
    assert.equal(toupper(0x61), 0x41);
  }

  libc.close();
  assert.throws(() => abs(-1), { code: 'ERR_FFI_LIBRARY_CLOSED' });
  libc.close(); // second close is a no-op
}
