# Command-line runner and reporters

```sh
node --experimental-bench --bench file.mjs 'dir/**/*.bench.mjs'
```

- You need at least one file or glob. Quote globs. Files are sorted and run
  **serially**.
- Every `--bench*` flag needs `--experimental-bench`, otherwise you get
  "--experimental-bench is required to use --bench or related options".
- `--bench` can't be combined with `--test`, `--watch`, `--watch-path`,
  `--check`, `--eval` or `--interactive` (verified for test, watch, check,
  eval and interactive).
- Exit code `1` if any benchmark fails (verified).

| Flag | Versions | Meaning |
| --- | --- | --- |
| `--bench-samples=N` | v26.9.0 | overrides `samples` for every benchmark (1 to 2^32-1) |
| `--bench-warmup=N` | v26.9.0 | overrides `warmup` (0 to 2^32-1) |
| `--bench-name-pattern=re` | v26.9.0 | runs matching hierarchical names; the others are reported as skipped (`'name pattern'`) |
| `--bench-isolation=process\|none` | v26.9.0 | `process` (default): one child per file. `none`: all files in one process, sharing state and stdout |
| `--bench-reporter=spec\|json\|<module>` | v26.9.0 | repeatable; the default is `spec` |
| `--bench-reporter-destination=stdout\|stderr\|<path>` | v26.9.0 | one per reporter when more than one is given |
| `--bench-gc=none\|once\|sample` | `added: REPLACEME` (main only) | overrides every benchmark's `gc`. With process isolation it adds `--expose-gc` to children. With `none` you pass `--expose-gc` yourself (verified) |

Process isolation (verified): a child's `console.log` becomes a
`bench:diagnostic` record with `stream: 'stdout'`. Each file gets its own
`fileRunId`. Plans for a later file appear after the earlier file finishes.
Options such as `--expose-gc` given to the parent are inherited by the
children.

## Reporters

- `spec` prints a table of samples, mean rate, 95% CI, median and warnings.
  `noisy` means CV > 5%, `skewed` means |skewness| > 1, and `implausible` means
  a median ≥ 1 op/ns, which usually indicates eliminated work. On main the
  table starts with an environment header (node, V8, CPU, memory, load,
  execArgv). v26.13.0 has no header.
- `json` writes NDJSON `{ type, data }`. Bigints such as `duration_ns` become
  decimal **strings**, and non-finite numbers become `null`. On main the first
  record is `bench:environment`. v26.13.0 doesn't emit it.
- Programmatic use: `import { spec, json } from 'node:bench/reporters'`, then
  `run().compose(spec).pipe(process.stdout)`.
- Custom reporter: a module whose default export is an async generator
  function `async function* (source) { for await (const { type, data } of source) yield '...'; }`,
  passed as `--bench-reporter=./reporter.mjs`.
- Observed on main ab476eccd03: with `--bench-reporter=./custom.mjs
  --bench-reporter=json` (custom first), the json destination stayed empty.
  With json listed first, both reporters wrote output.

## `runFile(path[, { env, execArgv, signal }])` (v26.9.0)

This runs **one** module in a new child process and returns a
`BenchmarksStream`. Records keep bigint values because they use advanced
serialization. `execArgv` replaces the inherited options and must not contain
benchmark runner flags: passing `--experimental-bench` throws
`ERR_INVALID_ARG_VALUE` (verified). `NODE_OPTIONS` is removed, so pass options
through `execArgv`. A load error in the module becomes a `bench:diagnostic`
plus `bench:summary { success: false }`. It does not throw (verified on v26.13
with a missing export). Globbing, ordering and retries are up to the caller.
