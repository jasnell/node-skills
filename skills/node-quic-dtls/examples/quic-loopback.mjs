// @node-skills {"added":["v27.0.0"],"flags":["--experimental-quic","--no-warnings"],"timeout":20000}
// QUIC over 127.0.0.1 with a custom ALPN: bidirectional-stream echo. Needs a node built with
// `./configure --experimental-quic` AND run with --experimental-quic; official builds skip.
import assert from 'node:assert/strict';
import { generateKeyPairSync, generateX509CertificateSync } from 'node:crypto';

let quic;
try { quic = await import('node:quic'); } catch (e) {
  assert.equal(e.code, 'ERR_UNKNOWN_BUILTIN_MODULE');
  console.log('skip: this node was built without QUIC');
  process.exit(77);
}
const { listen, connect } = quic;

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' }); // ECDSA keeps the handshake small
const cert = generateX509CertificateSync({
  subject: [{ name: 'commonName', value: 'localhost' }],
  publicKey,
  serialNumber: 1n,
  notBefore: new Date(Date.now() - 60_000),
  notAfter: new Date(Date.now() + 3_600_000),
  signature: { key: privateKey, digest: 'sha256' },
  extensions: [{ type: 'subjectAltName', names: [{ type: 'dns', value: 'localhost' }] }],
});
// certs: PEM *bytes* (a PEM string throws ERR_INVALID_ARG_TYPE; DER bytes fail "Invalid certificate"). keys: KeyObjects.
const certBytes = new TextEncoder().encode(cert.toString());
const dec = new TextDecoder();
async function readText(stream) {
  let s = '';
  for await (const chunks of stream) for (const c of chunks) s += dec.decode(c, { stream: true }); // batches of Uint8Array
  return s + dec.decode();
}

const endpoint = await listen((session) => {
  session.onstream = async (stream) => {
    const msg = await readText(stream);  // read to the end: consuming returns flow-control credit
    stream.setBody(`echo:${msg}`);       // body OR stream.writer, not both
  };
}, {
  alpn: ['demo'],                         // server: array. Default is 'h3' (HTTP/3)
  sni: { '*': { keys: [privateKey], certs: [certBytes] } }, // required on the server
  endpoint: { address: '127.0.0.1:0' },
});

const client = await connect(endpoint.address, { alpn: 'demo', servername: 'localhost', ca: [certBytes] });
const info = await client.opened;
assert.equal(info.protocol, 'demo');
assert.equal(info.cipherVersion, 'TLSv1.3');

const stream = await client.createBidirectionalStream({ body: 'hello' }); // body sends FIN after the data
assert.equal(await readText(stream), 'echo:hello');
assert.ok(client.stats.bytesSent > 0n);

// Without a trusted CA the default verifyPeer 'auto' rejects; 'manual' hands you the reason.
const manual = await connect(endpoint.address, { alpn: 'demo', verifyPeer: 'manual' });
const m = await manual.opened;
assert.equal(m.validationErrorCode, 'DEPTH_ZERO_SELF_SIGNED_CERT'); // a string, although the docs say {number}
await manual.close();

// ALPN mismatch fails the handshake.
const mismatch = await connect(endpoint.address, { alpn: 'nope', ca: [certBytes] });
mismatch.onerror = () => {};
await assert.rejects(mismatch.opened, { code: 'ERR_QUIC_TRANSPORT_ERROR' });

await client.close();
await endpoint.close();
