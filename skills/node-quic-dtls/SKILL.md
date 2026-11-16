---
name: node-quic-dtls
description: "QUIC, HTTP/3 and DTLS in Node.js with node:quic and node:dtls. Use for QUIC connections or streams, HTTP/3, unreliable datagrams, DTLS over UDP, IoT/CoAP with pre-shared keys, or WebRTC DTLS-SRTP keying. Covers quic.connect/listen, QuicEndpoint/QuicSession/QuicStream, sendDatagram, dtls.listen/connect, PSK, SNI, session resumption, --experimental-quic and --experimental-dtls. Needs a Node.js built with QUIC/DTLS support (standard release builds lack it). QUIC 24.16+/26.x, DTLS 26.9+."
---

# node:quic and node:dtls

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:quic` core (`connect`, `listen`, endpoint/session/stream) | v23.8.0 | 1.0 | `--experimental-quic` (flag added v25.0.0, v24.16.0) |
| QUIC `alpn`/`sni` options | v26.1.0, v24.16.0 | 1.0 | same |
| `session.opened`, `stream.writer`/`setBody`/async iteration, HTTP/3 | v26.2.0, v24.20.0 | 1.0 | same |
| `node:dtls` `listen`/`connect`, PSK, SNI | v26.9.0 | 1.1 | `--experimental-dtls` |
| `dtls.createSecureContext`, `session.session`/`reused`/`authorized` | v26.10.0 | 1.1 | same |

**Both are compile-time options too.** The official v24.19.0 and v26.13.0
binaries and a default main build don't include them. `require` then throws
`ERR_UNKNOWN_BUILTIN_MODULE` even with the flag. You need a build made with
`./configure --experimental-quic --experimental-dtls` **and** the runtime
flag. Check with `node -p process.config.variables.node_use_quic` (`node_use_dtls`).
DTLS is not on v24.

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Model

- QUIC: a `QuicEndpoint` (UDP socket) carries `QuicSession`s (TLS 1.3), which
  carry `QuicStream`s. Events are callback properties (`onstream`, `onerror`).
  `opened` and `closed` are promises.
- DTLS: a `DTLSEndpoint` carries `DTLSSession`s that exchange datagrams
  (`send`, `onmessage`).

## QUIC echo (verified on a QUIC build of main)

```js
const pem = new TextEncoder().encode(certPem);          // PEM *bytes*; keys = KeyObject
const ep = await quic.listen((s) => { s.onstream = async (st) => {
  st.setBody('echo:' + await text(st)); }; },            // for await (const chunks of st)
  { alpn: ['demo'], sni: { '*': { keys: [key], certs: [pem] } },
    endpoint: { address: '127.0.0.1:0' } });
const c = await quic.connect(ep.address, { alpn: 'demo', servername: 'localhost', ca: [pem] });
await c.opened;
const st = await c.createBidirectionalStream({ body: 'hello' });
```

## DTLS echo

```js
const srv = dtls.listen((s) => { s.onmessage = (d) => s.send(d); },
  { cert, key, host: '127.0.0.1', port: 0 });            // sync; port required
const c = dtls.connect('127.0.0.1', srv.address.port, { ca: cert, servername: 'localhost' });
await c.opened; c.send('ping');                          // send only after opened
```

## Pitfalls

- QUIC defaults to ALPN `'h3'`. Set `alpn` on both sides for a raw protocol.
  The server needs `sni` (use `'*'` as the fallback).
- QUIC `verifyPeer: 'auto'` rejects self-signed certs without `ca`.
  `'manual'` exposes `validationErrorCode` (a string).
- Read every QUIC stream to the end, or `Stream.dump()` it. A stream takes a
  `body` *or* the `writer`, not both.
- `dtls.connect` takes an IP literal (no DNS). `send` is at most 16384 B and
  throws before `opened`.
- A wrong DTLS PSK or no common cipher makes the handshake go silent. Set
  `handshakeTimeout` (default 60 s).
- Both need `--allow-net` under `--permission`.

## Don't

- Don't assume `node:quic`/`node:dtls` exist because the version is new enough.
  Check `process.config` and tell the user if a custom build is needed.
- Don't promise HTTP/3 `fetch()`. `node:quic` is low-level framing only.

## Reference

- [rules/quic-api.md](rules/quic-api.md): read for the QUIC endpoint/session/stream API, all options, stats, HTTP/3, datagrams, 0-RTT.
- [rules/dtls-api.md](rules/dtls-api.md): read for DTLS options, PSK, SNI, resumption, ticket keys, DoS limits, SRTP, stats.
