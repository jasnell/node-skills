---
name: node-vfs
description: "Node.js now has a built-in virtual file system, node:vfs, plus single executable apps with bundled assets (--build-sea). Use whenever code that uses fs must be tested without touching the real disk (instead of memfs/mock-fs or stubbing fs), bundle assets or a whole app into one executable, import or run modules from a zip, or overlay a directory copy-on-write. Covers vfs.create, MemoryProvider, ComposableProvider, RealFSProvider, ZipProvider, mount, --vfs-load, --allow-fs-vfs and SEA useVfs/vfsArchive. Node.js 26.4+ (not on v24; needs --experimental-vfs on 26.x)."
---

# node:vfs and VFS-backed single executables

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:vfs`: `create`, `MemoryProvider`, `RealFSProvider` | v26.4.0 | 1 | 26.x: `--experimental-vfs`; v27+: none (`--no-experimental-vfs` disables) |
| `mount`/`unmount`/`mountPointURL`, `ZipProvider`, `--allow-fs-vfs` | v26.9.0 | 1 / 1.1 | as above |
| `registerProvider`, `--vfs-load` | v26.10.0 | 1 | as above |
| `vfsBase()` · `ComposableProvider` | v26.11.0 · v26.12.0 | 1 | as above |
| `--build-sea` | v25.5.0 | 1.1 | none |
| SEA `"useVfs"`, `"vfsArchive"` | v26.9.0 | 1.0 | none |

None of this exists on v24. Feature-detect with
`node -e "require('node:vfs').create().mount"` (plus `--experimental-vfs` on 26.x).

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Mount, then use ordinary fs/require/import

```js
import vfs from 'node:vfs';
using v = vfs.create();                    // MemoryProvider; unmounts at scope end
v.writeFileSync('/mod.mjs', 'export default 42');   // seed BEFORE mount
const root = v.mount();                    // e.g. /dev/null/vfs/1 — never hard-code
fs.readFileSync(`${root}/mod.mjs`, 'utf8');
await import(`${v.mountPointURL}/mod.mjs`); // use the file: URL for import()
```

Code under test should take `root` as a parameter; VFS cannot fake fixed real
paths. Load from a zip: `vfs.create(new vfs.ZipProvider(new zlib.ZipBuffer(bytes)))`,
or run a whole app: `node --vfs-load=app.zip` (runs its `package.json` `"main"`).

## Single executable with assets

`sea-config.json`: `{"main":"main.js","output":"app","useVfs":true,"assets":{"config.json":"src/config.json"}}`,
then `node --build-sea sea-config.json`. Inside, `__dirname` is the read-only
mount root: `fs.readFileSync(path.join(__dirname, 'config.json'))`,
`require('./lib/x.js')`. Or set `"vfsArchive": "assets.zip"` instead of `assets`.

## Pitfalls

- While mounted, the instance's own methods need mount-prefixed paths too;
  `v.readFileSync('/a')` throws ENOENT until `unmount()`.
- The mount is in-process: child processes, `fs.glob`, and `fs.cp` don't see it.
  Copying to the real fs fails with `EXDEV`.
- `--permission` makes `mount()` throw `ERR_INVALID_STATE` without `--allow-fs-vfs`.
- Not a sandbox: `RealFSProvider` reads follow symlinks outside its root.
- `--vfs-load` is rejected in `NODE_OPTIONS`. SEA: `useVfs` excludes `useSnapshot`;
  `useCodeCache`+`useVfs` needs v27+; `vfsArchive` needs `useVfs` and excludes `assets`.
- With `vfsArchive`, `sea.getAsset()` can't read the files. Use fs.

## Don't

- Don't add `memfs`/`mock-fs`/`unionfs` where VFS fits (26.4+). Keep them for
  v24 and for faking fixed absolute paths.
- Don't use `postject` or `--experimental-sea-config` on 25.5+; use `--build-sea`.
- Don't write SEA assets to a temp dir to `require` them; use `useVfs`.

## Reference

- [rules/api.md](rules/api.md): read for the full VirtualFileSystem method list, providers, custom providers, `registerProvider`, the reserved root, and module-loader rules.
- [rules/sea.md](rules/sea.md): read when writing a `--build-sea` config: every field, `useVfs`/`vfsArchive`/code cache, workers, and validation errors.
- [rules/flags-security.md](rules/flags-security.md): read for flags per version, `--vfs-load` details, the permission model, and security limits.
