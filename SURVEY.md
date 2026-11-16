# Survey: Node.js features likely missing from agent training data

Source: `nodejs/node` `main` at `ab476eccd03` (v28.0.0-pre), taken 2026-11-16.
Method: parsed the YAML metadata in `doc/api/*.md`. To reproduce, or to update
this survey, run `node tools/survey.mjs --node-dir ../node --since v24.0.0 --changes`.
This survey includes:

* every API whose **earliest** `added:` version is v24.0.0 or later (651 entries);
* every `changes:` entry from v24 or later that adds an option, changes a
  default, promotes a feature's stability, or removes something (356 entries).

The earliest version matters because many features landed on `main` as
v25 or v26 and were backported to v24.x. A version such as "24.21" means the
feature is available on v24 LTS from that release on. Skills must give the
full version list from the YAML, not just the earliest version.

Stability levels: **E** Experimental (1), **ED** Early development (1.0),
**AD** Active development (1.1), **RC** Release candidate (1.2), **S** Stable (2).

---

## 1. Entirely new modules / subsystems

| Module | Since | Stability | Size of doc | Notes |
|---|---|---|---|---|
| `node:bench` + `--bench*` flags | 26.9 | E / ED | 989 lines | Built-in benchmark runner: `bench`, `suite`, `doNotOptimize`, hooks, reporters, isolation, GC modes, warmup/samples |
| `node:zlib` ZIP support | 26.8 | ED | ~85 APIs | `ZipFile` (on-disk, mutable, `compact`), `ZipBuffer` (in-memory), `ZipEntry` (`create`, `createStream`, `createSymlink`, `read`), `zipFiles`, `createZipArchive`, max content size guard |
| `node:zlib` iterable compression | 25.9 | E | — | `compressGzipSync`, `decompressZstdSync`, etc. as `stream/iter` transforms; `zlib.crc32c` (27.0) |
| `stream/iter` (`--experimental-stream-iter`) | 24.20 | E | 2426 lines | New iterable stream model: sources, pipelines, push streams, duplex channels, consumers, multi-consumer, `dump()`; `filehandle.pull/pullSync/writer`; `readable[Symbol.for('Stream.toAsyncStreamable')]` |
| `node:vfs` | 26.4 (unflagged 27.0) | E | 845 lines | Virtual file system: `vfs.create`, providers (`Memory`, `Composable`, `RealFS`, `Zip`), module-loader integration, `--vfs-load`, `--allow-fs-vfs`, SEA assets |
| `node:ffi` | 26.1 | E | 1066 lines | `dlopen`/`dlsym`, signature objects, pointer/memory helpers, call via function pointers; gated by `--allow-ffi` |
| `node:quic` | 23.8 (docs grew heavily in 24.16+) | ED / AD | 4915 lines | `quic.connect`, `quic.listen`, endpoints, sessions, streams, stats |
| `node:dtls` | 26.9 | AD | 1272 lines | `dtls.listen`/`connect`, PSK, SNI, session resumption, DoS controls |
| `net/promises` | 27.0 | E | — | `netPromises.connect`, `netPromises.listen`, `server[Symbol.asyncIterator]` |
| Web `Worker` global | 26.9, on by default on main | E | — | Web-compatible `Worker`; `"worker"` export condition; `--no-worker-snapshot` |
| `--build-sea` | 25.5 | AD | — | Single executable apps built by node itself; VFS-backed assets (26.9) |

## 2. Named examples (what prompted this work)

### `--process-timeout` (26.11, AD)
`--process-timeout=duration`, `--report-on-process-timeout`, and
`subprocess.timedOut` (27.0). See the project memory for design decisions
that are already settled (no `NODE_OPTIONS`, children inherit the flag, etc.).

### `Histogram` statistics (`perf_hooks`, 24.21 to 26.11)
* Distribution: `cdf`, `ccdf`, `countAt`, `percentilesAt`, `skewness`,
  `kurtosis`, `linearBuckets`, `logBuckets`, `qrde` (density estimate).
* Inference: `meanCI`, `percentileCI`, `welchTest`, `mannWhitneyTest`,
  `ksTest`, `cohensD`, `cliffsD`.
* Online: `ewmaMean`, `ewmaStddev`, `ewmaErrorRate`, `burnRate(sloTarget)`,
  `recordCorrected` (coordinated-omission correction).
* Lifecycle: `snapshot`, `diff`, `subtract`, `resetCount`, `export` and
  `importHistogram` (format v2), `Symbol.dispose`,
  `createSlidingWindowHistogram`.
