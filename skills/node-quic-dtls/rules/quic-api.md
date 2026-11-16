# node:quic API reference

Source: `doc/api/quic.md` at nodejs/node `ab476eccd03`. The module is
Stability 1.0 (Early development). The `--experimental-quic` CLI entry says
1.1. Items marked *verified* were run on main (v28.0.0-pre) built with
`./configure --experimental-quic`. Everything else is from the docs and was
**not run**.

## Availability

- The module itself is `added: v23.8.0`, and most core members carry that
  version.
- The runtime flag `--experimental-quic` was added in v25.0.0 and v24.16.0.
  v24.19.0 and v26.13.0 accept the flag (*verified*), but their official
  binaries are built without QUIC (`process.config.variables.node_use_quic ===
  false`), so `node:quic` is an unknown built-in there.
- Even when built in, the module is absent without the runtime flag
  (*verified*).
- About 70 members are `added: [v26.2.0, v24.20.0]`. These include
  `session.opened`, `stream.writer`, `setBody`, async iteration, HTTP/3,
  `rejectUnauthorized`, `reuseEndpoint`, `token`, and `keepAlive`. Check
  each member's YAML before you target v24.16–24.19.
- `stream.opened` is v26.10.0 only.

## Module functions

- `quic.connect(address, sessionOptions)` returns a Promise for a
  `QuicSession`. `address` is a `'host:port'` string or a `net.SocketAddress`
  (*verified*: passing `endpoint.address` works). By default it reuses or
  creates a client endpoint; set `reuseEndpoint: false` to force a new one.
  To pin the local address, pass `endpoint: QuicEndpoint | EndpointOptions`.
- `quic.listen(onsession, sessionOptions)` returns a Promise for a
  `QuicEndpoint`. Each endpoint can listen once. Put the bind address in
  `{ endpoint: { address: '127.0.0.1:0' } }` (*verified*).
- `quic.listEndpoints({ active = true })` (v26.4.0, v24.20.0).
- `quic.constants` holds `cc.RENO`, `cc.CUBIC`, `cc.BBR`,
  `DEFAULT_CIPHERS` and `DEFAULT_GROUPS`.
- Classes: `QuicEndpoint`, `QuicSession`, `QuicStream`, and
  `QuicError(message, { errorCode, type })`, which exposes `.errorCode` and
  `.type`.

## QuicEndpoint

`new QuicEndpoint(endpointOptions)`. A bare endpoint needs no `--allow-net`
until it connects or listens.

Members:

- `address`, a `SocketAddress` or `undefined`.
- `busy`, read/write. When true, the endpoint rejects new sessions.
- `close()`, a Promise. It waits for open sessions to finish.
- `closed`, `closing`, `destroy([err])`, `destroyed`, `listening`.
- `maxConnectionsPerHost` and `maxConnectionsTotal`, read/write. Range
  0–65535, where 0 means unlimited.
- `setSNIContexts(entries, { replace = false })` hot-swaps the identities
  used by new sessions.
- `stats` and `[Symbol.asyncDispose]`.

`endpoint.stats` fields (bigint): `createdAt`, `destroyedAt`,
`bytesReceived`, `bytesSent`, `packetsReceived`, `packetsSent`,
`serverSessions`, `clientSessions`, `serverBusyCount`, `retryCount`,
`retryRateLimited`, `versionNegotiationCount`,
`versionNegotiationRateLimited`, `statelessResetCount`,
`statelessResetRateLimited`, `immediateCloseCount`,
`immediateCloseRateLimited`, `sessionCreationRateLimited`, `packetsBlocked`.

### endpointOptions

| Option | Default | Notes |
| --- | --- | --- |
| `address` | IPv4 localhost, random port | |
| `blockList`, `blockListPolicy` | `'deny'` | A `net.BlockList` checked before any QUIC processing. Edits take effect live. `'allow'` makes it an allowlist. |
| `retryRate`/`retryBurst`, `statelessResetRate`/`Burst`, `versionNegotiationRate`/`Burst`, `immediateCloseRate`/`Burst` | 100/s, burst 200 | Global token buckets for stateless responses |
| `sessionCreationRate`/`Burst` | 50/s, burst 100 | Per validated remote address. Raise these for single-source benchmarks. |
| `maxConnectionsPerHost`, `maxConnectionsTotal` | 0 (unlimited) | |
| `idleTimeout` (s) | 0 | v26.2.0, v24.20.0 |
| `reusePort` | false | v26.3.0, v24.18.0 |
| `disableStatelessReset` | | v26.2.0, v24.20.0 |
| `ipv6Only`, `addressLRUSize`, `validateAddress`, `retryTokenExpiration`, `tokenExpiration`, `resetTokenSecret`/`tokenSecret` (16 bytes), `udpReceiveBufferSize`, `udpSendBufferSize`, `udpTTL` | | v23.8.0 |

## QuicSession

Events are callback properties, and each can be sync or async. If a
callback throws or rejects, the session is destroyed (for stream callbacks,
the stream), after `onerror` is called. If `onerror` itself throws, the
error becomes an uncaught exception.

