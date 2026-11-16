---
name: node-test-runner
description: "New node:test features since Node.js 24. Use when writing or running node:test suites: tagging or filtering tests, randomizing order to expose order-dependent tests, rerunning only failures, global setup/teardown, failing on .only, expected-failure tests, asserting mock calls, logging from tests, tracing tests with OpenTelemetry, or porting jest/vitest tests (toHaveBeenCalledWith, test.failing, mockReturnValue). Covers --experimental-test-tag-filter, --test-randomize, --test-rerun-failures, --test-global-setup, --test-forbid-only, expectFailure, context.log, getTestContext(), t.assert.called/nthCalledWith and --test-coverage-include-all. Node.js 24+."
---

# node:test: what is new since v24

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `tags`, `context.tags`, `run({ testTagFilters })` | v26.2.0, v24.19.0 ¹ | 1.0 | `--experimental-test-tag-filter=<expr>` |
| Random order, `run({ randomSeed })` | v26.1.0, v24.16.0 | 1.0 | `--test-randomize`, `--test-random-seed=<n>` |
| Rerun failed only | v24.7.0 | 2 | `--test-rerun-failures=<file>` |
| Global setup/teardown | v24.0.0 | 1.0 | `--test-global-setup=<module>` |
| `expectFailure` | v25.5.0, v24.14.0 | 2 | |
| `t.workerId` | v25.8.0, v24.15.0 | 2 | |
| `t.attempt` | v25.0.0 ² | 2 | |
| `node.test` tracing channel | v26.1.0, v24.16.0 | 2 | |
| `getTestContext()` | v26.1.0, v24.19.0 | 2 | |
| `t.log()`, `'test:log'` | v26.6.0, v24.20.0 | 2 | |
| `run({ env })` | v25.6.0, v24.14.0 | 2 | |
| Include never-loaded files | v26.7.0 | 1 | `--test-coverage-include-all` |
| `t.assert.called`, `callCount`, `nthCalledWith`, `lastCalledWith` | v26.12.0 | 2 | |
| `mock.mockReturnValue` & co. | v27.0.0 | 2 | |
| Forbid `.only` | v27.0.0 | 2 | `--test-forbid-only` |
| Watch mode Stable | v27.0.0 | 2 | `--test --watch` |

¹ v24.19.0 matches plain tag names only (repeat the flag to AND); `&&`, `!`, `not`, `*` select nothing. ² Docs say v25.0.0; also works on v24.19.0.

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Mocks

```js
const send = t.mock.fn();
send.mock.mockReturnValue(true);            // 27+, returns undefined (not chainable)
notify(send);
t.assert.callCount(send, 2);                // 26.12+
t.assert.nthCalledWith(send, 1, 'a@x.dev'); // 1-based, deepStrictEqual on args
t.assert.lastCalledWith(send, 'b@x.dev');
```

## Tags, expected failures, CI flags

```js
describe('db', { tags: ['db'] }, () => {    // children inherit tags by union
  it('reconnects', { tags: ['flaky'] }, () => {});
  it('parses', { expectFailure: /unsupported/ }, () => parse('x')); // passes only if it throws a match
});
```
```sh
node --test --experimental-test-tag-filter='db && !flaky'  # grammar: 26.2+
node --test --test-forbid-only --test-rerun-failures=.test-state.json
node --test --test-random-seed=1234        # replay a printed seed
```

## Pitfalls

- Random order cannot be combined with `--test-rerun-failures` or `--watch`. Awaiting subtests one at a time keeps declaration order.
- `run({ env })` replaces `process.env` for children (even `PATH`) and throws with `isolation: 'none'`.
- Rerun state is keyed by `file:line:column`: moving a test resets it.
- Unknown flags fail with `bad option`; unknown `run()` options (`forbidOnly` on v24) are silently ignored.

## Don't

- `toHaveBeenCalledWith` → `t.assert.nthCalledWith`/`lastCalledWith` (before 26.12: `fn.mock.calls[i].arguments`).
- `jest.fn().mockReturnValue(x)` before 27 → `t.mock.fn(() => x)`.
- `test.failing` → `expectFailure`; `--forbid-only` → `--test-forbid-only`; `--shuffle`/seed → `--test-random-seed`.
- `JEST_WORKER_ID` → `t.workerId` / `NODE_TEST_WORKER_ID`. Tags in test names + `--test-name-pattern` → `tags`.

## Reference

- [rules/selection-and-ci.md](rules/selection-and-ci.md): tags, random order, reruns, forbid-only, global setup.
- [rules/context-and-observability.md](rules/context-and-observability.md): `t.log`, `getTestContext`, `workerId`, tracing/OpenTelemetry.
- [rules/mocks-and-expectations.md](rules/mocks-and-expectations.md): mock helpers, `t.assert.*`, `expectFailure`.
- [rules/run-api.md](rules/run-api.md): new `run()` options, coverage.
