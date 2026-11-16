# node:bench API reference (doc/api/bench.md @ ab476eccd03)

You need `--experimental-bench` and the `node:` scheme (`node:bench`,
`node:bench/reporters`). The module exports `bench`, `suite`, `describe`,
`before`, `after`, `beforeEach`, `afterEach`, `createRunner`, `run`, `runFile`,
`skip`/`only` (the same functions as `bench.skip`/`bench.only`) and, on main
only, `doNotOptimize`.

## `bench([name][, options], fn)` (v26.9.0)

| Option | Default | Notes |
| --- | --- | --- |
| `samples` | `30` | maximum number of measured calls; `done()` can stop earlier |
| `warmup` | `10` | calls whose samples are discarded |
| `params` | `{}` | string, finite number or boolean metadata; part of `benchId` |
| `tags` | `[]` | lowercased, deduplicated, inherited from suites |
| `timeout` | `Infinity` | ms; fails with `ERR_OPERATION_FAILED` "Benchmark timed out after N ms" (verified) |
| `signal` | | AbortSignal |
| `skip` / `only` | `false` | a `skip` string becomes the reason |
| `gc` | `'none'` | `'once'` or `'sample'`; **main only**, ignored on v26.13.0 |
| `diagnosticChannels` | `[]` | channel names subscribed to during each call (from the docs; not exercised here) |

A top-level `bench()` returns a Promise of the result. Inside a suite it
returns `undefined`. `name` defaults to `fn.name`. Declaring the same `benchId`
twice in one file is an error.

`suite`/`describe([name][, options], fn)` takes `tags`, `skip`, `only` and
`diagnosticChannels`. Suite bodies run while declarations are collected and
may be async.

Hooks (`before`, `after`, `beforeEach({ name, params, signal })`,
`afterEach(...)`) are scoped to the enclosing suite. `beforeEach` and
`afterEach` run once per **benchmark**, not per sample (verified order:
`before, beforeEach:a, beforeEach:b, …, after`).

## `BenchContext` (a new one for every warmup and every sample)

- `start()` starts timing with `process.hrtime.bigint()`. Calling it twice is
  an error.
- `end([operations[, { detail }]])` returns the sample
  `{ operations, duration_ns, rate[, detail] }`. **On v26.13.0, `operations` is
  required** (`ERR_INVALID_ARG_TYPE` otherwise). On main it defaults to `1`.
  Ending without starting, ending twice, or a zero duration is an error.
- `record({ operations, duration_ns: bigint[, detail] })` supplies an
  externally measured sample, for example timed in a worker. It cannot be
  mixed with `start()`/`end()`. On v26.13.0 `operations` is required.
- `done()` finishes after the current measured sample. It is an error during
  warmup.
- `diagnostic(message[, { level: 'info' | 'warning', detail }])` queues a
  `bench:diagnostic` record. Warmup diagnostics are emitted too (verified).
- Getters: `name`, `params`, `index` (counted separately per phase), `phase`
  (`'warmup'` | `'measurement'`) and `signal`.
- If `fn` throws, rejects, or never calls `end()` ("did not call end()"), the
  benchmark fails. Later benchmarks still run.

## `doNotOptimize(value)` (added: REPLACEME, main only)

It returns `value` and keeps it observable so the work is not dead-code
eliminated. It adds a small constant cost per call. For cheap operations,
accumulate into one value and pass that once after `end()`. It does not stop
the compiler from hoisting invariant work, so vary the inputs.

## `createRunner([{ gc, yieldBetweenSamples = true }])` / `run([options])`

`createRunner()` returns `{ bench, suite, describe, before, after, beforeEach,
afterEach, run }`. It is isolated from the module-level runner, does not
schedule automatically, and can run once (`ERR_INVALID_STATE` on a second
`run()` or on a declaration after `run()`). Its failures do **not** set
`process.exitCode` (verified).

The module-level `run()` must be called in the same turn as the declarations.
Without it, the declarations run automatically. Options: `gc`, `namePattern`
(string or RegExp), `samples`, `warmup`, `signal`, `yieldBetweenSamples`. It
returns a `BenchmarksStream`, an object-mode Readable of `{ type, data }`
(the records are also emitted as named events). A failure sets exit code 1.
**A file run with `--bench` must not call `run()`.**

## Events, in order

`bench:plan` (one per benchmark, emitted before anything runs), then
`bench:start`, `bench:sample`, `bench:complete`, `bench:diagnostic` and
`bench:summary`.

- Every event carries `runId`, `fileRunId`, `entryFile`, `benchId` (a JSON
  string of `[fileURL, namePath, params]`), `parentId` and `namePath`.
- Plan fields: `gc` (main only), `samples`, `warmup`, `timeout` (`null` when
  unset), `yieldBetweenSamples`, `selected`, and `skip` (the reason, for
  example `'name pattern'`).
- Complete fields: `name`, `namePath`, `file` (a URL), `line`, `column`,
  `tags`, `params`, `samples[]`, `summary { mean, median, min, max, stddev,
  coefficientOfVariation, confidenceInterval { lower, upper },
  medianConfidenceInterval, skewness }`, and on failure `error` or `skip`.
- Summary fields: `success`, `counts { completed, failed, skipped, total }`,
  `duration_ns` (bigint) and `file`.

Rates are operations per **second**: `1e9 * operations / duration_ns`. The
`stddev` is the population standard deviation, and the CIs are 95%.
