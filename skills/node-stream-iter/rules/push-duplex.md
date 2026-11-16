# Push streams, writers, backpressure, duplex

## `push([...transforms][, options])` → `{ writer, readable }`

| Option | Default | Meaning |
| --- | --- | --- |
| `budget` | `16384` | The number of buffered bytes before backpressure applies. Any positive integer on v26.12+; **>= 16384 on v24.x** (smaller throws `ERR_OUT_OF_RANGE`) |
| `backpressure` | `'strict'` | `'strict'`, `'unbounded'`, `'drop-oldest'` or `'drop-newest'` |
| `signal` | none | Aborts the stream. It stays active while buffered data drains after `end()` |

The transforms apply to the readable side. A zero-length write is accepted and never delivered.

### Policies (two buffers: the buffer itself, capped at `budget`, and a queue of pending writes)

| Policy | Pending writes | When full |
| --- | --- | --- |
| `'strict'` | 1 | A further unawaited `write()` **rejects** with `ERR_INVALID_STATE` ("Backpressure violation: too many pending writes") |
| `'unbounded'` | unlimited | Writes queue forever, which can leak memory if you forget to `await`. This matches classic streams and web streams |
| `'drop-oldest'` | never waits | The oldest buffered data is evicted (for live feeds and telemetry) |
| `'drop-newest'` | never waits | The incoming write is discarded (for load shedding) |

Rules:

- Start the consumer (`text(readable)`, `for await`) **before** you await writes, or run it
  concurrently. Otherwise the first write that fills the buffer waits forever.
- Await every `write()`. Under `'strict'` that guarantees at most one pending write.

## Writer interface

Only `write(chunk[, { signal }])` is required. The optional members are `writev(chunks[, { signal }])`,
`end([{ signal }])` (a Promise of the total bytes), `fail(reason)` (always synchronous),
`writeSync`, `writevSync` (return booleans), `endSync()` (returns the bytes, or `-1`), `canWrite`
(`true`, `false`, or `null` when closed), and `[Symbol.asyncDispose]` (fails an open writer, or waits for one that is closing).

- A non-`Uint8Array` chunk is converted with `String()` and UTF-8 encoded. `writev` takes any iterable.
- After `end()`, the writer is *closing*: `write()` rejects with a `TypeError`, `writeSync()` returns
  `false`, and a second `end()` returns the same promise.
- An option `signal` cancels only that one operation. It does not fail the writer.

The try-sync-then-async pattern:

```js
if (!writer.writeSync(chunk)) await writer.write(chunk);
if (writer.endSync() < 0) await writer.end();
```

## `ondrain(writer)` → `Promise<boolean> | null`

This waits until buffered bytes fall below the budget. It returns `null` if the object does not implement
`Symbol.for('Stream.drainableProtocol')`. It is useful with the drop policies, where it lets a producer wait
instead of losing data. Prefer it over polling `canWrite`.

## `duplex([options])` → `[a, b]`

These are connected channels, like `socketpair()`: what one side's `writer` writes, the other side's `readable` yields.
The options are `budget`, `backpressure` and `signal` (shared), plus `a: {...}` and `b: {...}` for per-direction
overrides. Each end has `writer`, `readable`, `close()` (idempotent) and
`[Symbol.asyncDispose]`.

```js
const [client, server] = duplex();
(async () => {
  for await (const chunks of server.readable) await server.writer.writev(chunks); // echo
  await server.writer.end();
})();
await client.writer.write('ping');
await client.writer.end();
await text(client.readable); // 'ping'
```
