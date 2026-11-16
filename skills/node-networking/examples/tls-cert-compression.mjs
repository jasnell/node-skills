// @node-skills {"added":["v26.4.0","v24.19.0"]}
// TLS 1.3 certificate compression (RFC 8879): certificateCompression option + tls.getCertificateCompressionAlgorithms().
import assert from 'node:assert/strict';
import { once } from 'node:events';
import tls from 'node:tls';
import { cert, key } from './fixture-cert.cjs';

const algs = tls.getCertificateCompressionAlgorithms(); // [] if the OpenSSL build lacks support
assert.ok(Array.isArray(algs));
if (!algs.includes('zlib')) { console.log('skip: OpenSSL build lacks zlib certificate compression'); process.exit(77); }

// Returns the bytes the server wrote during one handshake.
async function handshakeBytes(serverAlgs, clientAlgs) {
  const chain = cert.repeat(6); // a long chain makes the effect visible
  const server = tls.createServer({ key, cert: chain, certificateCompression: serverAlgs }, (s) => s.end());
  let raw;
  server.on('connection', (c) => { raw = c; });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = tls.connect({
    port: server.address().port, host: '127.0.0.1', rejectUnauthorized: false,
    certificateCompression: clientAlgs, // client side must offer it too
  });
  await once(client, 'secureConnect');
  client.resume();
  await once(client, 'end');
  client.destroy();
  server.close();
  return raw.bytesWritten;
}

const plain = await handshakeBytes([], []);
const both = await handshakeBytes(['zlib'], ['zlib']);
const serverOnly = await handshakeBytes(['zlib'], []);
assert.ok(both < plain * 0.7, `${both} vs ${plain}`);
assert.ok(Math.abs(serverOnly - plain) < 16); // no effect unless both sides enable it

assert.throws(() => tls.createSecureContext({ certificateCompression: ['lz4'] }), { code: 'ERR_INVALID_ARG_VALUE' });
