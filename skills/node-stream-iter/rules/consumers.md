# Consumers, utilities, multi-consumer

## Consumers (they drain a source fully)

| Async | Sync | Result |
| --- | --- | --- |
| `text(src[, { encoding='utf-8', limit, signal }])` | `textSync` | a string |
| `bytes(src[, opts])` | `bytesSync` | one `Uint8Array` |
| `arrayBuffer(src[, opts])` | `arrayBufferSync` | an `ArrayBuffer` |
| `array(src[, opts])` | `arraySync` | a `Uint8Array[]` (not concatenated) |
| `dump(src[, { limit, signal }])` (v26.12.0, not on v24) | `dumpSync` | `undefined`. It keeps nothing, so memory stays at one batch |

- `limit` is a byte cap. Exceeding it rejects or throws `ERR_OUT_OF_RANGE`, and `dump` also cancels the
  source. There is no default limit, so set one for untrusted input.
- The async consumers accept sync iterables too. The sync ones throw on async sources
  (`dumpSync` throws `ERR_INVALID_ARG_TYPE`).
- Use `dump()` when the bytes must be read but are not needed, for example to return flow-control credit
  on a QUIC stream.

## Utilities

- `tap(cb)` / `tapSync(cb)` return a pass-through transform. `cb(chunks | null, { signal })` sees each batch,
  and `null` at the end, and its return value is ignored. Use it for metrics and logging:
  ```js
  let n = 0;
  await dump(pull(src, tap((b) => { if (b) for (const c of b) n += c.byteLength; })));
  ```
- `merge(...sources[, { signal }])` yields batches in the order they arrive, with all sources running concurrently.
  On error it calls `return()` on the other sources without waiting for them.
- `ondrain(writer)`: see `rules/push-duplex.md`.

## `broadcast([options])` → `{ writer, broadcast }` (push model, many consumers)

- The options are `budget` (default **65536**), `backpressure` (default `'strict'`) and `signal`.
- `broadcast.push([...transforms][, { signal }])` creates a consumer, which reads through its own cursor
  into a shared buffer. **Create consumers before writing.**
- `consumerCount` gives the number of consumers. `cancel([reason])` rejects all consumers with `reason`, or ends them normally when there is none,
  and it closes the writer. `[Symbol.dispose]` is an alias for `cancel()`.
- `Broadcast.from(asyncIterable | broadcastProtocolObject[, opts])` pumps a source into a new broadcast.

## `share(source[, options])` → `Share` (pull model, many consumers)

- The source is read only when some consumer pulls. The options are `budget` (default 65536), `backpressure` and `signal`.
- `share.pull([...transforms][, { signal }])` adds a consumer, which starts at the oldest buffered entry.
- Consume concurrently (`Promise.all`). Under `'strict'`, a consumer that would push the buffer past
  `budget` is rejected with `ERR_OUT_OF_RANGE` and detached. Under `'unbounded'` and `'drop-newest'`, a slow
  consumer stalls the others. Only `'drop-oldest'` lets faster consumers keep going.
- When every consumer detaches, the source is **not** closed. Call `share.cancel()` or dispose the share to release it.
- `shareSync(iterable[, opts])` supports only `'strict'` and `'drop-oldest'`. Any other policy throws `ERR_INVALID_ARG_VALUE` on v26.12+, while v24.x accepts it silently.
- On v24.x every `budget` (`broadcast`, `share`, `shareSync`) must be >= 16384.
- `Share.from()` (v25.9.0 only, per the YAML) and `SyncShare.fromSync()` accept a source or an object implementing
  `Symbol.for('Stream.shareProtocol')` or `Symbol.for('Stream.shareSyncProtocol')`.
