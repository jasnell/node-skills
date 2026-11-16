// @node-skills {"added":["v24.0.0"],"timeout":20000}
// dns.reverse() stopped consulting hosts files in v27: it now always sends a PTR query.
// Uses a loopback fake DNS server that answers NXDOMAIN and records the queries it gets.
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { once } from 'node:events';

const fake = dgram.createSocket('udp4');
fake.bind(0, '127.0.0.1');
await once(fake, 'listening');
const queries = [];
fake.on('message', (msg, rinfo) => {
  let i = 12;
  const labels = [];
  while (msg[i]) { labels.push(msg.subarray(i + 1, i + 1 + msg[i]).toString()); i += msg[i] + 1; }
  queries.push(labels.join('.'));
  const header = Buffer.from(msg.subarray(0, 12));
  header[2] = 0x81; header[3] = 0x83;          // response, NXDOMAIN
  header.fill(0, 6, 12);                        // no answer/authority/additional records
  fake.send(Buffer.concat([header, msg.subarray(12, i + 5)]), rinfo.port, rinfo.address);
});

const resolver = new dns.promises.Resolver({ timeout: 1000, tries: 1 });
resolver.setServers([`127.0.0.1:${fake.address().port}`]);
const out = await resolver.reverse('127.0.0.1').catch((e) => e.code);

const major = Number(process.versions.node.split('.')[0]);
if (major >= 27) {
  assert.equal(out, 'ENOTFOUND');
  assert.deepEqual(queries, ['1.0.0.127.in-addr.arpa']);
} else {
  assert.deepEqual(queries, []);              // answered locally from the hosts path, no PTR query
}
// For an /etc/hosts-aware reverse lookup use getnameinfo via dns.lookupService(ip, port).
fake.close();
