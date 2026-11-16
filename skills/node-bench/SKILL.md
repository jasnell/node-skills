---
name: node-bench
description: "Node.js now has a built-in benchmark runner, node:bench. Use it whenever writing or running a JavaScript performance benchmark instead of a hand-written timing loop: \"which is faster\", measuring how fast code is, comparing two implementations, check for a performance regression, or when reaching for benchmark.js, tinybench or mitata. Covers bench, suite/describe, hooks, BenchContext start/end/record, doNotOptimize, createRunner/run, reporters, and the --experimental-bench and --bench* flags. Node.js 26.9+ only (not on v24)."
---

# node:bench

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:bench` (`bench`, `suite`, `describe`, hooks, `createRunner`, `run`, `runFile`), `node:bench/reporters` | v26.9.0 (not on v24) | 1.0 Early development | `--experimental-bench` |
| `--bench` and `--bench-*` flags (except `--bench-gc`) | v26.9.0 | 1 Experimental | `--experimental-bench` |
| `doNotOptimize`, `--bench-gc`, the `gc` option, `end()` defaulting to 1 op, the `bench:environment` record | `added: REPLACEME` (main only; absent in v26.13.0) | 1.0 | `--experimental-bench` |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## A benchmark file

```js
// parse.bench.mjs: declare only, never call run() (the CLI rejects it)
import { bench, suite } from 'node:bench';
suite('JSON', () => {
  const input = JSON.stringify({ a: [1, 2, 3] });
  bench('parse', { samples: 30, warmup: 10 }, (b) => {
    const ops = 10_000; let n = 0;
    b.start();
    for (let i = 0; i < ops; i++) n += JSON.parse(input).a.length;
    b.end(ops);                       // always pass operations (required on v26.13)
    if (n !== 3 * ops) throw new Error('wrong result'); // keep the work observable
  });
});
```

```sh
node --experimental-bench --bench 'bench/**/*.bench.mjs'   # one child process per file
node --experimental-bench --bench --bench-reporter=json --bench-samples=50 x.bench.mjs > out.ndjson
```

## Results in code

```js
import { createRunner } from 'node:bench';
const r = createRunner();             // runs only on r.run(), once
r.bench('x', { samples: 20 }, (b) => { b.start(); work(); b.end(1); });
for await (const { type, data } of r.run())
  if (type === 'bench:complete' && !data.error) use(data.samples, data.summary);
```

Each sample is `{ operations, duration_ns: bigint, rate /* ops/s */ }`.
`summary.mean` is the mean of per-sample **rates**, not pooled throughput.
To ask "is B faster than A", record integer ns or ps per op into a `Histogram`
and use `welchTest`/`mannWhitneyTest`. See the **node-histogram-stats** skill.

## Pitfalls

- Each warmup and each sample calls `fn` once with a new context, and `fn`
  must call `start()`+`end()` or `record()` exactly once. `beforeEach` runs once
  per **benchmark**, not per sample.
- A loop whose result is unused can be eliminated. The `spec` reporter flags
  ≥ 1 op/ns as `implausible`. Validate an aggregate, or use `doNotOptimize(v)`
  on main.
- A failure in a module-level run sets `process.exitCode = 1`. `createRunner()`
  runs don't.
- `gc: 'once' | 'sample'` needs `--expose-gc`. `--bench-gc` adds it to children
  automatically, except with `--bench-isolation=none`. On v26.13 `gc` is
  silently ignored.
- `--bench` can't be combined with `--test`, `--watch`, `--eval` or `--check`.

## Don't

- Don't hand-roll `Date.now()`/`performance.now()` loops: they have no warmup or
  per-sample stats.
- Don't add `benchmark.js`, `tinybench`, `mitata` or `cronometro` when Node
  ≥ 26.9 is available. Use `node:bench`.
- Don't treat a confidence interval as pass/fail. Keep the raw `samples`.

## Reference

- [rules/api.md](rules/api.md) — read for every option, BenchContext method, hook, and event/result field.
- [rules/cli.md](rules/cli.md) — read for flags, isolation modes, reporters (spec/json/custom), and runFile.
- [rules/measurement.md](rules/measurement.md) — read for warmup, GC modes, dead-code elimination, variable batches, and comparing runs.
