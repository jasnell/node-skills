# require(esm)

Sources: `doc/api/modules.md` ("Loading ECMAScript modules using
`require()`"), `errors.md` (`ERR_REQUIRE_ASYNC_MODULE`), `packages.md`
(`"module-sync"`).

## History

| Version | Change |
| --- | --- |
| v22.0.0, v20.17.0 | added behind `--experimental-require-module` |
| v23.0.0, v22.12.0, v20.19.0 | unflagged |
| v23.5.0, v22.13.0, v20.19.0 | no warning by default (`--trace-require-module` shows uses) |
| v25.4.0, v24.15.0 | **Stable** |
| v26.5.0, v24.20.0 | `ERR_REQUIRE_ASYNC_MODULE` gets `requireStack` and `topLevelAwaitLocations`; `--experimental-print-required-tla` locates TLA without evaluating |

Feature detect with `process.features.require_module === true`. Disable it
with `--no-require-module`.

## Rules

`require()` loads an ES module when the module graph has **no top-level
`await`** and the file is one of these:

- `.mjs`;
- `.js` with the nearest `package.json` `"type": "module"`;
- `.js` without `"type": "commonjs"` that contains ESM syntax (syntax
  detection).

It returns the **module namespace object**, the same as `import()` but
synchronous:

```js
const ns = require('./lib.mjs');   // [Module: null prototype] { default: …, named: … }
ns.default; ns.named;
```

- When a `default` export exists, the namespace also has
  `__esModule: true`, for transpiler interop. This is experimental, so
  hand-written CJS should not depend on it.
- To make `require()` return a value directly, export it under the string
  name `'module.exports'`:
  ```js
  export default class Point { static distance = distance; }
  export { Point as 'module.exports' };   // require('./point.mjs') === Point
  ```
  Named exports are then lost to CJS consumers. Attach them to the exported
  value.
- The `"module-sync"` export condition matches for `import` **and**
  `require`. Use it to ship one ESM entry for both, as long as it has no
  TLA.

Verified on v24.19.0 and main: the namespace shape, `__esModule`,
`'module.exports'`, syntax-detected `.js`, and `"module-sync"` winning for
both `require` and `import`.

## `ERR_REQUIRE_ASYNC_MODULE`

Thrown when the required module, **or anything it imports**, uses top-level
`await`. Fix it with `await import()`, or by removing the TLA.

The error has these **non-enumerable** properties (v26.5.0, v24.20.0;
verified on v26.13.0 and main, absent on v24.19.0):

- `requireStack` {string[]}: the chain of CJS filenames that led to the
  failing `require()`, starting with the direct requirer.
- `topLevelAwaitLocations` {Object[]}: `{ url, line, column, sourceLine }`,
  1-based. This is `undefined` unless `--experimental-print-required-tla` is
  on.

```js
try { require('./tla.mjs'); } catch (e) {
  if (e.code === 'ERR_REQUIRE_ASYNC_MODULE') console.error(e.requireStack, e.topLevelAwaitLocations);
}
```

When the flag is on and the error is uncaught, Node prints the TLA locations
to stderr.

## Related

- `ERR_REQUIRE_CYCLE_MODULE`: a cycle between `require(esm)` and `import`.
- Hooks registered with `module.registerHooks()` apply to `require()` as well
  as `import`. See [hooks.md](hooks.md).
