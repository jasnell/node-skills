# Permission scopes, flags, and errors

`--permission` turns on enforce mode. Every scope below is then denied until the
matching flag grants it. All behavior was checked on v24.19.0, v26.13.0 and
v28.0.0-pre (main at `ab476eccd03`).

| Flag | Gates | Denial (`code` / `permission` / `resource`) | added | Stability | v24.19 | v26.13 | main |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `--allow-fs-read=<path\|*>` | `node:fs` reads, module loading | `ERR_ACCESS_DENIED` / `FileSystemRead` / path as passed | v20.0.0 | 2 | yes | yes | yes |
| `--allow-fs-write=<path\|*>` | `node:fs` writes | `ERR_ACCESS_DENIED` / `FileSystemWrite` / path as passed | v20.0.0 | 2 | yes | yes | yes |
| `--allow-child-process` | `child_process.*` | `ERR_ACCESS_DENIED` / `ChildProcess` / command (`/bin/sh` for `exec*`) | v20.0.0 | 1.1 | yes | yes | yes |
| `--allow-worker` | `new Worker()` | `ERR_ACCESS_DENIED` / `WorkerThreads` / `''` | v20.0.0 | 1.1 | yes | yes | yes |
| `--allow-addons` | `process.dlopen`, `.node` files | `ERR_DLOPEN_DISABLED` (no `permission`) | v21.6.0, v20.12.0 | 1.1 | yes | yes | yes |
| `--allow-wasi` | `new WASI()` | `ERR_ACCESS_DENIED` / `WASI` / `''` | v22.3.0, v20.16.0 | 1.1 | yes | yes | yes |
| `--allow-inspector` | `Session#connect` (`resource: 'Connect'`), `inspector.open` (`'StartIoThread'`); SIGUSR1 no longer opens the debugger | `ERR_ACCESS_DENIED` / `Inspector` | v25.0.0, v24.12.0 | 1.0 | yes | yes | yes |
| `--allow-net` | `net` listen/connect, `dns.lookup`, `fetch`, `http` | `ERR_ACCESS_DENIED` / `Net` / `''` | v25.0.0 | 1.1 | **bad option, network ungated** | yes | yes |
| `--allow-ffi` | `node:ffi` `DynamicLibrary`/`dlopen` | `ERR_ACCESS_DENIED` / `FFI` / `''` | v26.1.0 | 1.1 | bad option | yes | yes |
| `--allow-openssl-store` | `crypto.createPrivateKey(URL)` (STORE loaders) | `ERR_ACCESS_DENIED` / `OpenSSLStore` / `''` | v26.7.0, v24.21.0 | 1.1 | bad option (24.19 < 24.21) | yes | yes |
| `--allow-fs-vfs` | `vfs.mount()` | `ERR_INVALID_STATE` ("VFS cannot be used when the permission model is enabled") | v26.9.0 | 1.1 | bad option | yes (`node:vfs` needs `--experimental-vfs`) | yes |
| `--allow-env=<name\|prefix*\|*>` | which env vars survive startup | no throw: the var is `undefined` plus a one-time warning | v27.0.0 | 1.1 | bad option, env ungated | bad option, env ungated | yes |

Error message text: `Access to this API has been restricted. Use --allow-<x> to
manage permissions.` Network errors from `connect()` are emitted async with the
message prefix `connect ERR_ACCESS_DENIED`. `listen()` throws synchronously from
`bind`. `dns.lookup` errors have `syscall: 'getaddrinfo'` and no `permission`.
`fetch()` rejects with `TypeError: fetch failed`, and the denial is in
`err.cause.code`. Uncaught fs errors print as
`Error [ERR_ACCESS_DENIED]: ...` on v26+ and as `Error: ...` on v24.

## `--allow-net` takes no host list

The docs describe a boolean flag. In practice, any value is accepted and
ignored: `--allow-net=192.0.2.1` and even `--allow-net=false` grant **all**
network access (verified on v26.13.0 and main). To restrict a process to one
host, use OS controls such as a firewall, `unshare -n`/netns, or a container
network policy. Another option is to keep the untrusted process off the network
and proxy its requests over IPC through a trusted parent. `--allow-net` prints
`ExperimentalWarning: The flag --allow-net is under experimental phase.`

## File system paths

- Repeat the flag for several paths. A comma inside one value is not a
  separator (since v20.7.0); it prints a warning.
- Relative paths resolve against the cwd. An *existing* directory gets an
  implicit `/*`, so `--allow-fs-read=./data` covers `data/a.txt`, but **not**
  `data2`. For a directory that does not exist yet, write `dir/*` yourself.
- Everything after a `*` is ignored: `/home/*.js` behaves like `/home/*`.
- The entrypoint and `-r` preloads are readable implicitly (v24.2.0, v22.17.0),
  exactly as passed. `node --permission .` grants the whole directory;
  `node --permission index` (no extension) does not grant `index.js`.
- Static imports of sibling files need a grant. Without one, they fail with
  `FileSystemRead` and the absolute path of the file.
- Not covered: fd-based operations (`fsync`, `fchmod`, `fchown`, `futimes`)
  always throw. Other uses of existing fds bypass the model. Symlinks are
  followed outside the granted paths. `node:sqlite` file access is not
  checked, and SQLite extensions cannot be loaded.
- STORE loaders (`--allow-openssl-store`) and FFI read files without any
  `fs.read` check. A PEM file loaded through a `file:` URL works with no
  `--allow-fs-read` at all.

## Warnings

Each of `--allow-child-process`, `--allow-worker`, `--allow-addons`,
`--allow-wasi`, `--allow-inspector`, `--allow-ffi` and `--allow-openssl-store`
prints `[PERM0002] SecurityWarning: The flag ... must be used with extreme
caution. It could invalidate the permission model.` `--allow-fs-vfs` and
`--allow-env` print nothing.
