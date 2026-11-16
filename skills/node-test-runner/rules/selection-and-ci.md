# Selecting tests and CI controls

## Test tags (v26.2.0, v24.19.0; Stability 1.0)

Declare tags with `tags: [...]` on `test()`, `it()`, `suite()` or `describe()`
(also `t.test()`). Select with `--experimental-test-tag-filter=<expr>` or
`run({ testTagFilters: expr | expr[] })`. Using tags prints an
`ExperimentalWarning`.

- Tags inherit from suite to child by **union**: `describe('db', { tags: ['db'] })`
  + `it('w', { tags: ['integration'] })` gives `['db', 'integration']`.
- Matching is case-insensitive. `t.tags` is a **frozen**, lowercased array
  with inherited tags (verified: `['DB']` reads back as `["db"]`).
- Valid tags are non-empty, contain no whitespace or `& | ! ( ) *`, and are not
  `and`/`or`/`not`. An invalid tag throws `ERR_INVALID_ARG_VALUE` where it is
  declared, and a non-array `tags` throws `ERR_INVALID_ARG_TYPE`.
- Hooks have no tags of their own. They run as part of their suite.

### Grammar (verified on v26.13.0 and main)

| Form | Meaning |
| --- | --- |
| `db` | has tag `db` |
| `integ*` | wildcard inside an identifier |
| `*` | has any tag (untagged tests are excluded) |
| `and`/`&&`, `or`/`||`, `not`/`!`, `( )` | precedence `not` > `and` > `or` |

Untagged tests have an empty tag set, so `db` excludes them and `not flaky`
includes them. Repeating the flag (or passing an array to `testTagFilters`)
ANDs the expressions. The result is also ANDed with `--test-name-pattern`,
`--test-skip-pattern` and `.only`. A malformed expression (`'a &&'`) makes
`node --test` exit non-zero with `ERR_INVALID_ARG_VALUE` before any test runs.

### v24.19.0 behavior (differs from the docs)

On v24.19.0 the filter is a **plain tag name**. The implementation lowercases
the string and checks `tags.has(filter)`:

- `--experimental-test-tag-filter=db` works, both directly and under `--test`.
- `--experimental-test-tag-filter=db --experimental-test-tag-filter=integration`
  ANDs the two filters.
- `db && !flaky`, `not flaky`, `db or x`, `*` and `integ*` select **no tests**,
  and a malformed expression exits 0.
- `run({ testTagFilters: ['db'] })` ran no test files at all.

If the code must run on 24.x, use one tag per flag and feature-detect the
grammar first. Later 24.x releases were not tested.

## Random order (v26.1.0, v24.16.0; Stability 1.0)

- `--test-randomize` shuffles the order of files and of queued tests within
  each file. The seed is printed as a diagnostic:
  `# Randomized test order seed: 42` (TAP) or `ℹ Randomized test order seed: 42` (spec).
- `--test-random-seed=<0..4294967295>` replays an order and turns on
  randomization by itself. `run({ randomize, randomSeed })` does the same
  (verified on v24.19.0, v26.13.0 and main, although the `run()` YAML history
  does not list these options).
- Both flags are rejected with `--watch` and with `--test-rerun-failures`
  (`ERR_INVALID_ARG_VALUE ... not supported with rerun failures mode`).
- Sequentially awaited subtests (`for (...) await t.test(...)`) keep their
  declaration order. `describe`/`it` siblings are shuffled.
- The parent runner propagates the seed to child processes.

## Rerun failures (v24.7.0)

`--test-rerun-failures=<path>` (or `run({ rerunFailuresFilePath })`) keeps a
JSON state file, which is created if it is missing. On the next run, only tests
that have not passed yet are executed. Tests that already passed are reported
as `✔ name (passed on attempt 0)` and are not executed again.

```json
[
  { "rr.test.mjs:3:1": { "name": "stable", "children": [], "passed_on_attempt": 0, "duration_ms": 0.6 } },
  { "rr.test.mjs:3:1": { "...": "..." }, "rr.test.mjs:4:1": { "name": "flaky", "passed_on_attempt": 1, "...": "..." } }
]
```

- The file holds one array entry per attempt. Keys are `file:line:column`, with
  a counter appended for tests that are declared repeatedly.
- Reordering or moving tests can make the runner treat a test as "passed
  earlier". Use this only with a deterministic order.
- Per the docs, failing `todo` tests count as not yet passed, so they are rerun.
- `t.attempt` is 0 on the first run and 1 on the first rerun, and so on.
- Delete the state file to start over.

## Forbid `.only` (v27.0.0; not on v24 or v26)

`--test-forbid-only` or `run({ forbidOnly: true })` fails the run when
`only: true`, `test.only`/`it.only`/`describe.only`/`suite.only` or
`t.runOnly(true)` is evaluated. The error is `ERR_TEST_FAILURE: The only option
is not allowed when forbidOnly is enabled`. It takes precedence over
`--test-only` and applies with both isolation modes. Callbacks that are never
executed are not checked.

On v24/v26 the flag is a `bad option`, and the `forbidOnly` option of `run()`
is silently ignored. Use a lint rule there.

## Global setup and teardown (v24.0.0; Stability 1.0)

```js
// test/setup.mjs
export async function globalSetup() { /* start a server, seed a database */ }
export async function globalTeardown() { /* stop it */ }
```
`node --test --test-global-setup=test/setup.mjs`

- Each function runs once per run, in the runner process. It does not run once
  per file.
- Observed on v24.19.0 and main: `process.env` values set in `globalSetup`
  are visible to the isolated test-file processes. Use this to pass a URL or
  port. Other in-memory state is not shared with the children.
- If `globalSetup` throws, no tests run, the exit code is non-zero, and
  `globalTeardown` is **not** called.
- ESM exports were verified. The docs also show CJS (`module.exports = { globalSetup, globalTeardown }`).

## Watch mode

`node --test --watch` became **Stable** in v27.0.0. On v24 and v26 it is still
Experimental. Per the docs, randomization cannot be used with watch mode,
and `shard` is incompatible with `watch`.

## Child process option inheritance

With process isolation (the default), children inherit `execArgv`,
`NODE_OPTIONS` and config-file options, except `--test`,
`--experimental-test-coverage`, `--watch`, `--test-reporter*` and
`--config-file`. The tag filter, `--test-randomize` and `--test-random-seed`
are validated in the parent and then propagated to the children.
