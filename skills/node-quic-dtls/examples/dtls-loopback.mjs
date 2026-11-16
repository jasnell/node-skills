// @node-skills {"added":["v27.0.0"],"flags":["--experimental-dtls","--no-warnings"],"timeout":20000}
// DTLS over 127.0.0.1: cert auth + echo, session resumption, PSK. Needs a node built with
// `./configure --experimental-dtls` AND run with --experimental-dtls; official builds skip.
import assert from 'node:assert/strict';
import { generateKeyPairSync, generateX509CertificateSync, randomBytes } from 'node:crypto';

let dtls;
try { dtls = await import('node:dtls'); } catch (e) {
  assert.equal(e.code, 'ERR_UNKNOWN_BUILTIN_MODULE');
  console.log('skip: this node was built without DTLS');
  process.exit(77);
}
const { listen, connect } = dtls;

function selfSigned(name) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const cert = generateX509CertificateSync({
    subject: [{ name: 'commonName', value: name }],
    publicKey,
    serialNumber: 1n,
    notBefore: new Date(Date.now() - 60_000),
    notAfter: new Date(Date.now() + 3_600_000),
    signature: { key: privateKey, digest: 'sha256' },
    extensions: [{ type: 'subjectAltName', names: [{ type: 'dns', value: name }] }],
  });
  return { cert: cert.toString(), key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
const { cert, key } = selfSigned('localhost');
const nextMessage = (s) => new Promise((resolve) => { s.onmessage = (d) => resolve(d.toString()); });

// 1. Certificate-authenticated echo. listen() is sync and returns the endpoint; port is required (0 = ephemeral).
const server = listen((session) => {
  session.onmessage = (data) => session.send(`echo:${data}`);
  session.onerror = () => {};
}, { cert, key, host: '127.0.0.1', port: 0 });
const { port } = server.address;

const client = connect('127.0.0.1', port, { ca: cert, servername: 'localhost' }); // host must be an IP literal
assert.deepEqual(await client.opened, { protocol: 'DTLSv1.2' });
assert.equal(client.authorized, true);
const reply = nextMessage(client);
assert.throws(() => client.send(Buffer.alloc(20_000)), { code: 'ERR_OUT_OF_RANGE' }); // one record per send, <= 16384 B
client.send('ping');
assert.equal(await reply, 'echo:ping');

// 2. Resumption: the client-side session.session Buffer, bound to the same servername.
const ticket = client.session;
assert.ok(Buffer.isBuffer(ticket));
await client.close();
const resumed = connect('127.0.0.1', port, { ca: cert, servername: 'localhost', session: ticket });
await resumed.opened;
assert.equal(resumed.reused, true);
await resumed.close();

// Wrong identity -> opened rejects.
const wrong = connect('127.0.0.1', port, { ca: cert, servername: 'other.test', handshakeTimeout: 5000 });
await assert.rejects(wrong.opened, /certificate verify failed/);
await server.close();

// 3. Pre-shared key: no certificates at all.
const psk = randomBytes(32);
const pskServer = listen((s) => { s.onmessage = (d) => s.send(d); s.onerror = () => {}; },
  { host: '127.0.0.1', port: 0, psk: { 'device-42': psk } });
const device = connect('127.0.0.1', pskServer.address.port, { psk: { identity: 'device-42', key: psk } });
await device.opened;
assert.match(device.cipher.name, /PSK/);
const echoed = nextMessage(device);
device.send('telemetry');
assert.equal(await echoed, 'telemetry');
await device.close();

// A wrong key is silence, not an alert: only handshakeTimeout ends it.
const bad = connect('127.0.0.1', pskServer.address.port, { psk: { identity: 'device-42', key: randomBytes(32) }, handshakeTimeout: 500 });
await assert.rejects(bad.opened, /DTLS handshake timeout/);
await pskServer.close();
