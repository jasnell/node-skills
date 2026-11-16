# Inspector: Network and DOMStorage events

Source: `doc/api/inspector.md`, `doc/api/cli.md` at nodejs/node `ab476eccd03`.
The "Integration with DevTools" section is Stability 1.1. Verified by
`examples/network-inspection.mjs` and `examples/storage-inspection.mjs`.

## Network (`--experimental-network-inspection`, Stability 1; flag since v22.6.0, v20.18.0)

With the flag, built-in `http`/`fetch` traffic is reported to an attached CDP client
(DevTools or an in-process `inspector.Session` after `Network.enable`) as
`Network.requestWillBeSent` → `Network.responseReceived` → `Network.loadingFinished`.
Verified on loopback with `fetch`.

Manual broadcasters, for custom transports. Each is a no-op without the flag (no throw):

| Method | Versions |
| --- | --- |
| `inspector.Network.requestWillBeSent/responseReceived/loadingFinished` | v22.6.0, v20.18.0 |
| `inspector.Network.loadingFailed` | v22.7.0, v20.18.0 |
| `inspector.Network.dataReceived` (buffers for `Network.getResponseBody`) | v24.2.0, v22.17.0 |
| `inspector.Network.dataSent` (enables `Network.getRequestPostData`) | v24.3.0, v22.18.0 |
| `inspector.Network.webSocketCreated/webSocketHandshakeResponseReceived/webSocketClosed` | v24.7.0 |

`inspector.NetworkResources.put(url, content)` (v24.5.0, v22.19.0, Stability 1.1, flag
`--experimental-inspector-network-resource`) pre-registers content for CDP
`Network.loadNetworkResource`, for example a source map referenced by URL. This was not verified here.

## DOMStorage (`--experimental-storage-inspection`, v25.5.0, v24.16.0, Stability 1.1)

* Without the flag, `DOMStorage.enable` fails with "'DOMStorage.enable' wasn't found".
* With the flag, built-in `localStorage`/`sessionStorage` changes emit
  `DOMStorage.domStorageItemAdded`, `domStorageItemUpdated`, `domStorageItemRemoved`,
  and `domStorageItemsCleared` automatically. The `storageId` is
  `{ securityOrigin: '', storageKey, isLocalStorage }`. For local storage, `storageKey` is
  the `--localstorage-file` URL.
* On v24, Web Storage itself also needs `--experimental-webstorage`. It is on by default from v25.0.0.
* Manual broadcasters for custom stores: `inspector.DOMStorage.domStorageItemAdded({ storageId,
  key, newValue })`, `domStorageItemRemoved({ storageId, key })`,
  `domStorageItemUpdated({ storageId, key, oldValue, newValue })`,
  `domStorageItemsCleared({ storageId })`, `registerStorage({ isLocalStorage, storageMap })`.