* `monitorEventLoopDelay` options `lowest`, `highest`, `figures`,
  `samplePerIteration`; top-level `perf_hooks.eventLoopUtilization` and
  `timerify` aliases.

## 3. Additions to existing modules

**Test runner**: test tags with `--experimental-test-tag-filter`,
randomized order (`--test-randomize`, `--test-random-seed`),
`--test-rerun-failures`, `--test-global-setup`, `--test-forbid-only`,
expected failures, `context.log`/`test:log`, `context.workerId`,
`context.attempt`, `context.passed`, `getTestContext()`, OpenTelemetry
instrumentation, mock helpers (`mockReturnValue`, `mockResolvedValue`,
`mockRejectedValue`, `mockThrownValue`), `context.assert.called`,
`callCount`, `nthCalledWith`, `lastCalledWith`,
`--test-coverage-include-all`, `run({ env })`. Watch mode is now **S** (27.0).

**Crypto / WebCrypto (post-quantum and more)**: ML-KEM, ML-DSA, SLH-DSA,
hybrid KEM; `crypto.encapsulate`/`decapsulate`; `subtle.encapsulate*`,
`subtle.decapsulate*`, `subtle.getPublicKey`, `SubtleCrypto.supports`;
Argon2 (`crypto.argon2`, WebCrypto `Argon2Params`); KMAC; SHA-3, SHAKE,
cSHAKE, TurboSHAKE, KangarooTwelve; AES-OCB, ChaCha20-Poly1305, SIV and
GCM-SIV; `crypto.createMac`/`Mac`/`getMacs` (RC); `crypto.parsePKCS12`;
`crypto.randomUUIDv7`; X.509 generation (`generateX509Certificate[Sync]`,
RC, 27.0) plus inspection getters; `'raw-public'`, `'raw-private'`,
`'raw-seed'` key formats; OpenSSL STORE URLs in `createPrivateKey`;
FIPS indicator events.

**SQLite**: `Database` (the new name for `DatabaseSync`, see §5),
`createTagStore`/`SQLTagStore` (tagged-template SQL with a statement cache),
`setAuthorizer`, `enableDefensive` (defensive mode is now on by default),
`limits`, `serialize`/`deserialize`, `createModule` (virtual tables),
`statement.close`, `statement.stat` and `resetStats`, `prepare({ persistent })`,
`Symbol.dispose`. The module is now **RC**.

**Diagnostics**: `diagnostics_channel` bounded channels and scopes
(`boundedChannel`, `withStoreScope`, `RunStoresScope`); `TracingChannel` is
now **S**; built-in channels for crypto, the test runner, Web Locks and
SQLite. `AsyncLocalStorage.withScope`/`RunScope` and the
`defaultValue`/`name` options. Profiling handles: `v8.startCpuProfile`,
`v8.startHeapProfile`, sync variants, `using`/`Symbol.asyncDispose`,
`v8.setHeapProfileNearHeapLimit`, `worker.startCpuProfile`. Debugger
**probe mode** (`--cond`, `--max-hit`, JSON report v2). Inspector
network/WebSocket/DOMStorage events, and `--experimental-storage-inspection`.

**Permission model**: `--allow-net` (25.0), `--allow-env` (27.0),
`--allow-ffi`, `--allow-inspector`, `--allow-openssl-store`, `--allow-fs-vfs`,
`process.permission.drop()`, `--permission-audit`.

**Modules / loading**: package maps (`--experimental-package-map`),
`--experimental-import-text`, `--experimental-strip-private-modules` and the
`"private"` field in package.json, the `"worker"` condition, Wasm source-phase
imports, `require(esm)` is now **S**, `module.registerHooks` is **RC** while
`module.register()` is **EOL** (DEP0205), type stripping is **S** (the flag is
now `--no-strip-types`, and `--experimental-transform-types` was removed),
compile cache is **S** (`portable`, `readOnly`, `NODE_COMPILE_CACHE_READONLY`),
`--config-file` is **S** (renamed from `--experimental-config-file`), and the
`ERR_REQUIRE_ASYNC_MODULE` error has a `topLevelAwaitLocations` property.

