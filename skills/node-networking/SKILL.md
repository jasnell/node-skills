---
name: node-networking
description: "Networking APIs and behavior changes since Node.js 24 in net, dgram, tls, http and http2. Use to reserve a port before listening, block private IPs (SSRF), cancel work when a client disconnects, send 103 Early Hints, honor HTTP_PROXY/HTTPS_PROXY, validate header values, use promise-based net, or debug keepAliveTimeout (now 65s), upgrade-request bodies or dns.reverse. Covers node:net/promises, net.BoundSocket, BlockList PRIVATE_RANGES, setKeepAlive({ interval, count }), dgram bindSync, TLS certificateCompression, http.isValidHeaderValue, websocketMask, req.signal, NODE_USE_ENV_PROXY and HTTP/2 http1Options. Node.js 24+, some 26/27+."
---

# Node.js networking (v24+)

| Feature | Versions | Stability | Flag |
| --- | --- | --- | --- |
| `node:net/promises`, `for await (s of server)` | v27.0.0 (not v24/v26) | 1 | — |
| `net.BoundSocket` / `{ path }`, `isPipe` | v26.4.0, v24.19.0 / v26.7.0, v24.20.0 | 2 | — |
| send `BoundSocket` via `subprocess.send` | v26.10.0, v24.22.0 | 2 | — |
| BlockList `addCIDR[s]`, `remove*`, `PRIVATE_RANGES`, `size`, `clear` | v26.8.0, v24.21.0 | 2 | — |
| `setKeepAlive({ interval, count })`, dgram `bindSync`/`connectSync` | v26.4.0, v24.19.0 | 2 | — |
| `set/getTypeOfService`, `typeOfService` | v25.6.0, v24.15.0 | 2 | — |
| TLS `certificateCompression` | v26.4.0, v24.19.0 | 2 | — |
| `tlsSocket.socket` | v27.0.0 | 2 | — |
| `http.isValidHeaderName/Value` / `websocketMask/Unmask` | v26.11.0 / v26.12.0 | 2 | — |
| `message.signal` | v26.1.0, v24.16.0 (fixed v26.7.0, v24.20.0) | 2 | — |
| `writeInformation` (http, http2) | v26.2.0, v24.18.0 | 2 | — |
| `httpValidation` / `optimizeEmptyRequests` | v26.3.0, v24.19.0 / v25.1.0, v24.12.0 | 2 | — |
| `setGlobalProxyFromEnv` / env proxy | v25.4.0, v24.14.0 / v24.5.0, v22.21.0 | 1.1 | `--use-env-proxy` |
| http2 `http1Options`, `strictSingleValueFields` / `connectionWindowSize` | v25.7.0, v24.15.0 / v26.11.0 | 2 | — |

> **Experimental API.** Before relying on these details, run the
> `node-experimental-check` skill's probe (or `node --version` plus a
> feature-detect one-liner) and check the docs for *the installed
> version*: `https://nodejs.org/docs/<version>/api/<module>.html`.
> If the installed version disagrees with this skill, the installed
> version wins.

## Reserve a port synchronously

```js
const bound = new net.BoundSocket({ host: '127.0.0.1' }); // numeric IP, no DNS
const { port } = bound.address();       // known now, no race
net.createServer(h).listen(bound);      // adopts; or child.send('x', bound)
```

## SSRF guard

```js
const deny = new net.BlockList();
deny.addCIDRs(net.BlockList.PRIVATE_RANGES);
deny.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');
```

## Cancel work when the client leaves

```js
http.createServer(async (req, res) => {
  res.writeInformation(103, { Link: '</app.css>; rel=preload' });
  const data = await fetch(upstream, { signal: req.signal });
});
```

## Changed defaults

- `server.keepAliveTimeout` is **65000** from v27 (was 5000). Set it explicitly behind a load balancer.
- `'upgrade'` with a body (v26+): the body is parsed onto `req`, and `head`/stream hold only the bytes after it. On v24 the body leaks into `head`.
- `dns.reverse` (v27+) always sends a PTR query and ignores `/etc/hosts`. Use `dns.lookupService(ip, port)` for hosts-aware names.

## Pitfalls

- `check()` defaults to `'ipv4'`, so `check('::1')` is false. Pass the family.
- `optimizeEmptyRequests`: no `'end'` on bodyless requests (`once(req, 'end')` hangs); `for await` works.
- `req.signal` on v24.16–24.19 / v26.1–26.6 also aborts after a normal response.
- `httpValidation: 'strict'` rejects control chars, not non-ASCII. `'relaxed'` allows control chars.
- Certificate compression needs both peers to opt in, and TLS 1.3. v24 `fetch` via `HTTP_PROXY` uses CONNECT even for `http://`.

## Don't

- Don't use `get-port` or `listen(0)` races (`BoundSocket`), `ip-range-check`, `bufferutil`, `global-agent`/`proxy-agent`, or `req.on('close')` abort checks.

## Reference

- [rules/net.md](rules/net.md): net/promises, BoundSocket (IPC, workers, pipes), BlockList, keep-alive, TOS, dgram.
- [rules/tls.md](rules/tls.md): certificate compression, `tlsSocket.socket`.
- [rules/http.md](rules/http.md): validators, masking, signal, 1xx, options, proxy, upgrade, keep-alive, dns.reverse.
- [rules/http2.md](rules/http2.md): `http1Options`, `strictSingleValueFields`, `connectionWindowSize`, `writeInformation`.
