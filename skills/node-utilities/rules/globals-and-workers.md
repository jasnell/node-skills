# Web-platform globals: URLPattern, Web Locks, Web Worker, events

## `URLPattern` (global v24.0.0; `node:url` export v23.8.0; Stability 1)

`globalThis.URLPattern === require('node:url').URLPattern` (verified). It
follows the WHATWG API: `new URLPattern(string, baseURL?, options?)` or
`new URLPattern({ protocol, hostname, pathname, search, hash, ... }, baseURL?, options?)`,
plus `exec(input, base?)` and `test(input, base?)`.

```js
const route = new URLPattern({ pathname: '/users/:id(\\d+)/posts/:slug?' });
route.exec('https://x.dev/users/42/posts/hi').pathname.groups; // { id: '42', slug: 'hi' }
route.test('https://x.dev/users/abc/posts');                    // false: (\d+) rejects
new URLPattern('/api/*', 'https://x.dev').test('https://x.dev/api/v1'); // true
```

Verified details:
- A **relative string pattern without a base** throws `TypeError`, with code
  `ERR_INVALID_URL_PATTERN`. Object patterns do not need a base.
- Wildcards become numbered groups: `'*.html'` matched against `dns.html`
  gives `groups[0] === 'dns'`. Components that are not given in an object
  pattern act as wildcards.
- `{ ignoreCase: true }` is the options argument. `hasRegExpGroups` and the
  component getters (`pattern.pathname`) are available.
- With an `IncomingMessage`, match against `req.url` plus a base, or pass
  `{ pathname: req.url }`. `req.url` is path-only.
- It is not a router: there is no ranking of overlapping patterns.

## Web Locks: `navigator.locks` / `worker_threads.locks` (v24.5.0; Stability 1)

There is one `LockManager` per **process**, and it is shared by all worker
threads. Verified: `navigator.locks === require('node:worker_threads').locks`,
and a worker's request waits until the main thread releases the lock.

```js
const result = await navigator.locks.request('cache', async (lock) => {
  // lock.name === 'cache', lock.mode === 'exclusive'
  return refresh();
});                      // resolves with the callback's return value once released
```

| Option | Effect (verified) |
| --- | --- |
| `mode: 'shared'` | Several holders at once. A nested shared request inside a shared lock is granted |
| `ifAvailable: true` | The callback receives `null` immediately if the lock is held, instead of waiting |
| `steal: true` | Releases the existing holders and is granted immediately (per the docs) |
| `signal` | Aborting a request that has not been granted rejects with `AbortError` |

- `locks.query()` returns `{ held: [{ name, mode, clientId }], pending: [...] }`.
- Exclusive requests are granted in FIFO order.
- The docs say `request()` "resolves once the lock has been released". It
  resolves **with the callback's return value** (verified), as in the
  browser spec.
- Pitfall: a **pending** request does not keep a thread alive. A worker
  whose only work was waiting on a lock exited before the lock was
  granted, so keep a ref'd handle (or `await` inside an active flow).
- Pitfall: there is no cross-process exclusion. For files shared between
  processes, use `proper-lockfile` or an OS lock.
- `diagnostics_channel` events `locks.request.start`, `grant`, `miss` and
  `end` exist (v25.9.0, v24.15.0; Stability 1). They were not verified here.

## Global Web `Worker` (v26.9.0; Stability 1)

- On v26.9+ it needs `--experimental-web-worker`. On main (YAML
  `REPLACEME`) it is on by default and can be disabled with
  `--no-experimental-web-worker`. It is not on v24 (`bad option`).
- The worker gets `self`, `name`, `location`, `postMessage`, `close`,
  `importScripts` and `addEventListener('message')`, plus Node globals
  (`process`).
- `new Worker(url, { name, type: 'module' })`. Verified on main and on
  v26.13.0 with the flag:
  - A `type: 'module'` worker has no `require`. A classic worker has it.
  - A **relative string resolves against `process.cwd()`**, not against the
    calling module. Pass `new URL('./w.js', import.meta.url)`.
  - The instance is an `EventTarget` and **not**
    `instanceof worker_threads.Worker`. Use `terminate()`,
    `addEventListener('message'|'error')` and `onmessage`.
- There is no `SharedWorker`. The `"worker"` export condition matches inside
  Web Workers (per packages.md).
- The doc stability differs between pages: globals.md says 1 - Experimental
  and cli.md (`--no-experimental-web-worker`) says 1.1 - Active Development.

## `ErrorEvent` (v25.0.0) and `QuotaExceededError` (v26.0.0) globals

Neither is on v24. Verified:
- `new ErrorEvent('error', { message, error, filename, lineno, colno })` is an
  `Event` with those read-only fields.
- `new QuotaExceededError(message, { quota, requested })` is a
  `DOMException` with `name 'QuotaExceededError'`, `code 22`, and the `quota`
  and `requested` numbers. On v24/v25, `err.name === 'QuotaExceededError'`
  is the portable check.