**Networking / HTTP**: `net.BoundSocket` (can be sent over IPC),
`BlockList` additions (`addCIDR[s]`, `remove*`, `PRIVATE_RANGES`, `size`),
`socket.setKeepAlive({interval,count})`, type-of-service,
`dgram.bindSync`/`connectSync`, `tlsSocket.socket`, TLS certificate
compression, `http.isValidHeaderName`/`isValidHeaderValue`,
`http.websocketMask`/`websocketUnmask`, `http.setGlobalProxyFromEnv`,
`message.signal`, `writeInformation`, and the HTTP/2 options
`http1Options`, `connectionWindowSize` and `strictSingleValueFields`.

**Utilities / filesystem / globals**: `util.debounce`, `util.throttle`,
`util.isPartialDeepStrictEqual`, `util.markPromiseAsHandled`,
`util.convertProcessSignalToExitCode`, `styleText` hex colors;
`Buffer.stringLength`, `buffer.isLatin1`, `allocUnsafe(size, alignment)`,
`blob.textStream()`; `fs.mkstemp*`, `mkdtempDisposable*`, `openAsBlobSync`,
`fs.Utf8Stream`, `glob({ followSymlinks, maxDepth })`,
`stat({ throwIfNoEntry })`, `Stats` with `Temporal.Instant`; the
`URLPattern`, `navigator.locks`, `worker_threads.locks`, `ErrorEvent` and
`QuotaExceededError` globals; `process.addUncaughtExceptionCaptureCallback`;
`process.ref`/`unref` are **S**; `tty` raw modes `'raw'`/`'io'`;
`streamConsumers.bytes`; `ReadableStreamTee` with clone;
`stream.compose` is **S**; Node-API `node_api_create_object_with_properties`
and `node_api_set_prototype`.

## 4. Changed defaults and behavior (code an agent writes today may be wrong)

* `http.Server.keepAliveTimeout` default changed from 5 s to **65 s** (27.0).
* `Buffer.poolSize` default changed from 8192 to **65536** (24.18).
* `readable.read()` with no size returns **one chunk** per call (26.0).
* Accessing `localStorage` without `--localstorage-file` **throws** (26.0).
  Web storage is on by default (25.0).
* The HTTP `'upgrade'` event no longer exposes the request body raw on the
  socket (26.0).
* `dns.reverse` no longer reads hosts files (27.0).
* SQLite defensive mode is on by default (24.14).
* The REPL's top-level `await` is always on and its flag was removed (27.0).
* `process.execve` failures now throw instead of aborting (26.1).
* `fs.mkdtemp` with a `Buffer` prefix now returns a `Buffer` (27.0).
* `--use-largepages` is a no-op (26.9).

## 5. Removals and deprecations since v25 (agents will keep suggesting these)

These are End-of-Life (removed) unless marked otherwise.

* Old Buffer/stream APIs: `SlowBuffer`; the internal modules
  `node:_stream_*`, `_tls_*` and `_stream_wrap`.
* fs: `fs.rmdir({recursive})`; `fs.F_OK`, `R_OK`, `W_OK`, `X_OK` (use
  `fs.constants`); closing a `FileHandle` on GC.
* assert/process: `assert.CallTracker`; `assert.fail` with more than one
  argument; `process.on('multipleResolves')`.
* Crypto: OpenSSL engine APIs (`clientCertEngine` and similar now throw);
  `crypto.fips`; passing a `CryptoKey` to `node:crypto` APIs;
  `KeyObject.from` with a non-extractable `CryptoKey`; short GCM tags
  without `authTagLength`; SHAKE without `outputLength`.
* Constructors that now require `new`: zlib and REPL classes. For `http`
  classes this is a Runtime deprecation.
* Module loading: `module.register()` (DEP0205, EOL in docs).
* Runtime deprecations: `node:domain` (DEP0032), `require('node:_http_*')`,
  `Duplex.toWeb({type})`, calling `digest()` twice on an Hmac.
* Documentation-only deprecations: `sqlite.DatabaseSync` and `StatementSync`
  (renamed to `Database` and `Statement`), and the `.aborted`/`'aborted'`
  pattern in `node:http2` (DEP0207).

## 6. Observations relevant to skill design

* The installed general `node` skill (`~/.claude/skills/node`) still recommends
  `--experimental-strip-types`, which is already out of date. The new set
  should not duplicate it. Its focus is delta knowledge.
* Most features are Experimental or Active Development and keep changing
  (for example, the debugger probe JSON schema was bumped to v2). Skills need
  a pinned source commit and a drift check, or they will go stale.
* A large share of the 24.x entries are backports, so "Node 24 LTS has it"
  is often true. Gating by version must be precise.
