# Inheritance, `--allow-env`, config files, npx

## Child processes and workers

- With `--allow-child-process`, a spawned `node` child runs under the same
  model. The flags arrive via `NODE_OPTIONS` for `spawn` (v24.4.0, v22.18.0) or
  via `execArgv` for `fork`. Observed `NODE_OPTIONS` in the child:
  `--permission --allow-fs-read=* --allow-child-process`. On main,
  ` --allow-env=*` is appended, and the child inherits only the variables the
  parent kept.
- Non-Node children (shell, other binaries) are not restricted at all. That is
  why `--allow-child-process` "could invalidate the permission model".
- A `Worker` with no `execArgv` inherits the parent flags. **Any explicit
  `execArgv`, including `[]`, replaces them, and the worker runs without the
  model** (`process.permission` is `undefined`). This is intended. Repeat the
  flags in `execArgv` if you set it.
- `process._debugProcess(pid)` is not gated: a sandboxed process can make
  another same-user Node.js process open its inspector. Isolate with OS users.

## `--allow-env` (v27.0.0; not on v24/v26)

Variables are removed at startup instead of being checked on each access. They
are gone from `process.env`, `getenv()` in native code, reports, workers and
children.

- Values: `*`, `NAME`, `PREFIX*`. Repeat the flag or separate with commas:
  `--allow-env=PORT,APP_*`. Names are case-insensitive on Windows.
- Always kept: the variables Node and its deps read (`NODE_OPTIONS`, `PATH`,
  `HOME`, `TMPDIR`, `TZ`, `LANG`, `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, color
  detection vars), plus vars from `--env-file`.
- **Not kept:** `NODE_ENV`, other `NODE_*` (such as `NODE_AUTH_TOKEN`),
  `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` (grant them for `--use-env-proxy`), and
  vars that third-party OpenSSL modules need (such as `SOFTHSM2_CONF`).
- A read of a removed var returns `undefined` and warns once:
  `Warning: The permission model removed the environment variable "X" at
  startup. Use --allow-env to manage permissions.` Variables set at runtime are
  not restricted.
- On Linux, reading another process's `/proc/<pid>/environ` is denied
  regardless of `--allow-fs-read`. Reading your own needs `--allow-env=*`.
- Any `--allow-*` flag without `--permission` (or `--permission-audit`) is a
  startup error: `TypeError [ERR_MISSING_OPTION]: --permission is required`
  (verified with `--allow-fs-read` on all three binaries, `--allow-env` on main).

## Config file (`permission` namespace)

```json
{ "permission": { "allow-fs-read": ["./data"], "allow-net": true, "allow-child-process": false } }
```

| Binary | Flag name | Namespace alone enables `--permission` |
| --- | --- | --- |
| v24.19.0 | `--experimental-config-file=f` (`--config-file` is a bad option) | **no**: fails with `ERR_MISSING_OPTION: --permission is required`. Pass `--permission` too, or set `"nodeOptions": { "permission": true }` |
| v26.13.0, main | `--config-file[=f]` (v26.12.0+; the experimental names remain aliases) | yes |

- Keys are flag names without `--`. Path grants are arrays; boolean grants are
  `true`/`false`.
- When the command line or `NODE_OPTIONS` enables the model, `allow-env` in a
  config file or `--env-file` can only **narrow** `--allow-env`. Example: with
  `--permission --allow-env=APP_*` plus `"allow-env": ["*"]`, only `APP_*` vars
  remain (verified on main).
- `permission` is not valid inside the `permission` namespace (`Unknown or not
  allowed option`).

## npx

```sh
npx --node-options="--permission --allow-fs-read=$(npm config get cache)" pkg
```
npm needs read access to its cache, or to `$(npm prefix -g)` for global
installs. Without it, you get a `FileSystemRead` error. (Not exercised by the
examples.)
