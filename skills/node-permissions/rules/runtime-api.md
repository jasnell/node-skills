# `process.permission` and audit mode

`process.permission` exists only when `--permission` or `--permission-audit` is
set (or a config file has a `permission` namespace). Otherwise it is
`undefined`, so guard with `process.permission?.has(...)`.

## `has(scope[, reference])` (v20.0.0)

Scopes: `fs`, `fs.read`, `fs.write`, `child`, `worker`, `net`, `inspector`,
`wasi`, `addon`, `ffi`, `env`, `openssl.store`.

- Without a reference, it asks whether the *whole* scope is granted.
  `has('fs.read')` is `false` with `--allow-fs-read=./data`.
- A relative reference resolves against the cwd.
- A `URL` (`file:` only) or `Uint8Array` reference: v26.12.0. Verified on
  v26.13.0 and main.
- An **unknown scope returns `false`** and does not throw. Scopes that the
  installed version does not gate also return `false`: on v24.19.0,
  `has('net')` and `has('env')` are `false` while the network and env are fully
  open.
- In audit mode it reports the real status (`false` for ungranted scopes),
  even though nothing is denied.

## `drop(scope[, reference])` (v26.3.0, v24.20.0, Stability 1.1)

- The drop is irreversible, and it only affects future checks. Open fds,
  sockets, children and workers keep working; close them yourself.
- Without a reference, the whole scope is dropped. `fs` drops both read and
  write.
- A reference must equal the original grant. Dropping `conf/app.json` after
  `--allow-fs-read=./conf` is a **silent no-op**: `has()` stays `true`. Drop
  `./conf` instead. A `*` grant can only be dropped as a whole scope.
- `drop('env', 'NAME')` (v27+) deletes the variable from `process.env` and from
  the initial environment block. `drop('env', 'APP_*')` or `'*'` throws
  `ERR_INVALID_ARG_VALUE`. On v26.13.0, `env` is not a gated scope, and the
  same call silently does nothing.
- An unknown scope is a silent no-op.

## Audit mode: `--permission-audit` (v25.8.0, v24.20.0)

Checks run but nothing throws. Each violation is published on
`node:diagnostics_channel`:

| Channel | Scope |
| --- | --- |
| `node:permission-model:fs` | read and write |
| `node:permission-model:net` | network |
| `node:permission-model:child` / `:worker` / `:inspector` / `:wasi` / `:addon` / `:ffi` | as named |
| `node:permission-model:openssl-store` | STORE loaders |
| `node:permission-model:env` | env reads (v27+) |

Message: `{ permission, resource, drop? }`. For example,
`{ permission: 'FileSystemRead', resource: '/etc/hostname' }` or
`{ permission: 'ChildProcess', resource: 'true' }`. `drop: true` marks messages
from `permission.drop()`.

Observed behavior:

- The channels are **also published in enforce mode**, just before the error
  is thrown (v26.13.0 and main). That makes them usable as a denial log in
  production too.
- On main, a `spawn` in audit mode publishes an `env` message for every
  inherited variable, several times each. Filter or dedupe before logging.
- `--allow-*` flags combine with audit mode to exclude scopes from the report.
- `--allow-fs-vfs` mounts are not refused or reported in audit mode.
- **Precedence:** the docs say `--permission` wins when both flags are given.
  That holds on main, but on v26.13.0 audit mode wins and nothing is denied.
  Never pass both.

```js
import dc from 'node:diagnostics_channel';
const seen = new Set();
for (const s of ['fs', 'net', 'child', 'worker', 'env'])
  dc.channel(`node:permission-model:${s}`).subscribe(({ permission, resource }) => {
    seen.add(`${permission} ${resource}`);
  });
process.on('exit', () => console.error([...seen].join('\n')));
```
Load it with `node --permission-audit --import ./audit.mjs app.js`. Then turn
the list into `--allow-*` flags.
