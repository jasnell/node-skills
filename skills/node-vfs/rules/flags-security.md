# Flags, versions, permissions, and security

## Enabling node:vfs (verified)

| Binary | `require('node:vfs')` | Notes |
| --- | --- | --- |
| v24.19.0 | `ERR_UNKNOWN_BUILTIN_MODULE` | `--experimental-vfs` gives `bad option`. Not available on v24. |
| v26.13.0 | needs `--experimental-vfs` | `--vfs-load` without the flag fails: "--vfs-load requires --experimental-vfs" (exit 9). |
| v28.0.0-pre (main) | works unflagged | `--experimental-vfs` is still accepted. `--no-experimental-vfs` disables both the module and `--vfs-load`. |

In `cli.md`, the `--no-experimental-vfs` entry records the change "VFS is
unflagged but still experimental" for `v27.0.0-alpha.0.0.0`. On code that
must run on 26.x, passing `--experimental-vfs` is harmless on main.

For SEAs, `"useVfs"` needs no flag. A SEA built with v26.13.0 mounted its
assets without `--experimental-vfs` (*verified*).

## `--vfs-load=source` (v26.10.0)

- `source` can be a directory, mounted with `RealFSProvider`, or a file whose
  bytes are a ZIP of any name, mounted with `ZipProvider`. Providers from
  `vfs.registerProvider()` are consulted first. A source nobody claims is an
  error (`ERR_VFS_INVALID_TARGET`, *verified* for a plain text file).
- The entry point is chosen like `node <dir>`: the mount's `package.json`
  `"main"`, or `index.js`. Positional arguments belong to the program, and
  `process.argv[1]` reports `source` (*verified*).
- The flag may be given at most once, and it is **not allowed in
  `NODE_OPTIONS`** (*verified*).
- Workers inherit the mount unless they get their own `execArgv`. In that
  case, pass `--vfs-load` again.
- It cannot be used inside a SEA.

## Permission model

- With `--permission`, `vfs.mount()` throws `ERR_INVALID_STATE` ("Use
  --allow-fs-vfs") unless you pass `--allow-fs-vfs` (v26.9.0, Stability 1.1).
  *Verified* on main.
- `--allow-fs-read` and `--allow-fs-write` do not gate VFS paths. A mounted
  VFS serves paths that those permissions don't describe.
- In `--permission-audit` mode, mounting is not refused and nothing is
  published to the diagnostics channel (docs).

## Security (docs plus observed behavior)

- VFS is **not a sandbox** or access-control mechanism. Code that can reach a
  `VirtualFileSystem` instance, or pass paths to it, is trusted code. Mounting
  redirects only `node:fs` calls under the mount point. Everything else still
  reaches the real system. For isolation, use OS users, containers, or a
  platform sandbox.
- `RealFSProvider`'s root check is not a boundary. *Observed* on v26.13.0 and
  main: a symlink inside the root that points outside it is followed by
  `readFileSync`. Only `realpathSync` rejects it, with `EACCES`.
- Mounts live under a reserved namespace that cannot exist on disk
  (`/dev/null/vfs/<n>`), so a VFS never shadows real paths. That is also why
  it cannot fake fixed paths like `/etc/app.json` the way `mock-fs` does.
