# node:vfs API reference

Source: `doc/api/vfs.md` at nodejs/node `ab476eccd03`. Everything here is
Stability 1 (Experimental). Items marked *verified* were run on v26.13.0
(with `--experimental-vfs`) and v28.0.0-pre. The rest comes from the docs.

## Module

| Export | Added | Notes |
| --- | --- | --- |
| `vfs.create([provider][, options])` | v26.4.0 | Same as `new VirtualFileSystem(provider, options)`. Default provider is `new MemoryProvider()`. `options.emitExperimentalWarning` (default `true`). |
| `vfs.registerProvider({ name, canHandle(path, stats), create(path, stats) })` | v26.10.0 | Only affects `--vfs-load`. Register from a `--require`/`--import` preload. Newest registration is asked first, before the built-ins. Providers are offered directories as well as files. |
| `vfs.vfsBase()` | v26.11.0 | Returns `path.join(os.devNull, 'vfs')`, which is `/dev/null/vfs` on POSIX (*verified*). |
| `VirtualFileSystem`, `VirtualProvider`, `MemoryProvider` | v26.4.0 | |
| `RealFSProvider` | v26.4.0 | |
| `ZipProvider` | v26.9.0 | |
| `ComposableProvider` | v26.12.0 | |

Importing `node:vfs` emits one `ExperimentalWarning` ("VirtualFileSystem is an
experimental feature"). *Verified*: it is emitted once per process.

## VirtualFileSystem instance

| Member | Added | Notes |
| --- | --- | --- |
| `mount()` | v26.9.0 | Returns the mount point. Throws `ERR_INVALID_STATE` if this instance is already mounted (*verified*). |
| `unmount()` | v26.9.0 | Idempotent. Invalidates modules loaded from the mount. |
| `mounted` | v26.9.0 | boolean |
| `mountPoint` / `mountPointURL` | v26.9.0 | `string \| null`. The URL form is for `import()`. |
| `provider`, `readonly` | v26.4.0 | |
| `[Symbol.dispose]` | — | `using` unmounts (*verified*). |
| `promises` | — | The promise API. |

The **sync** methods have the same signatures as their `node:fs`
counterparts: `existsSync statSync lstatSync readFileSync writeFileSync
appendFileSync readdirSync mkdirSync rmdirSync unlinkSync renameSync
copyFileSync realpathSync readlinkSync symlinkSync accessSync rmSync
truncateSync ftruncateSync linkSync chmodSync chownSync lchownSync utimesSync
lutimesSync mkdtempSync mkstempSync opendirSync openAsBlob openSync closeSync
readSync writeSync fstatSync createReadStream createWriteStream watch
watchFile unwatchFile`.

The **callback** methods are `readFile writeFile stat lstat readdir realpath
readlink access open close read write rm fstat truncate ftruncate link
mkdtemp mkstemp opendir`.

The **promise** methods (`v.promises`) are `readFile writeFile appendFile stat
lstat readdir mkdir rmdir unlink rename copyFile realpath readlink symlink
access rm truncate link mkdtemp mkstemp chmod chown lchown utimes lutimes open
lchmod watch`.

Paths are POSIX-style and absolute. **Observed** on both builds: while the
instance is mounted, its own methods resolve paths under the mount point.
`v.readFileSync('/a')` throws `ENOENT`, while `v.readFileSync(`${mp}/a`)`
works. After `unmount()`, `/a` works again. Seed fixtures before you mount,
or write with mount-prefixed paths. This is not documented; see meta.json.

`Stats` objects are real `fs.Stats` instances (*verified*). `dev` is `4085`,
`blksize` is 4096, and `ino` increases monotonically.

## Through node:fs once mounted (verified on v26.13.0 and v28.0.0-pre)

These work: `readFile`/`writeFile`/`appendFile` (all three API styles),
`readdir` (`withFileTypes`, `recursive`), `opendir`, `stat`, `access`,
`realpath`, `rename` within the mount, `mkdtemp`, `fs.promises.open`
(FileHandle), `createReadStream`/`createWriteStream`, `openAsBlob`, and
`fs.watch`.

These do not work:

- `fs.glob`/`fs.globSync` returns `[]`.
- `fs.cp`/`cpSync` fails (`ENOTDIR` on `/dev/null/...`).
- `rename` or `copyFile` between the mount and the real fs fails with `EXDEV`.
- Child processes cannot see the mount, because it does not exist in the OS.

The mount point itself cannot be removed or renamed (`EBUSY`), and a recursive
`fs.rm` of it first empties it. Under the reserved root, creating or removing
entries fails with `EROFS` (*verified*). The root lists one directory per
mounted instance, and does not exist when nothing is mounted (*verified*).
Mount names are assigned at runtime. `--vfs-load` and SEA mounts used `/0`,
and `vfs.mount()` used `/1` on main and v26.13.0. Never construct mount paths
yourself.

## Module loader

- The CJS and ESM resolution algorithms are unchanged. Every fs probe they make
  goes to the VFS when the path is under a mount, and to disk otherwise. There
  is no fallback: a missing path under a mount is `ENOENT`.
- The mount acts as a filesystem root, so `node_modules` and `package.json`
  scope lookups stop at it. After that, CJS still consults `NODE_PATH` and the
  legacy global folders.
- Absolute specifiers may cross in either direction.
- `__filename` and `import.meta.url` show the VFS path, for example
  `file:///dev/null/vfs/1/mod.mjs` (*verified*). On Windows, use
  `mountPointURL` for `import()`.
- Modules are cached like disk modules. `unmount()` invalidates the cache for
  that mount.
- The docs say `.node` addons and `ffi.dlopen()` libraries inside a mount load
  from a private temporary copy. *Verified* for `ffi.dlopen()` of `libm.so.6`
  copied into a mount, on main and v26.13.0. Addons are not verified.

## Providers

### MemoryProvider (v26.4.0)

A Map-backed tree with `supportsSymlinks` and `supportsWatch`.
`provider.setReadOnly()` is one-way: after it, writes throw `EROFS`.

### RealFSProvider(rootPath) (v26.4.0)

Wraps a real directory, and `rootPath` is exposed. `..` cannot climb out of
the root (*verified*: ENOENT).

**Observed, contrary to the docs:** a symlink inside the root that points
outside it is followed by `readFileSync`, both directly and through the mount.
Only `realpathSync` refuses it, with `EACCES`. This is not a security boundary.

### ZipProvider(source) (v26.9.0)

`source` is a `zlib.ZipBuffer` (in memory, always writable) or a
`zlib.ZipFile` (on disk, writable only when opened with `{ writable: true }`).
`readonly` mirrors the source (*verified*: a ZipFile opened with `openSync`
gives `readonly === true` and writes fail with `EROFS`). Directories can be
explicit (a `dir/` entry) or implicit (a path prefix). A file opened for
writing is committed as a new entry when its handle closes. Writes go to the
`ZipBuffer` index, not to the original bytes. Call `zipBuffer.toBuffer()` to
serialize.

To build a zip with `node:zlib` (v26.8.0+), use
`createZipArchiveSync([ZipEntry.createSync(name, data), …])`, which yields
`Buffer` chunks, or `zipFiles([[src, name], …])`, which returns a Readable.
`new ZipBuffer(Buffer.alloc(0))` throws `ERR_ZIP_INVALID_ARCHIVE`.

### ComposableProvider(providers[]) (v26.12.0)

The first provider is the writable top layer, and reads search layers in
order. Directories are merged. A write to a lower file copies it up first.
Unlinking hides lower copies without deleting them (*verified*: disk is
untouched).

Limitations from the docs:

- Symlinks resolve only within their own layer.
- Traversal through a symlinked directory is not supported.
- Renaming over a directory that exists only in a lower layer is not supported.
- `watch` watches only the selected layer.
- Copy-up is synchronous, even from the async API.
- `providers` returns a copy.

### Custom providers

Subclass `VirtualProvider` and implement the primitives (`openSync`,
`statSync`, `readdirSync`, `mkdirSync`, `rmdirSync`, `unlinkSync`,
`renameSync`, …). The derived methods are inherited. Capability getters:
`readonly`, `supportsSymlinks`, and `supportsWatch` (all default `false`). An
unimplemented primitive throws `ERR_METHOD_NOT_IMPLEMENTED`, and writes on a
readonly provider throw `EROFS`. Not verified here: the full set of
primitives a provider needs is only sketched in the docs.
