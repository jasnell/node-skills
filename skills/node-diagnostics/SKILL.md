---
name: node-diagnostics
description: "Instrumentation, context propagation and profiling added since Node.js 24. Use to instrument a library for APM or OpenTelemetry, propagate request context across async calls, profile one section of code (CPU or heap), capture a heap profile before an out-of-memory crash, find leaked objects, or set a conditional logpoint without editing code. Covers diagnostics_channel boundedChannel and TracingChannel (Stable), built-in channels, AsyncLocalStorage withScope/defaultValue, v8.startCpuProfile/startHeapProfile, setHeapProfileNearHeapLimit, queryObjects, node inspect --probe (--cond, --max-hit) and inspector Network/DOMStorage. Node.js 24+, some 26+."
---

# Node.js diagnostics (v24+)

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `TracingChannel` | v19.9.0, v18.19.0 (Stable in v26.8.0) | 2 | — |
| `boundedChannel`, `channel.withStoreScope` | v26.1.0 (not v24) | 1 | — |
| `als.withScope` / `RunScope` | v25.9.0, v24.20.0 | 1 | — |
| `AsyncLocalStorage({ defaultValue, name })` | v24.0.0 | 2 | — |
| `v8.startCpuProfile` (sync) | v25.0.0, v24.12.0 | — | — |
| `v8.startHeapProfile` (sync) | v26.1.0 (not v24) | 1 | — |
| `v8.setHeapProfileNearHeapLimit` | v26.9.0 (not v24) | 1 | — |
| `worker.startCpuProfile` / `.startHeapProfile` | v24.8.0 / v24.9.0, v22.20.0 | 2 | — |
| `node inspect --probe` | v26.1.0, v24.16.0; JSON v2 + `--max-hit` v26.4.0, v24.19.0; `--cond` v26.6.0, v24.20.0 | 1 | — |
| inspector `DOMStorage.*` | v25.5.0, v24.16.0 | 1.1 | `--experimental-storage-inspection` |
| Built-in channels | see rules/diagnostics-channel.md | 1 | — |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Instrument a library (APM)

```js
import { tracingChannel } from 'node:diagnostics_channel';
const ch = tracingChannel('mylib.db.query'); // once, at module top level
export function query(sql) {
  if (!ch.hasSubscribers) return run(sql);
  return ch.tracePromise(run, { sql }, null, sql);
}
// APM side: ch.start.bindStore(als, (ctx) => span(ctx)); ch.subscribe({...})
```

## Scoped context with `using`

```js
{ using _ = als.withScope(store); syncWork(); } // restored on exit/throw
{ using _ = ch.withStoreScope(msg); }          // enter bound stores + publish
{ using _ = bounded.withScope(ctx); }          // tracing:<name>:start ... end
```

## Profile a section

```js
const h = v8.startCpuProfile({ sampleInterval: 1 }); hot();
writeFileSync('x.cpuprofile', h.stop()); // JSON string; `using` discards
// worker.startCpuProfile() is async: await handle.stop()
```

## Logpoint without editing code

```sh
node inspect --json --probe src/app.js:42 --expr 'user.id' --cond 'user.admin' --max-hit 5 app.js
```

## Pitfalls

- A `using` scope opened in an `async` function before the first `await` leaks into the caller; use `als.run()`.
- `boundedChannel.run()` sets neither `ctx.result` nor `ctx.error`. A bound store makes `hasSubscribers` true.
- `tracePromise` (v26+) returns thenables as-is, non-thenables with a warning; v24 wraps both in a Promise.
- `defaultValue` applies only when no store was entered; `run(undefined)`/`exit()` give `undefined`.
- One heap profile at a time. `setHeapProfileNearHeapLimit` needs an active `startHeapProfile()`.
- Before v24.20, `--cond` is rejected with a misleading "Use --" usage error.
- `v8.queryObjects` is documented Stable but still warns `ExperimentalWarning`.

## Don't

- Don't monkey-patch modules or use `async_hooks.createHook` for tracing: use channels + `bindStore`.
- Don't use `enterWith()` for block scope (`withScope()`) or `console.log` edits to inspect values (`--probe`).

## Reference

- [rules/diagnostics-channel.md](rules/diagnostics-channel.md): bounded channels, scopes, tracePromise history, built-in channel names.
- [rules/async-context.md](rules/async-context.md): `withScope`/`RunScope`, constructor options.
- [rules/profiling.md](rules/profiling.md): handle options, output formats, near-heap-limit, workers, `queryObjects`.
- [rules/probe-mode.md](rules/probe-mode.md): `--probe` syntax, JSON v2 schema, terminal events, exit codes.
- [rules/inspector.md](rules/inspector.md): Network/DOMStorage CDP events and flags.
