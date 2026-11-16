// @node-skills {"added":["v26.10.0","v24.22.0"]}
// crypto.parsePKCS12: read a .p12/.pfx bundle into a KeyObject + X509Certificate.
import { parsePKCS12, X509Certificate, KeyObject } from 'node:crypto';
import assert from 'node:assert/strict';

// EC P-256 key + self-signed cert (CN=p12-test), exported with: openssl pkcs12 -export -passout pass:secret
const der = Buffer.from('MIIEDAIBAzCCA8IGCSqGSIb3DQEHAaCCA7MEggOvMIIDqzCCAmIGCSqGSIb3DQEHBqCCAlMwggJPAgEAMIICSAYJKoZIhvcNAQcBMFcGCSqGSIb3DQEFDTBKMCkGCSqGSIb3DQEFDDAcBAjv84shv7FV0AICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEO4SGx9BQcZJhGGEcencyNyAggHgzlkZFJy/O26OudCoWE85nZ1khAA3mP5VzfhhfY3k0b4+PYbdz/UAbyxsvGIl6R6XJh9py/bhtFUQHUOcURlTqkVCQJXZxA1mZOqPlPWN7GxrRzy3VD8ZSueRd+vyoLrryuT6PQuQr4ksO45QkEIkGpDb/kVR4BnUJN+sT4CEepRvKOau+8arGABbOmBstouvgHE0TiAxHCd0hr5JjwBvcPUZ5Vn37jngcrnYOYp49/5eHeq4VtmfJuTBUsSq6hpR88Buf8xYzkz4Xx3Pv6cNaXHbxGb4Li1qCtNq8fO35r35ZEFKVW5ZM0Tdn1lLJHJaF2l8l7nagGyil3EKXzt1N8WsUNnuUY5rfCLvzmda57I6ovtgsgvPu6BMwu3rZT7o696juwvbB0zK5hTTFH+LaHiXDKQP6hbnKa2p0GCszSkCrD0HmbtGS3JM503W7upMnrYmBvq8MVd/Fv8qDGHIQ6Y+7vLDm+gW+mZPzV0pPH03ZT3QYCehWjV45vUtsFdA6/tvC3ACbgFCAS1zQTQjpEdFjEoZP0OpQIauyVWWekuhaRz5bGCFGRxb2sFvRaGeV2Nh8NO8cwieEjeEEqKvaAZl5F0MFh/WhL2yQHf39R06XIr6CNy3RRwuHQHOHj16MIIBQQYJKoZIhvcNAQcBoIIBMgSCAS4wggEqMIIBJgYLKoZIhvcNAQwKAQKgge8wgewwVwYJKoZIhvcNAQUNMEowKQYJKoZIhvcNAQUMMBwECOa8PTk087gEAgIIADAMBggqhkiG9w0CCQUAMB0GCWCGSAFlAwQBKgQQmbIhSb1GbJLCLxZw0CpGSwSBkOTaSjCo2xUKtykzJk2o8E7ccY1pPFfbXz6TsngalYhRvcpj4qosF8kare5LuTOh00CNMSCK0hLl/1y5hcJ4bG7J5Ufa1vZjpomMQ8ODqet2FK80NHBi9OXxp1QQVpScOZY5l74DByZJ6czGHq+rjhbYl0rfel3R61B1Y6/4r4sUM2NhNCGZDK/9s1t4AVYlHjElMCMGCSqGSIb3DQEJFTEWBBQyxgRLRyscG/Z/RYD1dY3x50IILzBBMDEwDQYJYIZIAWUDBAIBBQAEIFb6qprDjPm3eDFpJ6WhXM6rcX6gL9WO2VNwTwLpExypBAhRkFFML093NQICCAA=', 'base64');

const { privateKey, certificate, additionalCertificates } = parsePKCS12(der, { passphrase: 'secret' });
assert.ok(privateKey instanceof KeyObject);
assert.equal(privateKey.asymmetricKeyType, 'ec');
assert.ok(certificate instanceof X509Certificate);
assert.equal(certificate.subject, 'CN=p12-test');
assert.equal(certificate.checkPrivateKey(privateKey), true);
assert.deepEqual(additionalCertificates, []);
// Wrong or missing passphrase (missing means '') fails with an OpenSSL MAC error.
assert.throws(() => parsePKCS12(der, { passphrase: 'nope' }), { code: 'ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE' });
assert.throws(() => parsePKCS12(der), { code: 'ERR_OSSL_PKCS12_MAC_VERIFY_FAILURE' });
