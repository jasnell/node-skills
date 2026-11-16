# node:ffi API reference

Source: `doc/api/ffi.md` at nodejs/node `ab476eccd03`. The module is
Stability 1. Items marked *verified* were run on v26.13.0 and v28.0.0-pre
(Linux x64, glibc).

## Type names

| Canonical | Aliases | JS in | JS out |
| --- | --- | --- | --- |
| `void` | | | `undefined` |
| `int8` `uint8` `int16` `uint16` `int32` `uint32` | `i8` `u8` `i16` `u16` `i32` `u32` | integer `number` in range | `number` |
| `int64` `uint64` | `i64` `u64` | `bigint`, or a safe-integer `number` | **always `bigint`** |
| `float32` `float64` | `f32`/`float`, `f64`/`double` | `number` | `number` |
| `bool` | (marshaled as `uint8`) | `0`/`1` only; `true` throws (*verified*) | `number` |
| `char` | | platform-signed int8 or uint8 | `number` |
| `pointer` | `ptr` | `bigint`, `null`/`undefined` (NULL), string, Buffer, TypedArray, DataView, ArrayBuffer | `bigint` |
| `string` | `str` | as for pointer. A string is copied to temporary NUL-terminated UTF-8 for the call | **`bigint`** (*verified*). Decode with `ffi.toString()` |
| `buffer`, `arraybuffer` | | as for pointer | `bigint` |
| `function` | | a `bigint` from `registerCallback` (a JS function is rejected, *verified*) | `bigint` |

`ffi.types` holds the same names as constants: `VOID`, `POINTER`, `BUFFER`,
`ARRAY_BUFFER`, `FUNCTION`, `BOOL`, `CHAR`, `STRING`, `FLOAT`, `DOUBLE`,
`INT_8` … `UINT_64`, `FLOAT_32`, `FLOAT_64`.

Invalid values throw `ERR_INVALID_ARG_VALUE`. That includes fractions, `NaN`,
values out of range, and a `bigint` passed for `int32` (*verified*:
"Argument 0 must be an int32").

A signature object is `{ return = 'void', arguments = [] }`. Both keys are
optional.

## Loading

| API | Added | Notes |
| --- | --- | --- |
| `ffi.suffix` | v26.1.0 | `'so'`, `'dylib'` or `'dll'` |
| `ffi.dlopen(path, definitions?)` | v26.1.0; VFS paths since v26.10.0 | Returns `{ lib, functions }` and supports `using`. `path` can be `null` for the process image (not on Windows). Then `lib.path` is `''` (*verified*). |
| `new DynamicLibrary(path)` | v26.1.0 (class); VFS paths since v26.10.0 | Lazy: resolves nothing up front. |
| `ffi.dlclose(lib)` | v26.1.0 | Same as `lib.close()`. |
| `ffi.dlsym(lib, name)` | v26.1.0 | Same as `lib.getSymbol(name)`, a `bigint`. |

The OS dynamic loader resolves library names. On Linux glibc, `'libc.so.6'`
works, and so does `'libm.so.6'`. `'libc.so'` fails with
`ERR_FFI_CALL_FAILED` "invalid ELF header", because it is a linker script
(*verified*). macOS and Windows library names were not verified here.

A missing library or symbol throws `ERR_FFI_CALL_FAILED` with the `dlopen`
or `dlsym` message (*verified*).

## DynamicLibrary members

Most of these have no per-member YAML. They exist in v26.13.0 unless noted.

- `path` holds the path the library was loaded from. For a VFS path, it
  keeps the virtual path (*verified*).
- `functions` and `symbols` hold the wrappers and addresses resolved so far.
- `getFunction(name, sig)` returns a wrapper with a `.pointer` (bigint).
  Asking again with a different signature throws `ERR_INVALID_ARG_VALUE`.
  The same signature returns the same function (*verified*).
- `getFunctions(defs?)` resolves many at once. Called with no arguments, it
  returns all wrappers resolved so far.
- `getSymbol(name)` and `getSymbols()` return addresses.
- `toFunction(pointer, sig)` wraps a raw function address, for example from
  a vtable or a returned function pointer. It always uses the generic libffi
  path, and wrappers it makes don't appear in `functions`. Calling one after
  `close()` throws `ERR_FFI_LIBRARY_CLOSED`. **Not present in v26.13.0**
  (*verified*). It exists on main and has no YAML `added`.
- `registerCallback([sig,] fn)` returns a `bigint` callback pointer. The
  default signature is `void ()`. While any callbacks are registered, the
  library is not garbage collected.
- `unregisterCallback(ptr)`, `refCallback(ptr)`, `unrefCallback(ptr)`. After
  unref, the function may be GC'd, and later native calls become no-ops that
  return zero.
- `close()` and `[Symbol.dispose]()` are idempotent (*verified*). After
  close, calling a wrapper or resolving a symbol throws
  `ERR_FFI_LIBRARY_CLOSED` (*verified*).

### Callback rules (from the docs)

A callback must:

- run on the thread that created it;
- not throw (*verified*: it aborts the process with "Callbacks cannot throw
  an exception" and a native stack);
- not return a promise;
- return a value of the declared type;
- not close its own library or unregister itself while it runs.

If the thread stops while a callback runs (`worker.terminate()` or
`process.exit()` in a worker), the callback returns zero, false or NULL to
native code. Closing the library or unregistering a callback does **not**
revoke pointers native code already holds. Invoking one afterwards is
undefined behavior.

## Memory helpers (all added v26.1.0, except where noted)

- `getInt8/Uint8/Int16/Uint16/Int32/Uint32/Int64/Uint64/Float32/Float64(ptr[, offset])`
  read memory. The 64-bit ones return `bigint`.
- The `set…(ptr, offset, value)` versions write. **The offset is required**
  (*verified*).
- `toString(ptr)` reads a NUL-terminated UTF-8 string and returns `null` for
  `0n` (*verified*).
- `toBuffer(ptr, len[, copy = true])` and `toArrayBuffer(ptr, len[, copy = true])`.
  With `copy: false` you get a live view of native memory: writes go through
  (*verified*), and the view dangles once the memory is freed.
- `exportString(str, ptr, len[, encoding = 'utf8'])` copies the string plus a
  NUL terminator (two NUL bytes for UTF-16). If `len` is too small it throws
  `ERR_OUT_OF_RANGE` (*verified*). It never allocates.
- `exportBuffer(buf, ptr, len)`, `exportArrayBuffer(ab, ptr, len)` and
  `exportArrayBufferView(view, ptr, len)` copy bytes. `len` must be at least
  the source size.
- `getRawPointer(bufferOrView)` returns the address of JS-owned memory. It
  becomes invalid if the memory is detached, resized or transferred.
- `getCurrentEventLoop()` (v26.6.0) returns this thread's `uv_loop_t*`. It is
  valid only while this environment is alive.

Pointer-sized results from C, such as `malloc`, are plain `bigint`s.
Ownership is whatever the C API says. Node never frees them.
