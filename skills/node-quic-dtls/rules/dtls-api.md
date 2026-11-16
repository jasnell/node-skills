# node:dtls API reference

Source: `doc/api/dtls.md` at nodejs/node `ab476eccd03`. Stability is 1.1
(Active development) in `dtls.md`; the `--experimental-dtls` CLI entry says 1.
Everything is `added: v26.9.0` unless noted, so none of it is on v24.

Items marked *verified* were run on main built with `./configure
--experimental-dtls` and started with `--experimental-dtls`. Without the
runtime flag, `node:dtls` is unknown even in such a build (*verified*).
v24.19.0 rejects the flag (`bad option`). v26.13.0 and a default main build
accept the flag, but the module is missing.

## Functions

### `dtls.listen(onsession, options)`

`listen()` returns a `DTLSEndpoint` **synchronously**. A bind failure throws
the OS code, such as `EADDRINUSE`.

`options`:

| Option | Default | Notes |
| --- | --- | --- |
| `port` | required | `0` gives an ephemeral port (*verified*). Omitting it throws `ERR_MISSING_ARGS` (*verified*). |
| `host` | `'0.0.0.0'` | |
| `cert`, `key` | | PEM strings or Buffers. Not needed with `psk`. |
| `passphrase` | | Must be a string. |
| `secureContext` | | Must be built with `isServer: true`. It excludes the options it already carries, including `sni`. |
| `ca` | | |
| `ciphers` | | |
| `alpn` | | `string[]`, or a Buffer in wire format |
| `srtp` | | |
| `requestCert` | `false` | |
| `rejectUnauthorized` | `true` | Only applies together with `requestCert`. |
| `sni` | | See below. |
| `psk` | | See below. |
| `mtu` | 1200 | Range 256–65535. Fixed per endpoint. |
| `handshakeTimeout` | 60000 ms | `0` disables it. |
| `ipv6Only` | `false` | |
| `reusePort` | | |
| `udpReceiveBufferSize`, `udpSendBufferSize`, `udpTTL` | | |
| `maxSessions` | 10000 | |
| `maxSessionsPerHost` | 1000 | |
| `sessionIdContext` | | At most 32 bytes. |
| `ticketKeys` | | Also accepted here (*verified*), though only documented on `createSecureContext`. |

### `dtls.connect(host, port[, options])`

`connect()` returns a `DTLSSession` **synchronously**. Await `session.opened`.

- `host` must be an IPv4 or IPv6 **literal**, because host names are not
  resolved. `'localhost'` throws `ERR_INVALID_ARG_VALUE` (*verified*).
- `options`:
  - `ca`, `cert`, `key`, `passphrase`, `secureContext` (a client context),
    `psk`, `session`, `alpn`, `srtp`, `mtu`, `handshakeTimeout`;
  - `rejectUnauthorized` (default `true`). It checks both the CA chain and
    the identity;
  - `servername`, which defaults to `host`. Pass `''` to send no SNI. SNI
    is never sent for an IP literal;
  - `bindHost` and `bindPort`.

### `dtls.createSecureContext(options)` (v26.10.0)

The options are `alpn`, `ca`, `cert`, `key`, `passphrase`, `ciphers`,
`ecdhCurve`, `isServer`, `rejectUnauthorized`, `psk`, `srtp`, plus these,
which are server-only: `requestCert`, `sessionIdContext`, `sni`,
`pskIdentityHint` and `ticketKeys`. Passing a server-only option to a client
context throws `ERR_INVALID_ARG_VALUE`.

A context is about 28 KiB. Share one across connections. The peer identity
is not part of the context. `secureContext.isServer` tells the two kinds
apart.

## SNI (verified for the map form)

`sni` is `{ 'host': contextOrOptions, '*': fallback }`, or a sync function
`(servername | undefined) => contextOrOptions | undefined`.

- **Without `'*'`, an unmatched name is refused** with `unrecognized_name`,
  even when top-level `cert` and `key` are set (*verified*). This differs
  from `tls`.
- `requestCert` and `rejectUnauthorized` apply per endpoint.
- A `psk` set on an SNI identity is never used.
- If the function throws, that handshake fails. It is not an uncaught
  exception.

## Pre-shared keys (verified)

- Server: `psk: { identity: keyBuffer }`, or `(identity) => key |
  undefined`.
- Client: `psk: { identity, key }`, or `(hint) => ({ identity, key })`.
- No certificates are needed. *Verified*: the negotiated cipher was
  `ECDHE-PSK-CHACHA20-POLY1305`, and `session.authorized` was `true`.
- Giving `psk` without `ciphers` enables the PSK suites. A client with PSK
  and no CA drops the certificate suites.
- CoAP's `TLS_PSK_WITH_AES_128_CCM_8` needs
  `ciphers: 'PSK-AES128-CCM8@SECLEVEL=0'`.
