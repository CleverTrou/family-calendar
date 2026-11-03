import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import dns from 'node:dns';
import http from 'node:http';
import { once } from 'node:events';
import { sandbox } from '../helpers/sandbox.js';

let box, auth, net, safeFetch;
before(async () => {
  box = await sandbox();
  auth = await box.import('services/admin-auth.js');
  net = await box.import('services/net-utils.js');
  ({ safeFetch } = await box.import('services/safe-fetch.js'));
});
after(async () => box?.cleanup());

function signed(timestamp) {
  return `${timestamp}.${crypto.createHmac('sha256', process.env.CREDENTIAL_SECRET).update(String(timestamp)).digest('hex')}`;
}

test('PIN and admin tokens reject wrong, malformed, expired and future credentials', () => {
  assert.equal(auth.verifyPin(process.env.ADMIN_PIN), true);
  for (const pin of ['', 'wrong', null, undefined, {}]) assert.equal(auth.verifyPin(pin), false);
  const token = auth.generateToken();
  assert.equal(auth.validateToken(token), true);
  for (const invalid of ['', null, {}, 123, 'invalid', token + '.extra', token.slice(0, -1), signed(Date.now() - 86400001), signed(Date.now() + 60000), signed('123abc')]) {
    assert.equal(auth.validateToken(invalid), false, `must reject ${typeof invalid}`);
  }
});

test('CIDR boundaries, IPv6 and mapped IPv4 enforce the allowlist', () => {
  for (const [cidr, inside, outside] of [
    ['10.2.3.0/24', ['10.2.3.0', '10.2.3.255', '::ffff:10.2.3.1'], ['10.2.2.255', '10.2.4.0', '::2']],
    ['fd7a:115c:a1e0::/48', ['fd7a:115c:a1e0::1'], ['fd7a:115c:a1e1::1', '10.0.0.1']],
    ['127.0.0.1', ['127.0.0.1', '::1'], ['127.0.0.2']],
  ]) {
    for (const ip of inside) assert.equal(net.matchCIDR(ip, net.parseCIDR(cidr)), true, ip);
    for (const ip of outside) assert.equal(net.matchCIDR(ip, net.parseCIDR(cidr)), false, ip);
  }
});

test('lan-ipv6 follows this machine\'s current global IPv6 /64 and nothing else', () => {
  // Shaped like os.networkInterfaces(): each address carries its on-link `cidr`.
  const entry = (cidr, internal = false) => {
    const address = cidr.split('/')[0];
    return { address, cidr, family: address.includes(':') ? 'IPv6' : 'IPv4', internal };
  };
  const iface = (...cidrs) => ({
    lo: [entry('::1/128', true), entry('127.0.0.1/8', true)],
    eth0: cidrs.map((c) => entry(c)),
    tailscale0: [entry('fd7a:115c:a1e0::e034:9e4e/128')],
  });
  let current = iface('10.0.0.40/24', '2601:445:880:cc40:8aa2:9eff:fea6:2d39/64', 'fe80::8aa2:9eff:fea6:2d39/64');
  let clock = 0;
  const list = net.createAllowlist(['10.0.0.0/24', net.LAN_IPV6], { interfaces: () => current, ttlMs: 1000, now: () => clock });

  assert.equal(list.allows('2601:445:880:cc40::1234'), true, 'same /64');
  assert.equal(list.allows('10.0.0.7'), true, 'fixed entries still apply');
  for (const ip of ['2601:445:880:cc41::1', 'fe80::1', 'fd7a:115c:a1e0::1', '::1']) assert.equal(list.allows(ip), false, ip);
  assert.match(list.describe(), /lan-ipv6 \(now 2601:445:880:cc40::\/64\)/);

  // The ISP renumbers: the old prefix stops matching and the new one starts, once the TTL lapses.
  current = iface('10.0.0.40/24', '2601:445:800:34b0::9dc/128', '2601:445:800:34b0:8aa2:9eff:fea6:2d39/64');
  assert.equal(list.allows('2601:445:800:34b0::1'), false, 'cached until the TTL lapses');
  clock = 1000;
  assert.equal(list.allows('2601:445:800:34b0:61d9:e505:4f7b:6c3b'), true, 'new prefix after TTL');
  assert.equal(list.allows('2601:445:880:cc40::1234'), false, 'old prefix dropped');

  // No global IPv6 at all: the keyword matches nothing rather than everything.
  const none = net.createAllowlist([net.LAN_IPV6], { interfaces: () => iface('10.0.0.40/24') });
  assert.equal(none.allows('2601:445:800:34b0::1'), false);
  assert.match(none.describe(), /now none/);

  // A lone /128 (DHCPv6) or tunnel address (Teredo, 6to4) adds no range.
  const narrow = net.createAllowlist([net.LAN_IPV6], {
    interfaces: () => iface('2601:445:800:34b0::9dc/128', '2001:0:4136:e378::1/64', '2002:c000:204::1/64'),
  });
  for (const ip of ['2601:445:800:34b0::1', '2001:0:4136:e378::2', '2002:c000:204::2']) assert.equal(narrow.allows(ip), false, ip);

  // lan-ipv6:<iface> ignores global addresses on other interfaces (a WAN port, a VPN).
  const withWan = { ...iface('2601:445:800:34b0::1/64'), wan0: [entry('2001:558:6000::1/64')] };
  const scoped = net.createAllowlist(['lan-ipv6:eth0'], { interfaces: () => withWan });
  assert.equal(scoped.allows('2601:445:800:34b0::1'), true, 'named interface');
  assert.equal(scoped.allows('2001:558:6000::2'), false, 'other interface');
  assert.equal(net.createAllowlist([net.LAN_IPV6], { interfaces: () => withWan }).allows('2001:558:6000::2'), true, 'bare keyword covers all');
});

test('SSRF blocks reserved, encoded and mapped literal addresses before connecting', async () => {
  for (const host of ['127.0.0.1', '2130706433', '0x7f000001', '10.0.0.1', '169.254.169.254', '100.64.0.1', '172.31.255.255', '192.168.1.1', '192.0.2.1', '224.0.0.1', '[::1]', '[::ffff:127.0.0.1]', '[fc00::1]', '[fe80::1]', '[64:ff9b::7f00:1]']) {
    await assert.rejects(safeFetch(`http://${host}/`), /private or internal/, host);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(net.isPrivateOrReservedIP(ip), false);
});

test('DNS rebinding to loopback is blocked; local feeds require explicit opt-in', async (t) => {
  let hits = 0;
  const server = http.createServer((req, res) => { hits++; res.end('synthetic feed'); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  t.mock.method(dns, 'lookup', (host, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]));
  const port = server.address().port;
  await assert.rejects(safeFetch(`http://rebind.example:${port}/`, { signal: AbortSignal.timeout(2000) }), error => /private or internal/.test(error.cause?.message));
  assert.equal(hits, 0);
  const response = await safeFetch(`http://127.0.0.1:${port}/`, {}, { allowPrivateIPs: true });
  assert.equal(await response.text(), 'synthetic feed');
  assert.equal(hits, 1);
});
