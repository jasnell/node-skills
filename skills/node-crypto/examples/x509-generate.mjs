// @node-skills {"added":["v27.0.0"]}
// Test certificates without openssl CLI or npm: CA + leaf with generateX509CertificateSync (Stability 1.2), used by a loopback TLS server.
import { generateKeyPairSync, generateX509CertificateSync, generateX509Certificate } from 'node:crypto';
import { promisify } from 'node:util';
import tls from 'node:tls';
import assert from 'node:assert/strict';

const now = Date.now();
const validity = { notBefore: new Date(now - 60_000), notAfter: new Date(now + 3_600_000) };

const caKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ca = generateX509CertificateSync({
  subject: [{ name: 'CN', value: 'Test CA' }],
  publicKey: caKeys.publicKey,
  serialNumber: 1n, // bigint, required
  ...validity, // both required
  signature: { key: caKeys.privateKey, digest: 'sha256' }, // digest required (null for Ed25519/ML-DSA)
  extensions: [ // nothing is added implicitly
    { type: 'basicConstraints', ca: true, critical: true },
    { type: 'keyUsage', usages: ['keyCertSign', 'crlSign'], critical: true },
    { type: 'subjectKeyIdentifier', value: 'auto' },
  ],
});

const leafKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const leaf = generateX509CertificateSync({
  subject: [{ name: 'CN', value: 'localhost' }],
  publicKey: leafKeys.publicKey,
  issuer: ca, // omit for self-signed
  serialNumber: 2n,
  ...validity,
  signature: { key: caKeys.privateKey, digest: 'sha256' },
  extensions: [
    { type: 'extendedKeyUsage', usages: ['serverAuth'] },
    { type: 'subjectAltName', names: [{ type: 'dns', value: 'localhost' }, { type: 'ip', value: '127.0.0.1' }] },
    { type: 'authorityKeyIdentifier', value: 'auto' },
  ],
});
assert.equal(leaf.checkIssued(ca), true);
assert.equal(leaf.subjectAltName, 'DNS:localhost, IP Address:127.0.0.1');

// Missing serial/dates/digest are errors, not defaults.
assert.throws(() => generateX509CertificateSync({ subject: [{ name: 'CN', value: 'x' }], publicKey: leafKeys.publicKey, ...validity, signature: { key: leafKeys.privateKey, digest: 'sha256' } }), { code: 'ERR_MISSING_OPTION' });

// New inspection getters (v27.0.0): version, extensions (raw), subjectName/issuerName, tbs, signature.
assert.equal(leaf.version, 3);
assert.deepEqual(leaf.subjectName.rdns, [[{ oid: '2.5.4.3', value: 'localhost' }]]);
assert.deepEqual(leaf.extensions.map((e) => e.oid), ['2.5.29.37', '2.5.29.17', '2.5.29.35']);
assert.ok(Buffer.isBuffer(leaf.tbs) && Buffer.isBuffer(leaf.signature.value));
assert.equal(leaf.signature.algorithm.oid, leaf.signatureAlgorithmOid); // signatureAlgorithm[Oid]: v24.9.0+
// Clone a name byte-for-byte: subject: cert.subjectName.raw
const self = await promisify(generateX509Certificate)({
  subject: leaf.subjectName.raw, publicKey: leafKeys.publicKey, serialNumber: 3n, ...validity,
  signature: { key: leafKeys.privateKey, digest: 'sha256' },
});
assert.equal(self.subject, 'CN=localhost');

// Use it: X509Certificate#toString() is PEM; KeyObject#export gives the key PEM.
const server = tls.createServer({
  key: leafKeys.privateKey.export({ format: 'pem', type: 'pkcs8' }),
  cert: leaf.toString(),
}, (s) => s.end('hello'));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const sock = tls.connect({ port: server.address().port, host: '127.0.0.1', servername: 'localhost', ca: ca.toString() });
let body = '';
sock.setEncoding('utf8').on('data', (d) => { body += d; });
await new Promise((resolve, reject) => sock.on('end', resolve).on('error', reject));
assert.equal(sock.authorized, true);
assert.equal(body, 'hello');
server.close();