- Callbacks: `onstream`, `ondatagram`, `ondatagramstatus` (`'acknowledged'`,
  `'lost'` or `'abandoned'`), `onearlyrejected`, `onpathvalidation`,
  `onsessionticket`, `onversionnegotiation`, `onhandshake`, `onnewtoken`,
  `onorigin`, `ongoaway`, `onkeylog`, `onqlog`, `onapplication`, `onerror`.
- If `onstream` is unset and nothing else consumes the stream, incoming
  streams are destroyed with a warning.
- `opened` resolves to `{ local, remote, servername, protocol, cipher,
  cipherVersion, validationErrorReason, validationErrorCode,
  earlyDataAttempted, earlyDataAccepted }`.
  - *Verified*: on success, the two `validationError*` keys are absent, not
    `''` and `0`.
  - *Verified*: with `verifyPeer: 'manual'`, `validationErrorCode` is a
    string such as `'DEPTH_ZERO_SELF_SIGNED_CERT'`, not the documented
    number.
- `close({ code, type: 'transport' | 'application', reason })` lets
  streams finish, then destroys the session. A non-zero `code` rejects with
  `ERR_QUIC_TRANSPORT_ERROR` or `ERR_QUIC_APPLICATION_ERROR`.
- `destroy([err[, opts]])` is immediate. `closed` and `closing` track the
  state.
- `createBidirectionalStream(opts)` and `createUnidirectionalStream(opts)`
  return Promises for a `QuicStream`. Options:
  - `body`
  - `headers`, `onheaders`, `ontrailers`, `oninfo`, `onwanttrailers`
    (HTTP/3 only)
  - `priority` (`'high'`, `'default'` or `'low'`) and `incremental`
  - `budget`, default 65536 bytes of writer buffering
- `sendDatagram(data[, enc])` returns a Promise for a bigint id. It resolves
  to `0n` instead of throwing when the datagram is too large, unsupported,
  empty, or the session closed.
- `maxDatagramSize` and `maxPendingDatagrams`.
- Also: `path`, `servername`, `alpnProtocol`, `certificate`,
  `peerCertificate`, `ephemeralKeyInfo`, `localTransportParams`,
  `remoteTransportParams`, `applicationOptions`, `endpoint`, `updateKey()`,
  `stats`, and `[Symbol.asyncDispose]`.

`session.stats` fields (bigint): `createdAt`, `closingAt`,
`handshakeCompletedAt`, `handshakeConfirmedAt`, `bytesReceived`, `bytesSent`,
`bidiInStreamCount`, `bidiOutStreamCount`, `uniInStreamCount`,
`uniOutStreamCount`, `maxBytesInFlight`, `bytesInFlight`, `blockCount`,
`cwnd`, `latestRtt`, `minRtt`, `rttVar`, `smoothedRtt`, `ssthresh`,
`datagramsReceived`, `datagramsSent`, `datagramsAcknowledged`,
`datagramsLost`, `streamsIdleTimedOut`.

### sessionOptions (shared by connect and listen)

**TLS (verified):**

- `alpn`: a string on the client, a non-empty array on the server. The
  default is `'h3'`, and `'h3'`/`'h3-*'` select HTTP/3. A mismatch fails
  with `ERR_QUIC_TRANSPORT_ERROR` "no application protocol".
- `sni` (server, **required**): `{ host | '*': { keys: [KeyObject], certs:
  [PEM bytes], verifyPrivateKey, port, authoritative } }`. Without `'*'`, an
  unknown name gets `unrecognized_name`. *Verified*: a missing `sni` throws
  `ERR_MISSING_ARGS`, PEM strings throw `ERR_INVALID_ARG_TYPE`, PEM strings
  as keys are rejected, and DER bytes in `certs` fail with "Invalid
  certificate".
- `ca` (bytes), `certs`/`keys` (client cert auth), `verifyClient`,
  `servername` (default `'localhost'`).
- `verifyPeer`:
  - `'strict'` aborts in TLS;
  - `'auto'` (default) rejects `opened` on validation failure (*verified*
    for a self-signed cert with no `ca`);
  - `'manual'` resolves and lets you check `validationError*` (*verified*).

**TLS (docs only):**

- `rejectUnauthorized` (default true).
- `ciphers`, `groups`, `crl`.
- `certificateCompression` (`['zlib' | 'brotli' | 'zstd']`, v26.6.0,
  v24.20.0). It helps keep the certificate under the 3× anti-amplification
  limit. Prefer ECDSA P-256 certificates.
- `keylog`, `tlsTrace`, `qlog`.

**Resumption:**

- `sessionTicket` (from `onsessionticket`) and `token` (from `onnewtoken`).
- `enableEarlyData` (default true). On the server, 0-RTT streams have
  `stream.early === true`. If the server rejects 0-RTT, it destroys those
  streams and fires `onearlyrejected`. Early data can be replayed, so keep it
  idempotent.

