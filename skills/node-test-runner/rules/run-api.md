# `run()` options and coverage additions

New `run([options])` options since v24. The versions come from the `run()`
YAML `changes:` list unless the table says otherwise:

| Option | Versions | Notes |
| --- | --- | --- |
| `rerunFailuresFilePath` | v24.7.0 | Same as `--test-rerun-failures` |
| `env` | v25.6.0, v24.14.0 | Environment for the test processes. **Replaces** `process.env` (verified: `PATH` is undefined in the child). Throws `ERR_INVALID_ARG_VALUE` with `isolation: 'none'` |
| `randomize`, `randomSeed` | not in the YAML. Verified on v24.19.0, v26.13.0 and main | Same as `--test-randomize`/`--test-random-seed`. `randomSeed` must be an integer 0..4294967295 and enables randomization by itself |
| `testTagFilters` | v26.2.0, v24.19.0 | `string \| string[]`, ANDed. On v24.19.0 it ran no files at all (see the selection-and-ci rules) |
| `coverageIncludeAll` | not in the YAML. The CLI flag is v26.7.0 | Verified on v26.13.0 and main. Ignored on v24.19.0 |
| `forbidOnly` | v27.0.0 | Default: the value of `--test-forbid-only`. Ignored silently on v24/v26 |

```js
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

run({
  files: ['test/a.test.mjs'],
  env: { ...process.env, DATABASE_URL: 'postgres://localhost/test_1' }, // merge explicitly
  randomSeed: 1234,
  forbidOnly: process.env.CI === 'true',   // 27+
})
  .on('test:fail', () => { process.exitCode = 1; })
  .compose(spec)
  .pipe(process.stdout);
```

The stream also has these new events:
- `'test:log'` (v26.6.0, v24.20.0), described in the context-and-observability rules.
- `'test:interrupted'` (v25.7.0, v24.15.0), on SIGINT.
- `parentId` on events that carry a `testId` (v26.3.0, v24.19.0).
- `entryFile` on events forwarded from child processes (v26.6.0, v24.20.0).

## `--test-coverage-include-all` (v26.7.0; Stability 1; not on v24)

```sh
node --test --experimental-test-coverage --test-coverage-include-all
```

- Source files under the cwd that no test loaded are added to the report
  with 0% coverage. Verified: `unused.mjs | 0.00 | ...` appears in the spec
  coverage table.
- The candidates are still filtered by `--test-coverage-include` and
  `--test-coverage-exclude`. Test files are excluded by default.
- Combine it with `--test-coverage-lines=<n>` so that untested files fail
  the threshold. This replaces the jest/c8 `collectCoverageFrom`/`--all`
  idiom.
- Coverage itself still needs `--experimental-test-coverage` (Stability 1).
