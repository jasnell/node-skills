# Profiling handles

Source: `doc/api/v8.md`, `doc/api/worker_threads.md` at nodejs/node `ab476eccd03`.
Verified by `examples/cpu-profile.mjs`, `heap-profile.mjs`,
`heap-profile-near-limit.mjs`, `worker-profile.mjs`, `query-objects.mjs`.

| API | Returns | Versions | Stability |
| --- | --- | --- | --- |
| `v8.startCpuProfile({ sampleInterval, maxBufferSize })` | `SyncCPUProfileHandle` | v25.0.0, v24.12.0 | not stated |
| `v8.startHeapProfile({ sampleInterval, stackDepth, forceGC, includeObjectsCollectedByMajorGC, includeObjectsCollectedByMinorGC })` | `SyncHeapProfileHandle` | v26.1.0 | 1 |
| `v8.setHeapProfileNearHeapLimit(limit)` | `undefined` | v26.9.0 | 1 |
| `worker.startCpuProfile({ sampleInterval, maxBufferSize })` | `Promise<CPUProfileHandle>` | v24.8.0 | 2 (module) |
| `worker.startHeapProfile({ ...same as startHeapProfile })` | `Promise<HeapProfileHandle>` | v24.9.0, v22.20.0 | 2 (module) |
| `new v8.GCProfiler()[Symbol.dispose]` | stops and discards | v25.5.0, v24.13.1 | — |
| `v8.queryObjects(ctor, { format })` | count or `string[]` | v22.0.0, v20.13.0. Stable since v25.4.0, v24.13.1 | 2 (but warns) |

Units: CPU `sampleInterval` is in **milliseconds** (default `0`). Heap `sampleInterval` is in
**bytes** (default 524288). `stackDepth` defaults to 16.

## Sync handles (current thread)

* `handle.stop()` returns the profile as a **JSON string**. CPU profiles use the DevTools
  `.cpuprofile` shape (`nodes, startTime, endTime, samples, timeDeltas`). Heap profiles
  use the `.heapprofile` shape (`head, samples`). Save the string with that extension to
  open it in Chrome DevTools.
* A second `stop()` returns `undefined`.
* `[Symbol.dispose]` (for `using`) stops and **discards** the profile.
* Heap profile extras: each node has `selfCount`, and each sample has `objectSize`,
  `objectCount`, `isLive`. `size === objectSize * objectCount`.
* Only one sampling heap profile can be active at a time. A second
  `startHeapProfile()` throws `ERR_HEAP_PROFILE_HAVE_BEEN_STARTED`. Several CPU
  profiles can run at once.

## Near-heap-limit profile

```js
v8.startHeapProfile();               // must be active, or nothing is written
v8.setHeapProfileNearHeapLimit(1);   // up to 1 file; repeat calls are no-ops; <1 -> ERR_OUT_OF_RANGE
```

When V8 nears the heap limit, the active profile is written to `--diagnostic-dir` (or
cwd) as `Heap.<yyyymmdd>.<hhmmss>.<pid>.<tid>.<seq>.heapprofile`. The process still
dies with OOM. Writing is best-effort. This is independent of
`v8.setHeapSnapshotNearHeapLimit()`. Verified with `--max-old-space-size=40`.

## Worker handles (from the parent thread)

`await worker.startCpuProfile()` gives you a handle. `await handle.stop()` resolves to
the JSON string. `await using h = await worker.startCpuProfile()` uses
`[Symbol.asyncDispose]` to stop and discard. Calling it after `terminate()` rejects
with `ERR_WORKER_NOT_RUNNING`. Wait for the `'online'` event first.

## queryObjects

`v8.queryObjects(Ctor)` returns the count of live objects whose prototype chain has
`Ctor.prototype`, after a full GC. It is useful in leak regression tests: drop the
references and assert that it returns `0`. `{ format: 'summary' }` returns strings such as
`'Session {}'`. Avoid it for constructors you don't control. It still emits
`ExperimentalWarning` on v24.19, v26.13, and main, even though the docs mark it Stable.
