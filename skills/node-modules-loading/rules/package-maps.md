# Package maps (`--experimental-package-map`)

Source: `doc/api/packages.md` (Package maps), `cli.md`, `errors.md`.
Added v26.4.0, v24.20.0, so it is **not on v24.19.0 or v25.x**. Stability 1
(Experimental).

```sh
node --experimental-package-map=./package-map.json app.js
```

Package maps resolve bare specifiers from a static JSON file instead of
walking `node_modules`. They fit monorepos without symlinks or hoisting,
blocking phantom (undeclared) dependencies, and resolution with no
filesystem probing.

## Format

```json
{
  "packages": {
    "app":   { "url": "./packages/app",   "dependencies": { "@my/utils": "utils" } },
    "utils": { "url": "./packages/utils" }
  }
}
```

- Each key in `packages` is a **package ID**.
- `url` (required): a `file:` URL or a relative path, resolved against the
  map file's URL. It points at the package directory.
- `dependencies`: maps a bare specifier (as written in source) to a package
  ID. The default is `{}`.
- Different packages may map the same specifier to different IDs, which
  allows several versions side by side.
- **Do not give two IDs the same `url`.** `packages.md` says this is
  allowed ("Multiple packages for the same URL"). In practice, on v26.13.0
  and main, the whole map is rejected with `ERR_PACKAGE_MAP_INVALID`
  ("packages "a" and "b" have the same url"), which is what `errors.md`
  documents. To get two dependency sets, use two directories.

## Resolution

1. Find the importing package: the given package ID, or else the mapped
   `url` that contains the importing file.
2. If the importing file is in no mapped package:
   `ERR_PACKAGE_MAP_EXTERNAL_FILE`.
3. Look up the specifier's package name in that package's `dependencies`.
   If it is missing, the result is "not found" (verified:
   `ERR_MODULE_NOT_FOUND` from `import`), **even if the target is in the
   map**.
4. Hand the package directory to normal resolution (`exports`, `main`,
   `index.js`).

The map does not affect relative or absolute specifiers or `node:` builtins.

Verified on v26.13.0 and main (`examples/package-map.mjs`): a declared
dependency resolves through `exports`, an undeclared one fails, relative
imports are untouched, and a file outside every package gets
`ERR_PACKAGE_MAP_EXTERNAL_FILE`.

## Errors

| Code | Cause |
| --- | --- |
| `ERR_PACKAGE_MAP_EXTERNAL_FILE` | the importing file is outside every mapped package |
| `ERR_PACKAGE_MAP_INVALID` | missing file, bad JSON, no `packages`, an entry without `url`, or two entries with the same `url` (missing file, missing `url` and duplicate `url` verified) |
| `ERR_PACKAGE_MAP_KEY_NOT_FOUND` | a `dependencies` value names a package ID not in `packages` (verified) |

## Limits

The map is a single static file, read synchronously at startup. No
dynamic configuration. No cycle detection.
