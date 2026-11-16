# Mocks and expected failures

## Mock value helpers (v27.0.0; not on v24 or v26)

These are methods on `fn.mock`, the `MockFunctionContext`:

| Method | Same as |
| --- | --- |
| `mockReturnValue(v)` | `mockImplementation(() => v)` |
| `mockResolvedValue(v)` | `mockImplementation(() => Promise.resolve(v))` |
| `mockRejectedValue(r)` | `mockImplementation(() => Promise.reject(r))` |
| `mockThrownValue(v)` | `mockImplementation(() => { throw v; })` |

Verified on main:
- They return `undefined`, so `fn.mock.mockReturnValue(1).mockReturnValue(2)`
  (jest chaining) throws.
- `mockImplementationOnce()` still wins for its call:
  `mockReturnValue(42)` + `mockImplementationOnce(() => 'once')` gives
  `'once', 42, 42`.
- They replace the implementation for all later calls. Call
  `fn.mock.restore()` or `mockImplementation(original)` to undo.

On v24/v26, write `t.mock.fn(() => v)`,
`fn.mock.mockImplementation(async () => v)`, and so on.

## Mock call assertions on `t.assert` (v26.12.0; not on v24)

| Assertion | Passes when |
| --- | --- |
| `t.assert.called(fn[, message])` | `fn` was called at least once |
| `t.assert.callCount(fn, n[, message])` | exactly `n` calls |
| `t.assert.nthCalledWith(fn, n, ...args)` | call `n` (**1-based**) got args deep-strict-equal to `args` |
| `t.assert.lastCalledWith(fn, ...args)` | the last call got exactly `args` |

- `fn` must be a mock from `t.mock.fn()` or `t.mock.method()` (the replaced
  method works). Passing a plain function throws `ERR_INVALID_ARG_TYPE`.
- Failures are `ERR_ASSERTION` with messages such as `Expected mock function
  to have been called 3 times, but it was called 2 times`.
  `nthCalledWith(fn, 5)` on a mock called twice fails with "called at least 5
  times".
- The args comparison covers the whole argument list:
  `lastCalledWith(fn, 'a')` fails if the call was `fn('a', 1)`. There is no
  partial or `expect.anything()` matcher. For a subset check, compare
  `fn.mock.calls.at(-1).arguments` yourself, for example with
  `assert.partialDeepStrictEqual`.
- These are `t.assert` methods, so they count toward `t.plan(n)`. Verified:
  calls that throw inside `assert.throws` also count.
- They are not on the top-level `node:assert` module. In code before 26.12,
  use `assert.equal(fn.mock.callCount(), 2)` and
  `assert.deepStrictEqual(fn.mock.calls[0].arguments, [...])`.

## Jest/vitest → node:test

| jest / vitest | node:test |
| --- | --- |
| `expect(fn).toHaveBeenCalled()` | `t.assert.called(fn)` (26.12+) |
| `toHaveBeenCalledTimes(n)` | `t.assert.callCount(fn, n)` (26.12+) |
| `toHaveBeenNthCalledWith(n, ...)` | `t.assert.nthCalledWith(fn, n, ...)`, also 1-based (26.12+) |
| `toHaveBeenLastCalledWith(...)` | `t.assert.lastCalledWith(fn, ...)` (26.12+) |
| `toHaveBeenCalledWith(...)` (any call) | no direct equivalent. Use `fn.mock.calls.some(c => isDeepStrictEqual(c.arguments, [...]))` |
| `mockReturnValue`/`mockResolvedValue`/`mockRejectedValue` | same names on `fn.mock` (27+) |
| `mockImplementation(() => { throw e })` | `fn.mock.mockThrownValue(e)` (27+) |
| `test.failing` | `it.expectFailure` / `{ expectFailure }` |
| `JEST_WORKER_ID` | `t.workerId`, `NODE_TEST_WORKER_ID` |

## Expected failures (v25.5.0, v24.14.0)

The test passes only if it throws, and fails if it does not throw.

```js
it.expectFailure('known bug', () => { ... });
it('x', { expectFailure: true }, fn);
it('x', { expectFailure: 'reason shown in report' }, fn);
it('x', { expectFailure: /message regexp/ }, fn);       // RegExp|Function|Object|Error, as in assert.throws
it('x', { expectFailure: { label: 'bug 123', match: { code: 'E1' } } }, fn);
```

Verified TAP output: `ok 2 - reason # EXPECTED FAILURE not implemented`,
`ok 4 - label+match # EXPECTED FAILURE bug 123`.

- A test that does **not** throw, or that throws a non-matching error,
  reports `not ok ... # EXPECTED FAILURE` and fails the run.
- `skip` beats `todo`, which beats `expectFailure`. A test with
  `{ expectFailure: true, skip: true }` reports `# SKIP`.
- `describe.expectFailure` exists too (verified), and it applies to suites.
- The `node.test` tracing channel still emits `error` for an expected
  failure.
