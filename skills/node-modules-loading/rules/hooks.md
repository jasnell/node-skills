# Module customization hooks: `module.registerHooks()`

Source: `doc/api/module.md` (Customization Hooks), `deprecations.md`
DEP0205.

| API | Versions | Stability |
| --- | --- | --- |
| `module.registerHooks({ resolve, load })` | v23.5.0, v22.15.0; RC from v25.4.0, v24.13.1 | 1.2 |
| `module.register(specifier, parentURL, { data, transferList })`, `--loader`, `--experimental-loader` | runtime-deprecated v26.0.0; **removed** on main (`REPLACEME`) | EOL |

Verified: on main, `module.register` is `undefined` and `--loader` /
`--experimental-loader` exit with `bad option`. On v26.13.0,
`register()` prints `[DEP0205] DeprecationWarning`. On v24.19.0 it works
silently.

## Contract

```js
import { registerHooks } from 'node:module';
const handle = registerHooks({
  resolve(specifier, context, nextResolve) { return nextResolve(specifier, context); },
  load(url, context, nextLoad) { return nextLoad(url, context); },
});
handle.deregister();          // or `using handle = registerHooks(...)` on v26+ (see below)
```

- The hooks are **synchronous**: no `async`, and they return a plain object.
  They run **in the same thread and realm** as the application, so they can
  share state through closures or globals.
- They apply to `import`, `import()`, `require()`, `require(esm)` and
  `import.meta.resolve()`. Verified: the same hook served an ESM `import()`
  and a CJS `require()`.
- `resolve(specifier, context, nextResolve)`
  - `context`: `{ conditions, importAttributes, parentURL }`. For
    `require()`, `conditions` includes `'require'`; for `import`, it
    includes `'import'`. Verified.
  - Returns `{ url, format?, importAttributes?, shortCircuit? }`.
- `load(url, context, nextLoad)`
  - `context`: `{ conditions, format, importAttributes }`.
  - Returns `{ format, source, shortCircuit? }`. `source` is a string,
    `ArrayBuffer` or `TypedArray`.
  - Final formats: `'module'`, `'commonjs'`, `'json'`, `'wasm'`,
    `'builtin'`, `'addon'`, `'module-typescript'` and
    `'commonjs-typescript'`. TS source is stripped by Node (verified).
- If a hook returns without calling `next*()`, it **must** return
  `shortCircuit: true`. Otherwise it throws
  `ERR_INVALID_RETURN_PROPERTY_VALUE` (verified).
- Several `registerHooks()` calls chain **LIFO**: the last registered runs
  first.
- If `resolve` returns a non-standard `format`, a `load` hook is required.
- When modifying the default result, **spread first, then override**:
  ```js
  const result = nextLoad(url, context);
  return { ...result, source: transform(String(result.source)) };
  ```
  The docs' example (`module.md:1003-1006`) writes
  `{ source: …, ...result }`. That silently keeps the original source
  (verified).

## Registering before the app runs

```sh
node --import ./register-hooks.mjs app.js       # ESM preload
node --require ./register-hooks.cjs app.js      # CJS preload
node --import 'data:text/javascript,import{registerHooks}from"node:module";registerHooks({...})' app.js
```

Registering hooks from the entry point only affects modules loaded **after**
the call. Static `import`s of the same file are evaluated first, so load the
app with `await import()` or `require()` after registering.

Hooks are **not** inherited by `worker_threads` unless they come from a
`--import`/`--require` preload, which workers inherit through
`process.execArgv`.

## `deregister()` / `Symbol.dispose`

`handle.deregister()` removes the hooks (verified on v24.19.0 and later).
`handle[Symbol.dispose]` is documented without a version. It is present on
v26.13.0 and main (`using h = registerHooks(…)` works, verified) but **missing on v24.19.0**, so call `deregister()` when
the code must run on v24.

## Migrating from `module.register()` / `--loader`

| Old (`register`, off-thread) | New (`registerHooks`, in-thread) |
| --- | --- |
| `async function resolve(…)` in a separate loader file | plain sync `resolve(…)` passed inline |
| `initialize(data)` hook + `register(url, { data, transferList })` | closures. The hooks share the main thread's state |
| `--loader ./l.mjs` / `--experimental-loader` | `--import ./register.mjs` that calls `registerHooks()` |
| ESM only | ESM **and** CJS |
| Async work inside hooks (fetch, async fs) | do it synchronously, or (as DEP0205 suggests) run it in your own worker thread and block the hook until the result arrives, for example with `Atomics.wait` (this pattern was not run here) |

Feature-detect across versions:

```js
import module from 'node:module';
if (typeof module.registerHooks === 'function') module.registerHooks(hooks);
else module.register('./legacy-loader.mjs', import.meta.url);   // only before v22.15 / v23.5
```
