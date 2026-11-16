// @node-skills {"added":["v26.4.0","v24.19.0"]}
// net.BoundSocket: reserve a port synchronously, then adopt it as a server or as a client's source address.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';

const bound = new net.BoundSocket({ host: '127.0.0.1' }); // numeric IP only; port 0 = ephemeral
const { port } = bound.address();                           // known synchronously
assert.equal(typeof bound.fd(), 'number');

const server = net.createServer((c) => c.end('hi')).listen(bound); // or listen({ handle: bound })
await once(server, 'listening');
assert.equal(server.address().port, port);
assert.throws(() => bound.address(), { code: 'ERR_SOCKET_HANDLE_ADOPTED' }); // ownership moved
bound[Symbol.dispose](); // no-op after adoption

// Client: control the local (egress) address/port.
const src = new net.BoundSocket({ host: '127.0.0.1' });
const srcPort = src.address().port;
const client = new net.Socket({ handle: src });
client.connect(port, '127.0.0.1');
assert.equal(client.localPort, srcPort); // numeric IP target: connect(2) runs synchronously
client.resume();
await once(client, 'close');

// Bind errors throw synchronously; host names are rejected (no DNS).
assert.throws(() => new net.BoundSocket({ host: '127.0.0.1', port }), { code: 'EADDRINUSE' });
assert.throws(() => new net.BoundSocket({ host: 'localhost' }), { code: 'ERR_INVALID_ARG_VALUE' });

// Never adopted? Close it, or let `using` do it.
{
  using _reserved = new net.BoundSocket({ host: '127.0.0.1' });
}
server.close();
