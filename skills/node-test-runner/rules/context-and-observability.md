# Test context and observability

## `context.log(message[, data])` and `'test:log'` (v26.6.0, v24.20.0)

`TestContext` and `SuiteContext` both have this method. It emits `'test:log'`
**immediately**, in execution order. `context.diagnostic()` is different: its
output is buffered and appears after the test's result.

```js
test('fetch', (t) => {
  t.log('fetched user', { userId: 42 });   // data is passed through untouched
});
describe('suite', (s) => { s.log('suite ready'); });
```

- With process isolation, `data` must be structured-cloneable. Verified:
  `{ userId: 42 }` arrives deep-equal in the parent's `'test:log'` event.
- Event fields: `message`, `data`, `name`, `nesting`, `testId`, `parentId`,
  `file`, `line`, `column`, and `entryFile` (isolation only).
- The spec reporter prints `ℹ <message>` and TAP prints `# <message>`. The
  reporters do not print `data`, so read it in a custom reporter or from a
  `run()` stream.
- Not available on v24.19 or earlier on the 24 line. There, use
  `t.diagnostic()`, which is buffered and takes no data.

## `getTestContext()` (v26.1.0, v24.19.0)

`import { getTestContext } from 'node:test'` returns the current context from
anywhere, including helper modules and code after `await`. This removes the
need to thread `t` through helpers.

| Called from | Result (verified, main and v24.19.0) |
| --- | --- |
| module top level | `undefined` |
| test body or async work inside it | that test's `TestContext` |
| `setTimeout` callback scheduled by a test, even firing after the test ended | still that test's context (async context propagates) |
| `describe()` callback | a context whose `name` is the suite name. It is a `TestContext` instance, **not** the `SuiteContext` passed to the callback |
| `beforeEach`/`afterEach` declared in a suite | the **suite's** context, not the test's. Use the hook's `t` argument for the test |
| `t.beforeEach()` registered on a test | that test's context |

The docs say "a setTimeout callback after execution has completed returns
`undefined`" and "a suite returns `SuiteContext`". The observed behavior,
shown in the table, differs from both.

## `context.workerId` (v25.8.0, v24.15.0)

- With `--test-isolation=process` (the default), each concurrently running
  file has an id from 1 to N. Ids are reused once a file finishes, and two
  running files never share one. With `--test-isolation=none` the id is
  always `1`.
- It is also available at import time as `process.env.NODE_TEST_WORKER_ID`.
- It is `undefined` when the file is run with plain `node file.test.mjs`
  (without `--test`).
- Use it to split ports, database names and temp directories per worker.
  It replaces `JEST_WORKER_ID` and `VITEST_POOL_ID`.

## `context.attempt` and `context.passed`

- `TestContext.attempt` is zero-based and increases on each
  `--test-rerun-failures` run in which the test is executed. The docs list
  it as `added: v25.0.0` only, but it works on v24.19.0 (verified).
- `SuiteContext.attempt`, `SuiteContext.passed` and
  `SuiteContext.diagnostic()` are v26.1.0, v24.16.0.
  `TestContext.passed`/`error` are older (v21.7.0, v20.12.0).
- Pitfall (verified): inside the suite's own `after()` hook,
  `suiteContext.passed` is still `false`, even when every child test passed.
  `TestContext.passed` is likewise `false` before the test finishes, for
  example in `beforeEach`.

## Tracing channel: `node.test` (v26.1.0, v24.16.0)

The runner publishes to `diagnostics_channel.tracingChannel('node.test')`:

| Channel | Payload |
| --- | --- |
| `tracing:node.test:start` | `{ name, nesting, file, type: 'test' \| 'suite' }` |
| `tracing:node.test:end` | same |
| `tracing:node.test:error` | same + `error` |

A test's span covers its `before`/`beforeEach`/`afterEach` hooks and the body.
`bindStore()` makes a per-test store visible inside the test and in all of its
async work. This is the hook for OpenTelemetry spans:

```js
import dc from 'node:diagnostics_channel';
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage();
const ch = dc.tracingChannel('node.test');
ch.start.bindStore(als, (d) => ({ span: tracer.startSpan(d.name) }));
ch.end.subscribe(() => als.getStore()?.span.end());
ch.error.subscribe((d) => als.getStore()?.span.recordException(d.error));
```

- Subscribe in the process that runs the tests. With process isolation, that
  is each test file's process, so use `--import ./otel.mjs` (children inherit
  `execArgv`; verified: `node --import ./otel.mjs --test` traces each test in
  its own child) or `--test-isolation=none`. A subscriber in the `run()`
  parent only sees the per-file tests (named by file path) and `'<root>'`,
  never the tests inside the files.
- Verified: when the file is run in-process, `start` also fires for an
  internal test named `'<root>'`. Filter it out.
- A test that fails as expected under `expectFailure` still emits `error` and
  then `end`.

## `'test:interrupted'` (v25.7.0, v24.15.0)

This event fires on SIGINT and lists the tests that were running at that
moment. With process isolation the names are file paths. Not verified here
because it needs an interactive SIGINT.
