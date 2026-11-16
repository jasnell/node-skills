# More loading features

## Text modules: `with { type: 'text' }`

Flag `--experimental-import-text` (v26.5.0, v24.19.0). Stability 1.0.

```js
// node --experimental-import-text app.mjs
import message from './message.txt' with { type: 'text' };
const { default: tpl } = await import('./tpl.html', { with: { type: 'text' } });
```

- The only export is `default`: the file contents as a string, UTF-8
  decoded (verified).
- The attribute is mandatory. Without it, a `.txt` import fails with
  `ERR_UNKNOWN_FILE_EXTENSION` (verified).
- Without the flag, use `fs.readFileSync(new URL('./x.txt', import.meta.url), 'utf8')`.

## Wasm source-phase imports

Added v24.0.0. Stability 1.2. Wasm ESM integration has needed no flag since
v24.5.0, v22.19.0 (before that: `--experimental-wasm-modules`).

```js
import source libModule from './lib.wasm';                 // WebAssembly.Module, not instantiated
const again = await import.source('./lib.wasm');           // dynamic form; same object (verified)
const { exports } = await WebAssembly.instantiate(libModule, { env: { base: () => 41 } });
```

- Use this to instantiate many times, or with custom imports, while still
  resolving through the module graph (verified: two instances with
  different imports).
- `import * as M from './lib.wasm'` gives an **instance** (Stability 1.1).
  It emits an `ExperimentalWarning` on v24.19.0, v26.13.0 and main.
- Instance imports get JS String Builtins (`wasm:js-string`) automatically
  (v24.5.0, v22.19.0). The import names `wasm-js:` and `wasm:` are reserved
  (`WebAssembly.LinkError`). This was not run here.
- Without WebAssembly, you get `ERR_WEBASSEMBLY_NOT_SUPPORTED`.

## The `"worker"` export condition

Documented in `packages.md` with no version. It matches when the package is
loaded inside a **Web Worker** (the global `Worker`, including its
dependencies, `import()`, `require()` and `import.meta.resolve()`). It does
**not** match in `node:worker_threads`, even for threads started from a Web
Worker.

```json
{ "exports": { "worker": "./worker.js", "default": "./main.js" } }
```

Verified: it matches on main (v28.0.0-pre), where the global `Worker` is on
by default (`REPLACEME`, disable with `--no-experimental-web-worker`). It
did **not** match on v26.13.0, even with `--experimental-web-worker`. Treat
it as main-only.

## `import.meta.main`

v24.2.0, v22.18.0. Stability 1.0. It is `true` only in the entry module, the
ESM equivalent of `require.main === module` (verified).

```js
if (import.meta.main) await main();
```

## Compile cache

Stable since v25.4.0, v24.15.0 (`module.enableCompileCache`,
`flushCompileCache`, `getCompileCacheDir`, `constants.compileCacheStatus`).

| Option / env | Versions | Meaning |
| --- | --- | --- |
| `enableCompileCache(dir)` or `{ directory }` | v22.8.0 | the cache base directory |
| `NODE_COMPILE_CACHE=dir` | v22.1.0 | enables it. Child processes inherit it through the env, so set `process.env.NODE_COMPILE_CACHE` before starting workers |
| `{ portable: true }` / `NODE_COMPILE_CACHE_PORTABLE=1` | v25.0.0, v24.12.0 | entries keyed relative to the cache dir; survives moving the project |
| `{ readOnly: true }` / `NODE_COMPILE_CACHE_READONLY=1` | **v26.8.0** (not v24) | use the entries, never write, never create the dir |
| `NODE_DISABLE_COMPILE_CACHE=1` | v22.8.0 | wins over everything (status `DISABLED`) |

```js
import module from 'node:module';
const { status, directory, message } = module.enableCompileCache();   // never throws
if (status === module.constants.compileCacheStatus.FAILED) console.warn(message);
```

Verified behavior:

- A second call returns `ALREADY_ENABLED`.
- `getCompileCacheDir()` is **not** the `directory` you passed. It is a
  per-version subdirectory such as `<dir>/v28.0.0-pre-x64-<hash>[-<uid>]`.
  `module.md:548` implies the two are the same value.
- Portable mode drops the `-<uid>` suffix (a cache that all users share) on
  v26.13.0 and main, but **not** on v24.19.0. The docs have no version for
  this.
- With `readOnly` and a missing directory, enabling returns `FAILED` and
  creates nothing. With an existing cache, newly loaded modules add no
  entries.
- Entries are written at exit, or on `flushCompileCache()`. Cached code is
  tied to the Node.js version and V8 flags.

## `--config-file` (`node.config.json`)

Added v23.10.0, v22.16.0 as `--experimental-config-file`. Renamed and
**Stable** in v26.12.0. `--experimental-config-file` and
`--experimental-default-config-file` remain as aliases. On v24.19.0 only the
`--experimental-*` names exist (`--config-file` gives `bad option`, verified).

```sh
node --config-file app.js              # reads ./node.config.json
node --config-file=ci.json app.js      # the "=" form is required; "--config-file ci.json" is not supported
```

```json
{
  "$schema": "https://nodejs.org/dist/v26.13.0/docs/node-config-schema.json",
  "nodeOptions": { "import": ["./register-hooks.mjs"], "stack-trace-limit": 50 },
  "test": { "test-isolation": "process" }
}
```

- `nodeOptions` accepts the flags allowed in `NODE_OPTIONS`, without the
  leading `--`.
- Namespaces (`test`, `watch`, `permission`) imply their flag (`--test`,
  …). Set `"test": false` inside the namespace to stop that. This comes from
  the docs and was not run here.
- Precedence: CLI and `NODE_OPTIONS` beat the dotenv `NODE_OPTIONS`, which
  beats the config file. Verified: `--stack-trace-limit=5` on the CLI
  overrides the file.
- **Trap:** if the `NODE_OPTIONS` env var is set **at all** (even to `''`, or
  to an unrelated flag), **every** key in the file's `nodeOptions` is
  ignored. It is not a per-key merge. Verified on v24.19.0
  (`--experimental-config-file`), v26.13.0 and main. CI runners and
  wrappers often export `NODE_OPTIONS`, so unset it, or move those flags
  into the file.
- Unknown keys are an error (verified). Don't duplicate keys across
  namespaces. Never load untrusted config files.
- `"nodeVersion": <major>` targets a single major. A `"configs": [{ nodeVersion, config }]`
  array picks the first matching entry, and errors with
  "No config found for current Node.js version" when nothing matches.
  Verified on v26.13.0 and main. On v24.19.0, `nodeVersion` is accepted,
  `configs` applied nothing, and no error was raised. The docs have no
  version history for these keys.
