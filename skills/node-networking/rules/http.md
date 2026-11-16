# HTTP additions and behavior changes

Source: `doc/api/http.md`, `doc/api/dns.md`, `doc/api/cli.md` at nodejs/node `ab476eccd03`.

## Header validators (v26.11.0; not on v24) — `http-validators.mjs`

`http.isValidHeaderName(name)` and `http.isValidHeaderValue(value, { httpValidation })` return booleans.
They make the same checks as `validateHeaderName`/`validateHeaderValue`, without throwing.

* A name must be a non-empty token. Methods also pass (`'GET'`), and non-strings return false.
* For values, `undefined` and symbols are false. Other non-strings are stringified (`123` → true). CR/LF and control chars are
  false under `'strict'` (the default). `'relaxed'` accepts control chars such as `\x01`. Non-ASCII
  (`'café'`) is **true even in strict**. Only `'strict'`/`'relaxed'` are accepted; `'insecure'` throws.

## WebSocket masking (v26.12.0; not on v24) — `websocket-mask.mjs`

* `http.websocketMask(source, mask, output, offset, length)` XORs `source[0..length)` with the
  4-byte mask into `output` starting at `offset`. Overlapping or in-place views are OK.
* `http.websocketUnmask(buffer, mask)` works in place.
* Throws (and writes nothing) on a mask that is not 4 bytes, an output that is too small, or an immutable output buffer.

## `message.signal` (v26.1.0, v24.16.0) — `http-signal.mjs`

* It is a lazy `AbortSignal` on `IncomingMessage`, both the server `req` and the client `res`. It aborts (reason:
  `AbortError` DOMException) when the message is destroyed or the socket closes before
  completion. Pass it to `fetch`, DB drivers, or `setTimeout` from `timers/promises`.
* **Before v26.7.0 / v24.20.0 it also aborted after normal completion** (observed on v24.19.0).
  If you support those versions, check `res.writableFinished` in the abort handler.

## `response.writeInformation(status, headers?, cb?)` (v26.2.0, v24.18.0) — `write-information.mjs`

* Sends any 1xx: 100–199 except 101 (`ERR_HTTP_INVALID_STATUS_CODE`). Outside 100–199 it throws
  `ERR_OUT_OF_RANGE`. It can be called multiple times. After the final headers it throws `ERR_HTTP_HEADERS_SENT`.
* `headers` accepts the shapes `writeHead()` accepts, including an array of pairs.
* The client receives each one as an `'information'` event `{ statusCode, headers, rawHeaders }`.
* HTTP/2 compat `res.writeInformation(status, headers?)` takes no callback. After the final headers it returns `false`.

## `http.createServer` options — `http-server-options.mjs`

* `optimizeEmptyRequests: true` (v25.1.0, v24.12.0): requests with neither Content-Length nor
  Transfer-Encoding start with `readableEnded === true` and emit **no** `'data'`/`'end'`.
  `for await (const c of req)` and `stream/consumers` still finish. Requests with a body are unaffected.
* `httpValidation: 'strict' | 'relaxed' | 'insecure'` (v26.3.0, v24.19.0). It also applies to `http.request` for
  response headers. Observed behavior:

  | Header byte(s) | strict (default) | relaxed | insecure |
  | --- | --- | --- | --- |
  | `\x01` control char | 400 (client: `HPE_INVALID_HEADER_TOKEN`) | accepted | accepted |
  | `0xE9` / UTF-8 bytes | accepted (latin1-decoded) | accepted | accepted |

  `'insecure'` is the same as `insecureHTTPParser: true`. Combining the two throws `ERR_INVALID_ARG_VALUE`.
* Older options in range: `keepAliveTimeoutBuffer` (v24.6.0, v22.19.0, default 1000; the socket
  timeout is `keepAliveTimeout + keepAliveTimeoutBuffer`), and `shouldUpgradeCallback(req)`
  (v24.9.0, v22.21.0). With the latter, an accepted upgrade that has no `'upgrade'` listener destroys the socket.

## Changed defaults — `changed-defaults.mjs`, `dns-reverse-hosts.mjs`

* `server.keepAliveTimeout`: **65000** from v27.0.0, 5000 on v24/v26. It only applies to new
  connections. To keep the old idle-close behavior, set `keepAliveTimeout: 5000`. The HTTP/1 fallback of
  `http2.createSecureServer({ allowHTTP1 })` also uses 65 s on main (it sends `Keep-Alive: timeout=65`).
* `'upgrade'` with a request body (v26.0.0): the body is parsed and emitted on `req` (`'data'`).
  `head` and the stream contain only the bytes after the body. Reading the stream starts the body
  flowing. On v24 the raw body bytes are in `head` and `req` emits nothing.
* `dns.reverse()` / `resolver.reverse()` (v27.0.0) no longer consults hosts files. It always
  sends a PTR query, so `127.0.0.1` gives `ENOTFOUND` on an ordinary resolver. Verified with a loopback
  fake DNS server: v24/v26 sent no query. Use `dns.lookupService(ip, port)` (getnameinfo) for
  `/etc/hosts` names.

## Built-in proxy support (Stability 1.1) — `env-proxy.mjs`

| Switch | Versions |
| --- | --- |
| `NODE_USE_ENV_PROXY=1` | v24.0.0, v22.21.0 |
| `--use-env-proxy` (takes precedence over the env var) | v24.5.0, v22.21.0 |
| `new http.Agent({ proxyEnv })` | v24.5.0, v22.21.0 |
| `http.setGlobalProxyFromEnv(proxyEnv = process.env)` → `restore()` | v25.4.0, v24.14.0 |

* Reads `HTTP_PROXY`/`http_proxy`, `HTTPS_PROXY`/`https_proxy`, `NO_PROXY`/`no_proxy`. The lowercase
  form wins when both are set.
* It affects the global agents (`http.get`, `https.request`) and `fetch()`, not custom agents unless
  you pass them `proxyEnv`. Unix socket requests ignore it.
* `setGlobalProxyFromEnv()` replaces `http.globalAgent`, `https.globalAgent`, and the undici global
  dispatcher. Call it before any requests. The returned `restore()` puts the previous ones back.
* `NO_PROXY` supports `*`, exact hosts, `.suffix`, `*.suffix`, IPs, IP ranges, and `host:port`.
* **v24:** `fetch()` sends `CONNECT host:80` to the proxy even for `http://` URLs. On v26+ it sends
  `GET http://host/path`. `http.get` always uses the absolute-URI form.
