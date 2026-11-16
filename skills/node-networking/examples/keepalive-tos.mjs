// @node-skills {"added":["v26.4.0","v24.19.0"]}
// socket.setKeepAlive({ enable, initialDelay, interval, count }) and type-of-service (TOS/DSCP).
import assert from 'node:assert/strict';
import { once } from 'node:events';
import net from 'node:net';

const server = net.createServer((c) => c.end()).listen(0, '127.0.0.1');
await once(server, 'listening');

const sock = new net.Socket({ typeOfService: 0x10 });   // initial TOS (v25.6.0, v24.15.0)
assert.equal(sock.getTypeOfService(), 0x10);              // readable before connect (cached)
assert.equal(sock.setTypeOfService(0x28), sock);          // chainable; applied on connect
sock.connect(server.address().port, '127.0.0.1');
await once(sock, 'connect');
assert.equal(sock.getTypeOfService(), 0x28);
assert.throws(() => sock.setTypeOfService(256), { code: 'ERR_OUT_OF_RANGE' });

// Object form; ms values; interval -> TCP_KEEPINTVL, count -> TCP_KEEPCNT.
assert.equal(sock.setKeepAlive({ enable: true, initialDelay: 10_000, interval: 2_000, count: 5 }), sock);
// Positional form gained the same two arguments.
assert.equal(sock.setKeepAlive(true, 10_000, 2_000, 5), sock);
sock.resume();
await once(sock, 'close');
server.close();
