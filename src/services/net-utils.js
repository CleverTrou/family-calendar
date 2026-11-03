/**
 * Shared IP/CIDR helpers used by both the request-level IP allowlist
 * (server.js) and the SSRF guard for user-supplied feed URLs (safe-fetch.js).
 */

import os from 'node:os';
import { performance } from 'node:perf_hooks';

export function normalizeIP(ipStr) {
  // URL canonicalization handles expanded, uppercase and hex-mapped IPv6,
  // including the form produced when safeFetch parses ::ffff:127.0.0.1.
  if (ipStr.includes(':')) {
    try {
      const canonical = new URL(`http://[${ipStr.split('%')[0]}]/`).hostname.slice(1, -1);
      if (canonical === '::1') return '127.0.0.1';
      const mapped = canonical.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/);
      if (mapped) {
        const high = parseInt(mapped[1], 16);
        const low = parseInt(mapped[2], 16);
        return [high >> 8, high & 255, low >> 8, low & 255].join('.');
      }
    } catch { /* Leave non-address input unchanged. */ }
  }
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

// ALLOWED_NETWORKS keyword for "this machine's own IPv6 LAN, whatever its prefix
// is today". ISPs hand out a new delegated prefix from time to time, so a
// hard-coded /64 silently locks every native-IPv6 client out until it is edited.
// `lan-ipv6` covers every non-loopback interface; `lan-ipv6:eth0` only that one,
// for hosts that also hold a global address on a WAN or VPN interface.
export const LAN_IPV6 = 'lan-ipv6';
const LAN_IPV6_ENTRY = /^lan-ipv6(?::(.+))?$/;

const GLOBAL_UNICAST = parseCIDR('2000::/3');
// Global-looking ranges that are tunnels or documentation, never a LAN.
const NOT_A_LAN = ['2001::/32', '2002::/16', '2001:db8::/32'].map(parseCIDR);

// The /64 of each global IPv6 address on this machine's interfaces (all of them,
// or only those named in `only`). ULA and link-local are skipped, so Tailscale's
// fd7a:… address never widens the list. Only addresses the interface reports as
// on-link at /64 or wider count: a DHCPv6 /128 (or a /96 point-to-point link)
// says nothing about who else is on the segment, so it adds no range.
export function lanIPv6Prefixes(interfaces = os.networkInterfaces(), only = null) {
  const nets = new Map();
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (only && !only.has(name)) continue;
    for (const a of addrs || []) {
      if (a.internal || !a.address.includes(':')) continue;
      if (!matchCIDR(a.address, GLOBAL_UNICAST) || NOT_A_LAN.some((n) => matchCIDR(a.address, n))) continue;
      const onLink = parseInt((a.cidr || '').split('/')[1], 10);
      if (!(onLink <= 64)) continue;
      const net = parseCIDR(`${a.address}/64`);
      nets.set(net.ip, net);
    }
  }
  return [...nets.values()];
}

export function formatIPv6Prefix(net) {
  const groups = [];
  for (let shift = 112n; shift >= 64n; shift -= 16n) groups.push(((net.ip >> shift) & 0xffffn).toString(16));
  return normalizeIP(`${groups.join(':')}::`) + '/64';
}

// Build the request allowlist from ALLOWED_NETWORKS entries. `lan-ipv6` is
// re-resolved at most every `ttlMs`, so a prefix change takes effect without a
// restart, and a prefix the machine no longer holds stops matching.
export function createAllowlist(entries, { interfaces = () => os.networkInterfaces(), ttlMs = 30_000, now = () => performance.now() } = {}) {
  const lanEntries = entries.map((e) => e.match(LAN_IPV6_ENTRY)).filter(Boolean);
  const useLan = lanEntries.length > 0;
  // A bare `lan-ipv6` anywhere means every interface; otherwise only the named ones.
  const only = lanEntries.some((m) => !m[1]) ? null : new Set(lanEntries.map((m) => m[1]));
  const fixed = entries.filter((e) => !LAN_IPV6_ENTRY.test(e)).map(parseCIDR);
  let lan = [];
  let resolvedAt = -Infinity;
  const lanNets = () => {
    if (useLan && now() - resolvedAt >= ttlMs) {
      lan = lanIPv6Prefixes(interfaces(), only);
      resolvedAt = now();
    }
    return lan;
  };
  return {
    allows: (ip) => fixed.some((net) => matchCIDR(ip, net)) || lanNets().some((net) => matchCIDR(ip, net)),
    describe: () => {
      const current = `(now ${lanNets().map(formatIPv6Prefix).join(', ') || 'none'})`;
      return [...entries.filter((e) => !LAN_IPV6_ENTRY.test(e)), ...(useLan ? [`${lanEntries.map((m) => m[0]).join(', ')} ${current}`] : [])].join(', ');
    },
  };
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
