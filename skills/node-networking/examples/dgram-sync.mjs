// @node-skills {"added":["v26.4.0","v24.19.0"]}
// dgram socket.bindSync() / connectSync(): synchronous bind/connect; errors throw instead of 'error'.
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { once } from 'node:events';

const a = dgram.createSocket('udp4');
const addr = a.bindSync({ address: '127.0.0.1', port: 0 }); // returns socket.address()
assert.deepEqual(addr, a.address());
assert.equal(addr.family, 'IPv4');

const b = dgram.createSocket('udp4');
b.connectSync(addr.port, '127.0.0.1');    // binds b implicitly if needed
assert.deepEqual(b.remoteAddress(), { address: '127.0.0.1', family: 'IPv4', port: addr.port });
assert.throws(() => b.connectSync(addr.port, '127.0.0.1'), { code: 'ERR_SOCKET_DGRAM_IS_CONNECTED' });

const c = dgram.createSocket('udp4');
assert.throws(() => c.bindSync({ address: '127.0.0.1', port: addr.port }), { code: 'EADDRINUSE' });
assert.throws(() => dgram.createSocket('udp4').bindSync({ address: 'localhost' })); // no DNS
c.close();

b.send('ping');
const [msg] = await once(a, 'message');
assert.equal(String(msg), 'ping');
a.close();
b.close();
