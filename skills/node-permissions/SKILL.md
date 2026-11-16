---
name: node-permissions
description: "Sandboxes Node.js processes with the built-in permission model (--permission). Use to run an untrusted script; restrict a process to read-only access to a folder; block network, env, child processes, workers or addons; drop privileges after startup; audit which permissions an app needs; or handle ERR_ACCESS_DENIED. Covers --allow-fs-read/--allow-fs-write, --allow-net, --allow-env, --allow-child-process, --allow-worker, --allow-addons, --allow-wasi, --allow-ffi, --allow-inspector, process.permission.has()/drop(), --permission-audit and the config-file \"permission\" namespace. Node.js 24+ (--allow-net 25+, --allow-env 27+)."
---

# Node.js permission model

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| Permission model, fs grants | v20.0.0 (stable v23.5.0, v22.13.0) | 2 | `--permission`, `--allow-fs-read/write` |
| child, worker / addons / wasi | v20.0.0 / v21.6.0, v20.12.0 / v22.3.0, v20.16.0 | 1.1 | `--allow-child-process` etc. |
| Inspector gate | v25.0.0, v24.12.0 | 1.0 | `--allow-inspector` |
| Audit mode | v25.8.0, v24.20.0 | - | `--permission-audit` |
| `process.permission.drop()` | v26.3.0, v24.20.0 | 1.1 | - |
| OpenSSL STORE gate | v26.7.0, v24.21.0 | 1.1 | `--allow-openssl-store` |
| Network gate | v25.0.0 (**not v24**) | 1.1 | `--allow-net` |
| FFI / VFS mount gate | v26.1.0 / v26.9.0 (**not v24**) | 1.1 | `--allow-ffi` / `--allow-fs-vfs` |
| Env var filtering | v27.0.0 (**not v24/v26**) | 1.1 | `--allow-env` |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

A seat belt, not a sandbox: it does not stop malicious code.

## Read-only ./data plus network

```sh
node --permission --allow-fs-read=./data --allow-net untrusted.mjs
```
The entrypoint is implicitly readable (v24.2.0+); its imports and `node_modules` are not. **There is no per-host network grant.** `--allow-net=api.example.com` is accepted and grants *all* network. For one host, use an OS firewall, a network namespace, or a container. On v24, `--permission` does not gate the network at all.

## Errors

```js
// { code: 'ERR_ACCESS_DENIED', permission: 'FileSystemRead', resource: '../x' }  (path as passed)
// permission: FileSystemWrite | ChildProcess | WorkerThreads | WASI | Inspector | Net | FFI | OpenSSLStore
```
Net errors arrive async (`connect ERR_ACCESS_DENIED`, `resource: ''`). `fetch` rejects with `TypeError` and `err.cause.code === 'ERR_ACCESS_DENIED'`. Addons throw `ERR_DLOPEN_DISABLED`. VFS mount throws `ERR_INVALID_STATE`.

## Drop after init (v24.20+)

```js
const cfg = fs.readFileSync('conf/app.json');        // started with --allow-fs-read=./conf
process.permission.drop('fs.read', './conf');         // must match the grant exactly
process.permission.drop('child');                     // whole scope; irreversible
```

## Discover needs: `--permission-audit`

```js
dc.channel('node:permission-model:fs').subscribe(({ permission, resource }) => log(permission, resource));
```
Run with `--permission-audit`: nothing throws.

## Pitfalls

- `has()` and `drop()` with an unknown scope return `false` / do nothing, with no error. On v24, `has('net')` is `false` even though the network is open.
- Dropping a file inside a granted directory silently does nothing.
- `new Worker(f, { execArgv: [] })` runs **without** the permission model.
- `--allow-child-process` can escape the model; children inherit flags via `NODE_OPTIONS`.
- `--allow-openssl-store` and `--allow-ffi` access is not checked against `fs.read`.
- Don't pass both `--permission` and `--permission-audit`: v26.13.0 audits only.

## Don't

- `--experimental-permission` (bad option on v24+); `vm`/`vm2` as a sandbox; comma-separated `--allow-fs-*` paths; hand-scrubbing `process.env` on v27+ (use `--allow-env`).

## Reference

- [rules/scopes.md](rules/scopes.md): each flag, what it gates, path/wildcard rules, errors, warnings, versions.
- [rules/runtime-api.md](rules/runtime-api.md): `has()`/`drop()` semantics and audit channels/messages.
- [rules/propagation-and-config.md](rules/propagation-and-config.md): child/worker inheritance, `--allow-env` details, config file, `npx`.
