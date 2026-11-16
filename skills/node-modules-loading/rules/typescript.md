# TypeScript type stripping

Sources: `doc/api/typescript.md`, `cli.md` (`--no-strip-types`,
`--experimental-strip-private-modules`), `module.md`
(`stripTypeScriptTypes`), `packages.md` (`"private"`).

## Status by version

| Version | State |
| --- | --- |
| v22.6.0 | added behind `--experimental-strip-types` |
| v23.6.0, v22.18.0 | on by default |
| v24.3.0, v22.18.0 | no more `ExperimentalWarning` |
| v25.2.0, v24.12.0 | **Stable**; flag renamed `--no-experimental-strip-types` → `--no-strip-types` |
| v26.0.0 | `--experimental-transform-types` removed (`bad option`); `stripTypeScriptTypes` loses `mode: 'transform'` and `sourceMap` |
| v27.0.0-alpha.0.0.0 | `--experimental-strip-private-modules` + `package.json` `"private"` |

Verified on v24.19.0, v26.13.0 and main: `--experimental-strip-types` and
`--no-experimental-strip-types` are still accepted as aliases, and
`process.features.typescript === 'strip'`. On v24.19.0,
`--experimental-transform-types` still works (and warns). On v26.13.0 and
main it fails with `bad option`.

## What runs

- Only **erasable** syntax runs: type annotations, `interface`, `type`,
  `import type`, `declare`, `as`, `satisfies`, and namespaces that contain
  only types.
- These throw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` (verified): `enum`,
  `namespace` with runtime code, constructor parameter properties
  (`constructor(public x)`), and `import x = require()`.
- Decorators are a parse error (`SyntaxError`). Node does not transform
  them.
- `.tsx` is unsupported. `.mts` is always ESM and `.cts` is always CJS.
  `.ts` follows `package.json` `"type"` like `.js` does.
- Extensions are mandatory: `import './x.ts'` and `require('./x.ts')`.
- Type-only imports **must** use `type`
  (`import { fn, type Opts } from './fn.ts'`). Otherwise the import is kept
  and fails at runtime.
- `tsconfig.json` is ignored, so `paths`, `target` downlevelling and
  `experimentalDecorators` do nothing. Use the `package.json` `"imports"`
  field (`#alias`) instead of `paths`.
- No type checking. Run `tsc --noEmit` separately.
- No source maps are needed because types are replaced with whitespace, so
  columns are preserved.
- `--eval` and STDIN strip too, using `--input-type` for the module system.
  The REPL, `--check` and `inspect` do not.
- The parser needs WebAssembly. Without it you get
  `ERR_WEBASSEMBLY_NOT_SUPPORTED`.

Recommended tsconfig (from the docs, TS 5.8+):

```json
{ "compilerOptions": { "noEmit": true, "target": "esnext", "module": "nodenext",
  "rewriteRelativeImportExtensions": true, "erasableSyntaxOnly": true,
  "verbatimModuleSyntax": true } }
```

For full TypeScript (enums, decorators, `paths`) use a userland loader
(`tsx`, for example) or compile. The built-in flag for this was removed.

## `node_modules`

`.ts` files anywhere under `node_modules` throw
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. This is deliberate:
publishing TypeScript sources is discouraged.

On v27 alpha and main, `--experimental-strip-private-modules` (Stability 1)
allows them only when the **package root** `package.json` (the directory
directly under `node_modules`, or under `node_modules/@scope`) has
`"private": true`. That fits linked workspace packages. Nested
`package.json` files are ignored, and non-private packages still throw
(verified).

## `module.stripTypeScriptTypes(code[, options])`

Stability 1.2. Added v23.2.0, v22.13.0. Calling it emits an
`ExperimentalWarning`.

- `options.mode`: only `'strip'` is accepted (v26.0.0+). `'transform'` throws
  `ERR_INVALID_ARG_VALUE` on v26 and later but still works on v24.19.0.
- `options.sourceMap`: anything except `false`/`undefined` throws
  `ERR_INVALID_ARG_VALUE` (also on v24.19.0).
- `options.sourceUrl` appends `\n\n//# sourceURL=<url>`. The docs' sample
  output shows a trailing `;` that is not produced.
- Code that needs transformation throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`.
- The output is not stable across Node.js versions.

```js
import { stripTypeScriptTypes } from 'node:module';
stripTypeScriptTypes('const a: number = 1;'); // 'const a         = 1;'
```

## Loader hooks and TypeScript

`load` hooks may return `format: 'module-typescript'` or
`'commonjs-typescript'` with TS source, and Node strips it. See
[hooks.md](hooks.md).
