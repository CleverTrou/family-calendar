/**
 * SSRF-safe fetch for user-supplied URLs (ICS feed subscriptions).
 *
 * A hostname-string regex isn't enough: an attacker can register a domain
 * that resolves to a private/internal address (DNS rebinding), which passes
 * any check done before the real connection is made. This pins validation
 * to the same DNS lookup undici uses to open the socket, so every connection
 * — including feed re-fetches on the sync schedule — is checked, not just
 * the one done at "connect account" time.
 */

import dns from 'node:dns';
import net from 'node:net';
import { fetch as undiciFetch, Agent, interceptors } from 'undici';
import { isPrivateOrReservedIP } from './net-utils.js';

function safeLookup(origin, options, callback) {
  // undici's dns interceptor passes the request origin (a URL instance), not a bare hostname.
  const hostname = typeof origin === 'string' ? origin : origin.hostname;
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);

    const safe = addresses.filter((a) => !isPrivateOrReservedIP(a.address));
    if (safe.length === 0) {
      return callback(new Error(
        `Refusing to connect to "${hostname}": it resolves only to private or internal addresses.`
      ));
    }
    callback(null, safe);
  });
}

const dispatcher = new Agent().compose(interceptors.dns({ lookup: safeLookup, maxTTL: 0 }));

/** Drop-in fetch() replacement that refuses to connect to private/internal IPs. */
export function safeFetch(url, options = {}) {
  // A literal IP in the URL (e.g. "http://127.0.0.1/") never goes through the
  // dns interceptor's lookup — there's nothing to resolve — so it must be
  // checked here directly, or it'd bypass the guard below entirely.
  const hostname = (new URL(url)).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname) && isPrivateOrReservedIP(hostname)) {
    return Promise.reject(new Error(
      `Refusing to connect to "${hostname}": it is a private or internal address.`
    ));
  }
  return undiciFetch(url, { ...options, dispatcher });
}