- Failure modes:
  - A **wrong key** produces silence until `handshakeTimeout`. *Verified*:
    `opened` rejects with `ERR_INVALID_STATE` "DTLS handshake timeout".
  - A cipher list with nothing in common behaves the same way.
  - An **unknown identity** fails at once with an "unknown psk identity"
    alert (*verified*).

## Session resumption (verified)

- `client.session` is a Buffer once the session is open; it is `undefined`
  on a server session. Pass it to `connect(…, { session })` to get
  `reused === true`.
- A session is bound to the `servername` or host it authenticated. Using it
  elsewhere throws.
- A session made with `rejectUnauthorized: false` can't be resumed by a
  verifying connection.
- If the server won't accept a ticket, a full handshake happens and
  `reused` is `false`.
- Tickets are tied to one endpoint and process unless all endpoints share
  `ticketKeys`. That must be **exactly 80 bytes**; a 48-byte value (the
  `tls` layout) throws `ERR_INVALID_ARG_VALUE` (*verified*). Rotate them,
  since they are secret.

## DoS controls

- An HMAC cookie exchange runs automatically, including for resumed
  handshakes.
- `maxSessions` and `maxSessionsPerHost` bound sessions. Refused peers get
  silence, not an alert, and are counted in `stats.serverRefusedCount`.
  Raise `maxSessionsPerHost` for clients behind NAT.
- Datagrams that can't be a ClientHello are dropped and counted in
  `stats.serverRejectedCount` (v26.10.0).
- `handshakeTimeout` stops peers that pass the cookie check and then stall.
  OpenSSL's own retransmit give-up takes about 8 minutes.
- `endpoint.busy = true` refuses new sessions.

## DTLSEndpoint

Members: `address` (`{ address, family, port }`), `stats`, `busy`,
`close()`, `destroy([err])`, `destroyed`, `closed`, and
`[Symbol.asyncDispose]`. `close()` sends `close_notify` to every session.

`stats` fields (bigint): `createdAt`, `destroyedAt`, `bytesReceived`,
`bytesSent`, `packetsReceived`, `packetsSent`, `serverSessions`,
`clientSessions`, `serverBusyCount`, `serverRejectedCount`,
`serverRefusedCount`. `isConnected` is a boolean.

## DTLSSession

**Sending.** `send(data)` takes a string, Buffer, TypedArray or DataView and
returns the bytes written. Each call sends one record, **at most 16384
bytes**; a larger send throws `ERR_OUT_OF_RANGE` (*verified*). Calling it
before `opened` resolves, or after close, throws `ERR_INVALID_STATE`
(*verified*). A successful return does not mean the peer got it.

**Lifecycle.** `opened` resolves to `{ protocol }`, for example
`{ protocol: 'DTLSv1.2' }` (*verified*). It rejects on handshake failure,
such as `certificate verify failed` with `ERR_INVALID_STATE` (*verified*).
`closed` always settles. Also: `close()`, `destroy([err])`, `destroyed`,
`endpoint`.

**Connection info:**

- `servername`, `remoteAddress`, `protocol`;
- `cipher`, which is `{ name, standardName, version }`;
- `peerCertificate` (PEM) and `peerX509Certificate` (v26.10.0);
- `session`, `reused`, `authorized` and `authorizationError`, all v26.10.0.
  `authorizationError` gives codes like `'CERT_HAS_EXPIRED'` and
  `'HOSTNAME_MISMATCH'`;
- `alpnProtocol` (a server with `alpn` set and no overlap sends a fatal
  alert);
- `srtpProfile` and `exportKeyingMaterial(len 1–65536, label[, context])`.

**Callbacks:** `onmessage(buffer)`, `onerror(err)`, `onhandshake(protocol)`
and `onkeylog(line)`.

`stats` fields (bigint): `createdAt`, `destroyedAt`, `closingAt`,
`handshakeCompletedAt`, `bytesReceived`, `bytesSent`, `messagesReceived`,
`messagesSent`, `retransmitCount`. `isConnected` is a boolean.

Close every client session you open. *Observed*: a client left mid-handshake
kept the process alive until its 60 s handshake timeout ran out.

## DTLS-SRTP (WebRTC keying, docs only)

Set `srtp: 'SRTP_AES128_CM_SHA1_80:SRTP_AEAD_AES_128_GCM'` on both sides.
After the handshake, read `session.srtpProfile` and call
`session.exportKeyingMaterial(60, 'EXTRACTOR-dtls_srtp')`.

## Permissions

With `--permission`, `connect()` and `listen()` throw `ERR_ACCESS_DENIED`
unless you pass `--allow-net` (*verified* for `connect`). Creating an
endpoint without doing any I/O is allowed (docs).
