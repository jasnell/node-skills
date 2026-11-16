# net / dgram additions

Source: `doc/api/net.md`, `doc/api/dgram.md`, `doc/api/child_process.md`,
`doc/api/worker_threads.md` at nodejs/node `ab476eccd03`. Verified on v28.0.0-pre,
v26.13.0, and v24.19.0 by the examples named in each section.

## `node:net/promises` (v27.0.0; Stability 1; not in v24 or v26)

The docs list the version as `v27.0.0-alpha.0.0.0`. Importing it on v26.13 fails with
`ERR_UNKNOWN_BUILTIN_MODULE`. Also reachable as `require('node:net').promises`.
Example: `net-promises.mjs`.

| API | Resolves | Rejects |
| --- | --- | --- |
| `connect(options \| path \| port[, host])` (`options.signal` allowed) | connected `net.Socket` on `'connect'` | connect error (for example `ECONNREFUSED`), `AbortError`. The socket is destroyed |
| `listen(options)`: `net.createServer()` + `server.listen()` options plus `connectionListener`, `signal` | listening `net.Server` | bind error (`EADDRINUSE`), `AbortError` if aborted before listening. The server is closed |

* Aborting `listen`'s signal after it resolves closes the server.
* `for await (const socket of server)` yields each connection. It ends on `'close'` and
  rejects on `'error'`. The loop advances only after the body finishes, so dispatch
  `handle(socket)` without awaiting it, or accepts serialize. Connections keep being accepted and
  buffered while the body runs. Bound them with `server.maxConnections`.
* The module also re-exports `BlockList`, `SocketAddress`, `isIP`, `isIPv4`, `isIPv6`
  (observed; undocumented).

## `net.BoundSocket` (v26.4.0, v24.19.0)

`new net.BoundSocket({ host, port, ipv6Only, reusePort })` or `({ path })` (path: v26.7.0,
v24.20.0). It calls `bind(2)` synchronously. Examples: `bound-socket.mjs`,
`bound-socket-path.mjs`, `bound-socket-ipc.mjs`, `handle-transfer-worker.mjs`.

* `host` must be a numeric IP (`'localhost'` → `ERR_INVALID_ARG_VALUE`). Default `'0.0.0.0'`
  (`'::'` with `ipv6Only`). `port: 0` gives an ephemeral port.
* Bind errors (`EADDRINUSE`) **throw** from the constructor.
* `address()` returns `{ address, family, port }` for TCP or the path string for a pipe.
  `fd()` returns the OS fd (do not close it; `-1` on Windows). `isPipe` (v26.7.0, v24.20.0):
  its presence on the prototype is the feature probe for `path`.
* Adopt it with `server.listen(bound)`, `server.listen({ handle: bound })` (ignores host/port/path), or
  `new net.Socket({ handle: bound }).connect(...)`. The last one makes it the client's source
  address and port. When connecting to a numeric IP, `socket.localPort` is set as soon as `connect()`
  returns.
* After adoption, `address()`, `fd()`, and `close()` throw `ERR_SOCKET_HANDLE_ADOPTED`, and
  `[Symbol.dispose]()` is a no-op. A handle that is never adopted must be closed (`close()` or `using`).
  Closing a pipe bind removes its file.
* `path` cannot be combined with `host`, `port`, `ipv6Only`, or `reusePort` (`ERR_INVALID_ARG_VALUE`).
  A leading `'\0'` means the Linux abstract namespace (not tested here).

Moving a TCP bind (pipe binds cannot move):

* **Child process:** `child.send(msg, bound)` (v26.10.0, v24.22.0). The child receives it as the
  second `'message'` argument and can `listen(handle)`. On v24.19 this throws
  `ERR_INVALID_HANDLE_TYPE`.
* **Worker thread:** `worker.postMessage({ bound }, [bound])`. Listening `net.Server` and
  freshly accepted `net.Socket` objects are transferable the same way. **The docs give no version for this.**
  It was observed working on v26.13.0 and main and failing on v24.19.0 (`DataCloneError: Found
  invalid value in transferList`). Feature-detect it.
* In both cases the source behaves as adopted afterwards.

## BlockList (v26.8.0, v24.21.0)

Example: `blocklist.mjs`.

* `addCIDR('10.0.0.0/8')` and `addCIDRs([...])` detect the family from the string.
  `addAddresses([...], type)` adds many addresses in one call.
* `removeAddress`, `removeRange`, `removeSubnet`, `removeCIDR`: the arguments must exactly match the
  original add. Otherwise the call is a no-op.
* `size` equals `rules.length` without allocating. `clear()` removes every rule. Its doc block lacks the YAML
  marker, but it exists on v26.8+/v24.21+.
* `BlockList.PRIVATE_RANGES` is a frozen array: `10/8, 172.16/12, 192.168/16, 127/8, ::1/128,
  169.254/16, fe80::/10, fc00::/7`. It does **not** include `0.0.0.0/8`, `100.64/10`
  (CGNAT), or multicast. Add those yourself for SSRF guards. IPv4-mapped IPv6 is
  matched against the IPv4 rules: `check('::ffff:10.0.0.1', 'ipv6')` returns true.
* `check(addr, type)` still defaults to `'ipv4'`. Pass `'ipv6'` for IPv6 strings.
* Use it with `new net.Socket({ blockList })`, `net.connect({ blockList })`, and the
  server's `blockList` option. `toJSON()`/`fromJSON()` (v24.5.0, v22.19.0) are Stability 1.2.

## TCP keep-alive and type of service

Example: `keepalive-tos.mjs`.

* `socket.setKeepAlive({ enable, initialDelay, interval, count })` and the positional
  `setKeepAlive(enable, initialDelay, interval, count)` (v26.4.0, v24.19.0). Values are in ms;
  defaults are `interval: 1000` and `count: 10` (TCP_KEEPINTVL, TCP_KEEPCNT). Both return the socket.
  The test checked that the API accepts the values and returns the socket. It did not read back the kernel's keep-alive settings.
* `socket.setTypeOfService(tos)` / `getTypeOfService()` and `new net.Socket({ typeOfService })`
  (v25.6.0, v24.15.0). Valid range is 0–255 (otherwise `ERR_OUT_OF_RANGE`). Before connect, the value is
  cached and applied on connect. The value read back after connect matched. Platforms may mask ECN bits.

## dgram `bindSync` / `connectSync` (v26.4.0, v24.19.0)

Example: `dgram-sync.mjs`.

* `socket.bindSync({ port, address })` returns `socket.address()`. `address` must be a numeric IP.
  `EADDRINUSE` throws. `'listening'` is emitted on the next tick. It does not take part in cluster
  handle sharing.
* `socket.connectSync(port, address)` binds implicitly if needed. `remoteAddress()` is valid
  immediately. Connecting again throws `ERR_SOCKET_DGRAM_IS_CONNECTED`, and calling it during an async `bind()` throws
  `ERR_SOCKET_ALREADY_BOUND`. `ECONNREFUSED` still arrives asynchronously.
