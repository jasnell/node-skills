# diagnostics_channel: bounded channels, scopes, TracingChannel, built-in channels

Source: `doc/api/diagnostics_channel.md` at nodejs/node `ab476eccd03`.
Verified on v28.0.0-pre, v26.13.0, and v24.19.0 by `examples/bounded-channel.mjs`,
`store-scope.mjs`, `trace-promise.mjs`, `trace-promise-compat.mjs`, `tracing-instrument.mjs`, `channel-*.mjs`.

## TracingChannel (Stable since v26.8.0)

`tracingChannel(name)` has been around since v19.9.0/v18.19.0. It was promoted from
Experimental to **Stable** in v26.8.0, and the API itself did not change. It uses five
channels named `tracing:${name}:{start,end,asyncStart,asyncEnd,error}`. One context
object flows through all of them and receives `result` or `error`.

`tracePromise(fn, context, thisArg, ...args)` changes:

| Version | Return value when subscribers exist |
| --- | --- |
| v24.x | always a native `Promise`. A custom thenable is converted, and a non-thenable is wrapped (async events still fire) |
| v26.0.0+ | a non-thenable is returned **as-is** with a process `Warning` ("returned a non-thenable"). Only `start`/`end` fire |
| v26.5.0+ | a non-native thenable is returned **as-is** with its own methods. Async events fire when it settles |

On v26+, the non-thenable warning is emitted even when the channel has no subscribers.
On v24 with no subscribers, `fn` is called directly and its raw value is returned.

Library pattern: create the channel once at module top level. Check `ch.hasSubscribers`
before building the context object. Name channels `module.class.method` or `module.function`.

## BoundedChannel (v26.1.0, Stability 1; not on v24)

```js
import { boundedChannel, BoundedChannel } from 'node:diagnostics_channel';
const bc = boundedChannel('mylib.parse');   // or boundedChannel({ start, end })
bc.start === channel('tracing:mylib.parse:start'); // same naming as TracingChannel
bc.subscribe({ start(ctx) {}, end(ctx) {} });      // unsubscribe(handlers) -> boolean
bc.run(ctx, fn, thisArg, ...args);                 // sync only; returns fn's value
{ using scope = bc.withScope(ctx); ctx.result = work(); } // start now, end at block exit
```

* It is a synchronous-only TracingChannel with just `start` and `end`. It has no
  `asyncStart`, `asyncEnd`, or `error`.
* `run()` does **not** set `ctx.result` and does **not** set `ctx.error` on a throw.
  `end` is still published and the error propagates. If subscribers need these
  values, set them on `ctx` yourself.
* `withScope()` without an argument publishes `{}`.
* `hasSubscribers` is true if `start` or `end` has a subscriber **or a bound store**.
* `BoundedChannel` is exported. `BoundedChannelScope` is not exported (you only get
  instances), and its only method is `[Symbol.dispose]`.

## channel.withStoreScope(data) (v26.1.0, Stability 1; not on v24)

`channel.withStoreScope(data)` is the `using` form of `channel.runStores(data, fn)`. It
enters every `AsyncLocalStorage` bound with `bindStore(store, transform)` (applying
the transform) and publishes `data` (untransformed) to subscribers. It returns a
`RunStoresScope`, whose only method is `[Symbol.dispose]`, which is idempotent. The class is not
exported. Nesting restores the stores in LIFO order.

**Async trap:** a scope opened in an `async` function before its first `await` stays
entered in the *caller* after the function returns its promise. The same applies to
`AsyncLocalStorage.withScope`. Use `runStores()` / `als.run()` across awaits.

## Built-in channels added since v24

| Channel(s) | Versions | Payload |
| --- | --- | --- |
| `locks.request.start`, `locks.request.grant`, `locks.request.miss`, `locks.request.end` | v25.9.0, v24.15.0 | `{ name, mode }`. `end` adds `steal`, `ifAvailable`, `error` |
| `tracing:node.test:start`, `tracing:node.test:end`, `tracing:node.test:error` (TracingChannel `'node.test'`) | v26.1.0, v24.16.0 | `{ name, nesting, file, type: 'test'\|'suite' }`. `error` adds `error` |
| `sqlite.db.query` | v26.8.0, v24.22.0 | `{ sql, database, duration }` (duration in ns, C-layer only) |
| `crypto.fips.indicator` | v26.9.0, v24.22.0 | `{ operation, reason, blocked, count, dropped }`. Needs `--enable-fips-indicator-events` and OpenSSL ≥ 3.4 (not verified here) |

Observed details:

* Web Locks: `miss` fires for `ifAvailable: true` when the lock is held, and the
  callback gets `null`. Each request publishes its own `end`.
* Test runner: bind a store with `tracingChannel('node.test').start.bindStore(als, fn)`
  and the store is visible inside the test body and its subtests. The runner's root
  also publishes `start`/`end` with `name: '<root>'` after the tests have run. This is
  undocumented. No `asyncStart`/`asyncEnd` were observed. A failing subtest publishes
  `error` for itself only, not for its parent.
* SQLite: `sql` is the expanded SQL. JS numbers bind as REAL, so `run(42)` appears as
  `42.0`. There is no start event and no context propagation; for spans, wrap calls in your own
  TracingChannel. Don't close the db or statement inside a subscriber.
* FIPS indicator: delivered asynchronously on the main thread only, at most 256 queued
  messages, and it does not keep the event loop alive.

Older built-in channels (console, http, http2, net, udp, module, child_process,
worker_threads, process.execve) are listed in the docs and are all Stability 1.
