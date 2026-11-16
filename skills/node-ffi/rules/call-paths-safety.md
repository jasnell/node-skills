# Call paths, permissions, safety, and FFI versus addons

## Call paths (doc/api/ffi.md "Call paths")

When a wrapper is created, Node picks one of three paths. You can't
configure the choice or observe it, and all three validate arguments the same
way:

1. **Fast API.** V8-optimized code calls a per-signature trampoline directly.
   It needs all of the following:
   - a 64-bit platform: AArch64, x86-64, PPC64LE, LoongArch64, RISC-V 64 or
     s390x;
   - executable memory. Without it, creating the wrapper throws
     `ERR_RX_MEMORY_NOT_SUPPORTED` and does *not* fall back;
   - no `function` type in the signature;
   - at most 8 arguments, all of which fit in registers.

   Register limits per platform:

   | Platform | Integer/pointer args | FP args | Buffer args |
   | --- | --- | --- | --- |
   | x86-64 SysV | 6 (4 if a buffer arg is present) | 8 | yes, but not mixed with FP |
   | AArch64 | 7 (6 with a buffer arg) | 8 | yes, but not mixed with FP |
   | Win64 | 3 total | 3 | no |

   Signatures with a single `pointer`, `buffer` or `arraybuffer` argument get
   an extra entry point that takes Buffers directly.
2. **Shared buffer.** Used on little-endian hosts for signatures with at
   least one argument. Arguments go through a preallocated per-function
   buffer. A call that passes a string or Buffer to a pointer parameter is
   handed to the generic path for that call only.
3. **Generic libffi.** It supports every signature, and handles calls from
   unoptimized or deoptimized code as well as zero-argument functions.

What this means for hot loops: pass pointer arguments as `bigint`, keep
signatures within the register limits, and avoid `function` types in hot
signatures. These guidelines come from the docs. This skill did not
benchmark them.

## Permission model (verified on v26.13.0 and v28.0.0-pre)

- With `--permission`, `import 'node:ffi'` still succeeds. But
  `new DynamicLibrary()` and `dlopen()` throw `ERR_ACCESS_DENIED` ("Use
  --allow-ffi") unless you pass `--allow-ffi`. `process.permission.has('ffi')`
  reports the grant.
- After `process.permission.drop('ffi')`:

  | Operation | Result |
  | --- | --- |
  | existing wrappers | still callable |
  | `getFunction()` on an open library | works |
  | `registerCallback()` | works |
  | `new DynamicLibrary()` | `ERR_ACCESS_DENIED` |
  | `toFunction()` | `ERR_ACCESS_DENIED` |
  | memory helpers such as `ffi.toString()` | `ERR_ACCESS_DENIED` |

  So `drop` does not sandbox a library that is already open.
- In audit mode, denials are published to the `node:permission-model:ffi`
  diagnostics channel (docs; not verified).
- `--no-experimental-ffi` makes `node:ffi` an unknown built-in (*verified*).

## Safety rules (docs)

- Node does not track pointer validity, ownership or lifetime.
- Do not read or write freed memory, and do not use zero-copy views after the
  memory is released.
- Do not declare incorrect signatures. Nothing checks them: a C `int`
  declared as `bool` is silently truncated (*verified* with glibc `isdigit`).
- Do not resize, transfer or detach a Buffer or ArrayBuffer while a native
  call that borrowed it is running, including from a reentrant callback.
- Do not call callback pointers after `unregisterCallback()` or `close()`.
- A returned pointer does not imply ownership. Follow the C API's free rules.
- Prefer copies (`toBuffer(p, n)` with the default `copy: true`) unless zero
  copy is required.

## When to use FFI and when to use Node-API or an addon

FFI fits:

- calling a few C functions from an existing shared library, such as libc,
  system libraries or a vendor SDK;
- prototyping;
- avoiding a compile step and node-gyp.

Prefer Node-API (an addon) when:

- the code must run on v24, where there is no `node:ffi`;
- you need structs passed or returned by value, variadic or non-default
  calling conventions, or C++ classes;
- you need async work on the libuv threadpool. FFI calls block the JS thread;
- you want a safe, validated JS API around native state;
- callbacks may come from other threads;
- the process can't allocate executable memory and Fast API wrappers fail;
- you want ABI stability across Node versions. `node:ffi` is Stability 1 and
  may change in minor releases.