**Transport:**

- `transportParams`: `initialMaxData`, `initialMaxStreamData{BidiLocal,
  BidiRemote,Uni}`, `initialMaxStreams{Bidi,Uni}`, `maxIdleTimeout`,
  `maxDatagramFrameSize` (default 1200; 0 disables datagrams),
  `activeConnectionIDLimit`, `ackDelayExponent`, `maxAckDelay`,
  `preferredAddressIpv4/6`.
- `cc` (`'reno'`, `'cubic'` or `'bbr'`), `maxPayloadSize`, `maxWindow`,
  `maxStreamWindow`, `unacknowledgedPacketThreshold`, `handshakeTimeout`.
- `keepAlive` (ms, default 0), `initialRtt`, `streamIdleTimeout` (default
  30000 ms), `drainingPeriodMultiplier` (default 3).
- `datagramDropPolicy` (default `'drop-oldest'`), `maxDatagramSendAttempts`
  (default 5), `truncatedReads` (`'error'` or `'ignore'`).
- `preferredAddressPolicy` (default `'ignore'`), `version`, `minVersion`,
  `reuseEndpoint`.

**HTTP/3 (`application`):** `maxHeaderPairs` (128), `maxHeaderLength`
(8192), `maxFieldSectionSize`, `qpackMaxDTableCapacity` (4096),
`qpackEncoderMaxDTableCapacity`, `qpackBlockedStreams` (100),
`enableConnectProtocol`, `enableDatagrams`. Both peers need
`enableDatagrams` to use HTTP/3 datagrams.

Listen-level `onheaders`, `ontrailers` and similar apply to every incoming
stream. For HTTP/3 you must set them there, because setting them in
`onstream` is too late.

## QuicStream

- **Reading** (*verified*): use `for await (const chunks of stream)`, which
  yields `Uint8Array[]` batches. Only one iterator is allowed per stream. It
  also works with `node:stream/iter` `bytes()`, `text()`, `pipeTo()` and
  `dump()`. Reading returns flow-control credit, so always drain a stream.
- **Writing**, one way per stream:
  - `body` / `setBody(x)` takes a string, `ArrayBuffer(View)`, `Blob`,
    `FileHandle`, sync or async iterable, `Promise`, or `null` (FIN at once).
    *Verified* with a string. The bytes are copied.
  - `stream.writer` has `writeSync` (returns false when full), `write` and
    `writev` (these reject with `ERR_INVALID_STATE` when full; they don't
    wait), `endSync`, `end`, `fail(reason)` (sends `RESET_STREAM` and uses a
    `QuicError`'s `errorCode`), and `canWrite`. Wait for space with
    `ondrain(writer)` from `node:stream/iter`.
- Members: `id`, `direction`, `early`, `budget`, `session`, `opened`
  (v26.10.0), `closed`, `destroy([err[, opts]])`, `destroyed`,
  `resetStream([code])`, `stopSending([code])`, `priority`, `setPriority()`,
  `headers`, `pendingTrailers`, `sendHeaders(h, { terminal })`,
  `sendInformationalHeaders`, `sendTrailers`, and `stats`.
- Callbacks: `onerror`, `onblocked`, `onreset`, `onstopsending`,
  `onheaders`, `ontrailers`, `oninfo`, `onwanttrailers`.
- `stream.stats` fields: `ackedAt`, `bytesAccumulated`, `bytesReceived`,
  `bytesSent`, `createdAt`, `destroyedAt`, `finalSize`, `isConnected`,
  `maxBytesAccumulated`, `maxOffset`, `maxOffsetAcknowledged`,
  `maxOffsetReceived`, `openedAt`, `receivedAt`.

## HTTP/3 (docs)

- `'h3'` is the default ALPN.
- A request is `createBidirectionalStream({ headers: { ':method', ':path',
  ':scheme', ':authority' }, onheaders })`. With no `body`, the HEADERS
  frame ends the stream.
- Incoming `:status` is converted to a number.
- On the server, use `this.sendHeaders({ ':status': '200' })` inside
  `onheaders`, then write through `this.writer`.
- ORIGIN frames come from `sni` entries. `close()` sends `GOAWAY`.
- Not implemented: server push, WebTransport helpers, and any HTTP
  semantics such as routing, redirects, cookies or content encoding.

## Diagnostics and permissions

- `PerformanceObserver` entries use `entryType: 'quic'`, named
  `QuicEndpoint`, `QuicSession` or `QuicStream` (v26.2.0, v24.20.0).
- Diagnostics channels: `quic.endpoint.{created,listen,connect,closing,closed,error,busy.change}`,
  `quic.session.{created.client,created.server,open.stream,received.stream,handshake,closing,closed,error,ticket,new.token,goaway,early.rejected,…}`
  and `quic.stream.{closed,headers,trailers,info,reset,blocked}`.
- With `--permission`, `connect()` and `listen()` reject with
  `ERR_ACCESS_DENIED` unless you pass `--allow-net` (*verified*).
