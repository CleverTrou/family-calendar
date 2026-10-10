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
