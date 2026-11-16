# AsyncLocalStorage additions

Source: `doc/api/async_context.md` at nodejs/node `ab476eccd03`. Verified by
`examples/als-scope.mjs` and `examples/als-options.mjs`.

## `new AsyncLocalStorage({ defaultValue, name })` (v24.0.0)

* `getStore()` returns `defaultValue` when no store has been entered.
* `als.run(undefined, fn)` and `als.exit(fn)` give `undefined` inside `fn`, not
  `defaultValue`.
* `als.name` is the given name, or `''` when none was given.

## `als.withScope(store)` → `RunScope` (v25.9.0, v24.20.0; Stability 1)

```js
{
  using _ = als.withScope(store);   // enter
  work();                           // getStore() === store
}                                   // previous store restored, also on throw
const s = als.withScope(store); /* ... */ s.dispose(); // manual; idempotent
```

* `RunScope` has `dispose()` and `[Symbol.dispose]()`. The class is not exported.
* Without `using`, a missing `dispose()` leaves the store entered for the rest of the
  current execution context. That is the same as `enterWith()`.
* **Async trap:** in an `async` function, the scope entered before the first `await`
  stays visible to the caller after it gets the promise back. This was verified:
  `await f()` followed by `getStore()` in the caller still returns the leaked store. Use
  `als.run(store, async () => ...)` for async work.
* Prefer `withScope` over `enterWith` for block-scoped sync context (request parsing,
  middleware that must restore on throw).

The diagnostics_channel counterpart is `channel.withStoreScope(data)` (v26.1.0). See
diagnostics-channel.md.
