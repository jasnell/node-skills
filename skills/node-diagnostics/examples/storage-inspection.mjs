// @node-skills {"added":["v25.5.0","v24.16.0"],"flags":["--experimental-webstorage","--experimental-storage-inspection"]}
// --experimental-storage-inspection: Web Storage changes become CDP DOMStorage.* events.
import assert from 'node:assert/strict';
import inspector from 'node:inspector';

const session = new inspector.Session();
session.connect();
const events = [];
session.on('inspectorNotification', ({ method, params }) => {
  if (method.startsWith('DOMStorage.')) events.push([method, params.key, params.storageId.isLocalStorage]);
});
await new Promise((ok, fail) => session.post('DOMStorage.enable', (e) => (e ? fail(e) : ok())));

sessionStorage.setItem('a', '1'); // built-in storage emits automatically
sessionStorage.setItem('a', '2');
sessionStorage.removeItem('a');
// Custom stores can broadcast the same events by hand:
inspector.DOMStorage.domStorageItemAdded({
  storageId: { securityOrigin: '', storageKey: 'my-cache', isLocalStorage: true }, key: 'k', newValue: 'v',
});
session.disconnect();
assert.deepEqual(events, [
  ['DOMStorage.domStorageItemAdded', 'a', false],
  ['DOMStorage.domStorageItemUpdated', 'a', false],
  ['DOMStorage.domStorageItemRemoved', 'a', false],
  ['DOMStorage.domStorageItemAdded', 'k', true],
]);
