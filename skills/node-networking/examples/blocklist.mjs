// @node-skills {"added":["v26.8.0","v24.21.0"]}
// BlockList: CIDR helpers, PRIVATE_RANGES (SSRF guard), removal, size, clear.
import assert from 'node:assert/strict';
import net from 'node:net';

const { BlockList } = net;
assert.ok(Object.isFrozen(BlockList.PRIVATE_RANGES));
assert.deepEqual(BlockList.PRIVATE_RANGES, [
  '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8',
  '::1/128', '169.254.0.0/16', 'fe80::/10', 'fc00::/7',
]);

const deny = new BlockList();
deny.addCIDRs(BlockList.PRIVATE_RANGES);    // family auto-detected per entry
assert.equal(deny.size, 8);                 // like rules.length, without allocating
assert.equal(deny.check('10.1.2.3'), true);
assert.equal(deny.check('8.8.8.8'), false);
assert.equal(deny.check('::1', 'ipv6'), true); // check() still needs the family for IPv6
assert.equal(deny.check('::1'), false);        // ...default type is 'ipv4'

deny.addCIDR('2001:db8::/32');
deny.addAddresses(['203.0.113.5', '203.0.113.6']);
assert.equal(deny.size, 11);

// Removal must match the added rule exactly; non-matching removes are no-ops.
deny.removeCIDR('127.0.0.0/8');
assert.equal(deny.check('127.0.0.1'), false);
deny.removeCIDR('127.0.0.0/16');            // never added: no-op
deny.removeAddress('203.0.113.5');
deny.addRange('198.51.100.1', '198.51.100.9');
deny.removeRange('198.51.100.1', '198.51.100.9');
deny.addSubnet('100.64.0.0', 10);
deny.removeSubnet('100.64.0.0', 10);
assert.equal(deny.size, 9);

deny.clear();
assert.equal(deny.size, 0);

// Typical use: block outbound connections to private ranges.
const s = new net.Socket({ blockList: new BlockList() });
s.destroy();
