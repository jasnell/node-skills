# HTTP/2 additions

Source: `doc/api/http2.md` at nodejs/node `ab476eccd03`. Examples: `http2-options.mjs`,
`http2-window.mjs`, `write-information.mjs`.

## `http1Options` (v25.7.0, v24.15.0)

These options are passed to the HTTP/1 server used when `allowHTTP1: true`. Any `http.createServer()` option is accepted,
including `IncomingMessage`, `ServerResponse`, and `keepAliveTimeout`. They replace the deprecated
top-level `Http1IncomingMessage` / `Http1ServerResponse` (DEP0202). They do not affect HTTP/2 requests.
`keepAliveTimeout: 3000` produced `Keep-Alive: timeout=3`.

The docs list `http1Options.keepAliveTimeout` **Default: 5000**. On main the observed default is 65 s, matching
`http.Server`. On v24.19 it is 5 s.

## `strictSingleValueFields` (v25.7.0, v24.15.0; default `true`)

This option is accepted by `createServer`/`createSecureServer` (documented) and by `http2.connect`
(observed working, undocumented). When true, sending several values for a single-value field such as
`content-type` throws `ERR_HTTP2_HEADER_SINGLE_VALUE` from `stream.respond()` /
`client.request()`. With `false`, the duplicates are sent and the receiving side keeps the first value.
With the compat API, `res.setHeader(name, [a, b])` succeeds and the throw happens later inside `res.end()`.

## `connectionWindowSize` (v26.11.0; not on v24)

This is the initial connection-level flow-control window, in bytes. It is accepted by `createServer`,
`createSecureServer`, and `connect`. Range is 1 to 2^31-1, otherwise `ERR_OUT_OF_RANGE`. It is visible as
`session.state.effectiveLocalWindowSize` on the side that set it and as `remoteWindowSize` on the peer.
The per-stream window is still `settings.initialWindowSize`. Per the docs (not tested here), values below 65535 only
take effect after the protocol-default 65535 is used up. `session.setLocalWindowSize()` can raise the window
immediately, but a decrease only applies as the advertised window is consumed. To get a small window from the
start, use this option.

Default: the docs say `33554432` (on createSecureServer and connect). Main showed
33554432. **v26.13.0 showed 65535**, even though the option exists there.

## `response.writeInformation(status[, headers])` (v26.2.0, v24.18.0)

This is the compat API version. It sends a 1xx HEADERS frame. 101 is not allowed. After the final headers it returns `false`.
The client sees it as a `'headers'` event with `:status` 1xx.

## Other changes in range (not exercised)

* `http2session.socket.destroy()` (v26.6.0, v24.20.0) no longer throws. It destroys the session.
* v27: when a client stream has no `'response'` listener, the body is silently discarded (see the
  `'response'` event history in the docs).
