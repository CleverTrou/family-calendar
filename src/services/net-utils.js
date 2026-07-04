/**
 * Shared IP/CIDR helpers used by both the request-level IP allowlist
 * (server.js) and the SSRF guard for user-supplied feed URLs (safe-fetch.js).
 */

export function normalizeIP(ipStr) {
  // Collapse IPv6 forms that are really IPv4 so allowlist entries and request IPs
  // are matched on the same family: ::ffff:10.0.0.1 -> 10.0.0.1, ::1 -> 127.0.0.1.
  if (ipStr.startsWith('::ffff:')) return ipStr.slice(7);
  if (ipStr === '::1') return '127.0.0.1';
  return ipStr;
}

export function expandIPv6(addr) {
  // Expand a plain IPv6 address (handling "::" compression) into a 128-bit BigInt. Drops any zone id.
  addr = addr.split('%')[0];
  const [headStr, tailStr] = addr.split('::');
  const head = headStr ? headStr.split(':') : [];
  const tail = tailStr ? tailStr.split(':') : [];
  const groups = [...head, ...Array(Math.max(8 - head.length - tail.length, 0)).fill('0'), ...tail];
  let value = 0n;
  for (const g of groups) value = (value << 16n) | BigInt(parseInt(g || '0', 16) & 0xffff);
  return value;
}

export function parseCIDR(cidr) {
  // Support bare IPs and CIDR, for both IPv4 ("10.0.0.0/24") and IPv6 ("fd7a:115c:a1e0::/48").
  const [rawAddr, bits] = cidr.includes('/') ? cidr.split('/') : [cidr, ''];
  const addr = normalizeIP(rawAddr);
  if (addr.includes(':')) {
    const prefix = bits === '' ? 128 : parseInt(bits);
    const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
    return { v6: true, ip: expandIPv6(addr) & mask, mask };
  }
  const prefix = bits === '' ? 32 : parseInt(bits);
  const parts = addr.split('.').map(Number);
  const ip = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { v6: false, ip: ip & mask, mask };
}

export function matchCIDR(ipStr, net) {
  const addr = normalizeIP(ipStr);
  const isV6 = addr.includes(':');
  if (net.v6) {
    return isV6 && (expandIPv6(addr) & net.mask) === net.ip;
  }
  if (isV6) return false;
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4) return false;
  const ip = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return (ip & net.mask) === net.ip;
}

// Private, loopback, link-local, CGNAT, documentation, and multicast/reserved
// ranges that a user-supplied feed URL must never be allowed to resolve to.
const RESERVED_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT — includes Tailscale's 100.x range
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
  '::1/128',
  '::/128',
  '64:ff9b::/96', // NAT64 — encodes an IPv4 address, could smuggle a private v4 target
  'fc00::/7', // unique local
  'fe80::/10', // link-local
  'ff00::/8', // multicast
  '2001:db8::/32', // documentation
].map(parseCIDR);

export function isPrivateOrReservedIP(ip) {
  return RESERVED_RANGES.some((net) => matchCIDR(ip, net));
}
