# Single executable applications with `--build-sea` and VFS

Sources: `doc/api/single-executable-applications.md` and the `cli.md`
`--build-sea` entry, at nodejs/node `ab476eccd03`.

| Feature | Versions | Stability |
| --- | --- | --- |
| SEA (blob plus postject injection) | v19.7.0, v18.16.0 | 1.1 |
| `--build-sea=config`: node writes the executable itself | v25.5.0 | 1.1 |
| `"useVfs"` and `"vfsArchive"` | v26.9.0 | 1.0 |
| `"useCodeCache"` together with `"useVfs"` | v27.0.0 (changes entry; rejected on v26.13.0, *verified*) | |

v24 has no `--build-sea`. There, use the older
`--experimental-sea-config` + postject workflow, which is not covered here.

## Config (`node --build-sea sea-config.json`)

```jsonc
{
  "main": "main.js",                 // the injected entry script
  "mainFormat": "commonjs",          // or "module"
  "executable": "/path/to/node",     // optional; defaults to the running node
  "output": "app",                   // Windows: must end in .exe
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": false,
  "useVfs": true,
  "vfsArchive": "assets.zip",        // alternative to "assets"
  "execArgv": ["--no-warnings"],
  "execArgvExtension": "env",        // "none" | "env" (default) | "cli"
  "assets": { "config.json": "src/config.json", "lib/add.js": "src/lib/add.js" }
}
```

- Relative paths resolve against the **cwd**, not the config file's directory.
- The node that builds the blob must match the node that runs it. `useCodeCache`
  and `useSnapshot` must be `false` for cross-platform builds.
- macOS needs `codesign --sign - app` after building. Signing on Windows is
  optional.
- `execArgvExtension`: `"none"` ignores `NODE_OPTIONS`. `"cli"` allows
  `./app --node-options="--flag"`.
- The build took about 3 s on Linux x64 and produced a full copy of the node
  binary, about 100 MB or more (*verified*).

## Without `useVfs`

`require` loads only built-ins. `__filename` and `__dirname` come from
`process.execPath`. Read assets with `node:sea`: `getAsset(key[, enc])` (a
copy), `getAssetAsBlob`, `getRawAsset` (no copy), and `getAssetKeys`. `isSea()`
reports whether the code runs in a SEA.

## With `"useVfs": true`

- The assets are mounted read-only, and `main` runs from the mount root.
  `__dirname` is the root, for example `/dev/null/vfs/0`. Reach files with
  `path.join(__dirname, …)`, relative `require()`, and `node_modules` bundled
  as assets. Writes fail with `EROFS` (*verified* on v26.13.0 and main).
- With `"mainFormat": "module"`, `import.meta.dirname` is the mount root, and
  static and dynamic imports resolve inside it (*verified* with
  `vfsArchive`). `require` is not defined in an ESM main.
- `sea.getAssetKeys()` still lists the `assets` keys (*verified*).
- Worker threads also mount it at the same path, so `new
  Worker(path.join(__dirname, 'worker.js'))` works (docs). A VFS you create
  with `vfs.mount()` exists only in its own thread.
- `"vfsArchive": "assets.zip"` embeds the zip as-is and inflates each file
  when it is read. Then `sea.getAsset()` does not serve the files. Build the
  zip with `zlib.zipFiles([[src, name], …])`, listing each directory and file
  explicitly.
- `useCodeCache` together with `useVfs` (v27+) compiles every JS module in
  the mount at build time.

## Validation errors (*verified* on main)

| Config | Error |
| --- | --- |
| `useVfs` + `useSnapshot` | `"useVfs" is not supported when "useSnapshot" is true` |
| `vfsArchive` + `assets` | `"vfsArchive" cannot be used together with "assets"` |
| `vfsArchive` without `useVfs` | `"vfsArchive" requires "useVfs" to be true` |
| `execArgv: ["--vfs-load=…"]` | `--vfs-load cannot be used in "execArgv" …` (main only; v26.13.0 accepts it) |
| `useCodeCache` + `useVfs` on v26.13.0 | `"useVfs" is not supported when "useCodeCache" is true` |

## Native addons

The SEA docs say `.node` files can't be loaded straight from the SEA VFS. They
tell you to write the asset to a temp file and call `process.dlopen()`. The
VFS docs say addons in a mounted VFS load from a private temporary image.
Treat it as unverified and test on your target version.
