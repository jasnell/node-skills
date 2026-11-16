// @node-skills {"added":["v24.7.0"],"flags":["--experimental-network-inspection"]}
// --experimental-network-inspection: http/fetch traffic appears as CDP Network.* events; WebSocket events can be broadcast.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import inspector from 'node:inspector';

const session = new inspector.Session();
session.connect();
const events = [];
session.on('inspectorNotification', ({ method }) => method.startsWith('Network.') && events.push(method));
await new Promise((ok, fail) => session.post('Network.enable', (e) => (e ? fail(e) : ok())));

const server = http.createServer((req, res) => res.end('hi')).listen(0, '127.0.0.1');
await once(server, 'listening');
assert.equal(await (await fetch(`http://127.0.0.1:${server.address().port}/`)).text(), 'hi');
inspector.Network.webSocketCreated({ requestId: 'ws-1', url: 'ws://127.0.0.1/' });
server.close();
session.disconnect();
assert.deepEqual(events, [
  'Network.requestWillBeSent', 'Network.responseReceived', 'Network.loadingFinished',
  'Network.webSocketCreated',
]);
