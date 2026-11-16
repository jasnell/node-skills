---
name: node-ffi
description: "Calls C functions in shared libraries directly from JavaScript with the built-in node:ffi, with no C++ addon. Use to call libc, libsqlite3 or a vendor .so/.dylib/.dll from Node.js, pass a JS callback to native code, or read and write native memory. Use it instead of ffi-napi, node-ffi, or an addon written for one function. Covers ffi.dlopen, DynamicLibrary, getFunction, registerCallback, toFunction, the pointer and memory helpers and --allow-ffi. Node.js 26.1+ (not on v24)."
---

# node:ffi: call native libraries without an addon

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:ffi` (`dlopen`, `DynamicLibrary`, memory helpers) | v26.1.0 | 1 | none; `--no-experimental-ffi` disables |
| `--allow-ffi` (permission model) | v26.1.0 | 1.1 | with `--permission` |
| `getCurrentEventLoop()` | v26.6.0 | 1 | none |
| `dlopen` of a path inside a mounted `node:vfs` | v26.10.0 | 1 | none |
| `library.toFunction()` | main only (no YAML; absent in v26.13.0) | 1 | none |

Not on v24. Present only in builds with FFI support (the official v26 builds
have it). Importing it emits an `ExperimentalWarning`.

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Call a C function

```js
import { dlopen } from 'node:ffi';
{
  using h = dlopen('libc.so.6', {          // Linux glibc; NOT 'libc.so' (linker script)
    strlen: { arguments: ['string'], return: 'uint64' },
    abs:    { arguments: ['int32'],  return: 'int32' },
  });
  h.functions.strlen('héllo');             // 6n: 64-bit returns are always bigint
  h.functions.abs(-5);                     // 5
}                                          // library closed here
```

`dlopen(null, …)` resolves from the process image (not on Windows). Build
names portably with `` `libfoo.${ffi.suffix}` `` (`so`/`dylib`/`dll`).

## Pointers and callbacks

```js
const p = malloc(16);                      // 'pointer' returns are bigint
ffi.exportString('hi', p, 16); ffi.toString(p); free(p);
const cmp = lib.registerCallback({ arguments: ['pointer','pointer'], return: 'int32' },
  (a, b) => ffi.getInt32(a) - ffi.getInt32(b));
qsort(int32Array, n, 4, cmp); lib.unregisterCallback(cmp);
```

## Pitfalls

- No coercion: `abs(1.5)`, `abs('5')`, `abs(5n)` and `bool` `true` throw
  `ERR_INVALID_ARG_VALUE`. Pass `0`/`1` for `bool`.
- A `'string'` **return** is a bigint pointer. Decode it with `ffi.toString()`.
- Wrong signatures are not detected. Declaring `bool` for a C `int` truncates
  it, and a wrong pointer crashes the process.
- A callback that throws **aborts the process**. Callbacks must be sync and
  run on the creating thread. A `'function'` argument needs a
  `registerCallback` pointer, not a JS function.
- Calls are synchronous on the JS thread. A slow C call blocks the event loop.
- `toBuffer(p, n, false)` views and `getRawPointer()` dangle after `free()`
  or GC.
- `process.permission.drop('ffi')` does not stop calls or `getFunction()` on
  an already-open library. Only new libraries, `toFunction`, and memory
  helpers are denied.
- No structs by value, no calling-convention choice, fixed signatures only.

## Don't

- Don't install `ffi-napi`, `node-ffi`, `ref-napi` or `koffi` for simple
  calls on 26.1+.
- Don't write a C++ addon just to call one C function.
- Do still use Node-API/an addon when you need structs by value, threadpool
  work, native objects, v24 support, or a vetted safe API.

## Reference

- [rules/api.md](rules/api.md): read for type names, every DynamicLibrary method, callbacks' lifetime rules, and memory helpers.
- [rules/call-paths-safety.md](rules/call-paths-safety.md): read for performance (Fast API/shared-buffer/generic paths, arg limits), permissions, and the full safety list.
