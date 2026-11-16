---
name: node-modules-loading
description: "Node.js now runs TypeScript .ts files directly (type stripping is Stable) and loads code differently: require() of ES modules, loader hooks with module.registerHooks (which replaces module.register and --loader), package maps and the compile cache. Use when running TypeScript without a build step or instead of tsx/ts-node, requiring ESM from CommonJS, writing or migrating loader hooks, fixing \"bad option: --loader\", resolving packages in a monorepo, or using --config-file. Covers --no-strip-types, ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, ERR_REQUIRE_ASYNC_MODULE, import with type 'text', Wasm import source, the \"worker\" condition, \"private\" packages and the compile cache. Node.js 24+."
---

# Module loading: TypeScript, require(esm), hooks, package maps

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| Type stripping, on by default | Stable v25.2.0, v24.12.0 | 2 | off: `--no-strip-types` |
| `require(esm)` | Stable v25.4.0, v24.15.0 | 2 | off: `--no-require-module` |
| `ERR_REQUIRE_ASYNC_MODULE` `.requireStack` | v26.5.0, v24.20.0 | 2 | locations: `--experimental-print-required-tla` |
| `module.registerHooks()` | v23.5.0, v22.15.0 (RC v25.4.0, v24.13.1) | 1.2 | — |
| `module.register()`, `--loader` | **removed** on main (DEP0205) | EOL | — |
| Package maps | v26.4.0, v24.20.0 | 1 | `--experimental-package-map=<file>` |
| `with { type: 'text' }` | v26.5.0, v24.19.0 | 1.0 | `--experimental-import-text` |
| TS in `"private": true` deps | v27.0.0-alpha.0.0.0 | 1 | `--experimental-strip-private-modules` |
| `"worker"` export condition | main only (verified) | 1 | — |
| Wasm `import source` | v24.0.0 (no flag from v24.5.0) | 1.2 | — |
| Compile cache `portable` / `readOnly` | v25.0.0, v24.12.0 / v26.8.0 | 2 | `NODE_COMPILE_CACHE*` |
| `--config-file` | v26.12.0 (v24: `--experimental-config-file`) | 2 | — |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Run TypeScript directly

```ts
// node app.ts   (no flag, no tsx)
import type { User } from './types.ts';   // `type` is required; the extension too
import { load } from './load.ts';
```
Only erasable syntax runs. `enum`, runtime `namespace` and parameter properties
throw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. Set tsconfig `erasableSyntaxOnly`.

## Loader hooks (sync, in-thread, for import and require)

```js
import { registerHooks } from 'node:module';
const hooks = registerHooks({
  resolve: (s, ctx, next) => s === 'virtual:x' ? { url: s, shortCircuit: true } : next(s, ctx),
  load: (url, ctx, next) => url === 'virtual:x'
    ? { format: 'module', source: 'export default 1', shortCircuit: true } : next(url, ctx),
});
hooks.deregister();
```
Preload with `node --import ./hooks.mjs app.js`.

## require(esm)

`require('./x.mjs')` returns the namespace. If the graph has top-level `await`
it throws `ERR_REQUIRE_ASYNC_MODULE`; use `await import()` instead.
`export { X as 'module.exports' }` makes `require()` return `X`.

## Pitfalls

- When a `load` hook edits `nextLoad()` output, write `{ ...result, source }`. The docs' `{ source, ...result }` keeps the old source.
- A set `NODE_OPTIONS` env var, even an empty one, makes `--config-file` ignore all of the file's `nodeOptions`.
- `.ts` under `node_modules` is refused. tsconfig `paths` is ignored; use `"imports"` (`#x`).

## Don't

- Don't use `--experimental-transform-types` or `mode: 'transform'`. Both were removed in v26.0.0.
- Don't use `module.register()` or `--[experimental-]loader`. They are removed on main.
- Don't add `--experimental-strip-types`. Type stripping is on by default.

## Reference

- [rules/typescript.md](rules/typescript.md): stripping rules, flags per version, `stripTypeScriptTypes`, private packages.
- [rules/require-esm.md](rules/require-esm.md): require(esm) rules, `__esModule`, error properties.
- [rules/hooks.md](rules/hooks.md): the `registerHooks` contract, formats, migrating from `register()`.
- [rules/package-maps.md](rules/package-maps.md): map format, resolution and errors.
- [rules/more-loading.md](rules/more-loading.md): text and Wasm imports, the `"worker"` condition, `import.meta.main` (v24.2.0), compile cache, `--config-file`.
