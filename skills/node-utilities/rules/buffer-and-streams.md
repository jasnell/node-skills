# Buffer and stream additions

## `Buffer.stringLength(input[, encoding])` (v26.11.0; not on v24)

Returns the `.length` (in UTF-16 code units) of the string that
`buf.toString(encoding)` *would* produce, without decoding. It is the
inverse of `Buffer.byteLength`. Input can be a Buffer, TypedArray or
ArrayBuffer.

Verified:
- `Buffer.from('€ 100')`: 7 bytes, `stringLength` 5, and `'hex'` gives 14.
- `'😀'` gives 2 (a surrogate pair).
- `[0xff, 0xfe, 0x41]` in utf8 gives 3, because each maximal invalid
  subsequence becomes one U+FFFD.

Use it as a guard: `if (Buffer.stringLength(buf) > constants.MAX_STRING_LENGTH)`
then stream instead of calling `toString()`. A detached ArrayBuffer counts as
empty.

## `buffer.isLatin1(string)` (v26.11.0; not on v24)

Validates a **string**: it returns `true` when every code unit is ≤ U+00FF,
so the string round-trips through Node `'latin1'` and is a valid WebIDL
ByteString. Example use: validating HTTP header values. Verified:
`'café'` → true, `'\u0080'` → true, `'€'` → false, `''` → true. Passing a
Buffer throws `ERR_INVALID_ARG_TYPE`. Node's latin1 is not WHATWG
windows-1252. This is the string counterpart of `buffer.isAscii` and
`buffer.isUtf8`, which take bytes.

## Aligned allocation (v26.8.0)

`Buffer.allocUnsafe(size, alignment)` and
`Buffer.allocUnsafeSlow(size, alignment)` return memory whose start address
is a multiple of `alignment`, which must be a power of two ≤ 2³⁰. This is for
`O_DIRECT`-style I/O:
`Buffer.allocUnsafeSlow(4096, 4096)`.

- A non-power-of-two throws `ERR_INVALID_ARG_VALUE` (verified).
- **v24.19.0 ignores the argument silently.** `allocUnsafe(16, 3)` does not
  throw, and the buffer is not aligned. Feature-detect with
  `try { Buffer.allocUnsafe(1, 3); /* unsupported */ } catch { /* supported */ }`.
- The address cannot be checked from JS. The alignment guarantee comes from
  the docs.

`Buffer.poolSize` defaults to 65536 since v26.3.0 and v24.18.0 (verified
on v24.19.0). It was 8192 before.

## `blob.textStream()` (v26.5.0, v24.19.0)

Returns a `ReadableStream<string>` of UTF-8-decoded chunks. It is the same
as `blob.stream().pipeThrough(new TextDecoderStream())`. Verified: the chunks
are strings and multi-byte characters survive.

## `ReadableStreamTee(stream[, cloneForBranch2])` (v26.5.0, v24.19.0; Stability 1)

`import { ReadableStreamTee } from 'node:stream/web'`. With `true`, branch 2
receives **structured clones** of the chunks. Verified: the two branches get
different `Uint8Array` objects with equal contents. `readable.tee()` gives
both branches the **same** object, so a consumer that mutates a chunk
corrupts the other branch. This matches Fetch's `response.clone()`
semantics.

## `streamConsumers.bytes(stream)` (v25.6.0, v24.14.0)

`import { bytes } from 'node:stream/consumers'`. Resolves to a `Uint8Array`
(**not** a Buffer, verified) holding the full contents of a Node Readable, a
web ReadableStream or an async iterable. Use `buffer()` when you need a
Buffer.

## `stream.compose(...streams)` is Stable (v26.2.0, v24.19.0)

Combines streams, async generator functions, web streams and iterables into a
single `Duplex`. It writes to the first stage and reads from the last.
Verified: `compose(new Transform(...), async function* (src) {...})` piped
from `Readable.from(['a', 'b'])` yields `'[A][B]'`. Use it to build reusable
pipeline segments instead of `pumpify`/`duplexify`.

## Changed default to remember

`readable.read()` with no size returns **one buffered chunk** per call since
v26.0.0. Before that it drained the whole buffer. Verified: after
`push('a')` and `push('b')`, `read()` returns `'a'` on main and `'ab'` on
v24.19.0.
