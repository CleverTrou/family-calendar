/**
 * Simple PIN-based admin authentication.
 *
 * If ADMIN_PIN is set in .env, the admin panel requires a PIN to access.
 * Uses HMAC-signed tokens stored in the browser's sessionStorage.
 * No external dependencies — just node:crypto.
 */

import crypto from 'node:crypto';

const PIN = process.env.ADMIN_PIN || '';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getHmacKey() {
  // Use CREDENTIAL_SECRET as the HMAC key, falling back to a constant
  return process.env.CREDENTIAL_SECRET || 'family-calendar-admin';
}

/**
 * Generate a time-limited admin token.
 * Format: timestamp.hmac
 */
export function generateToken() {
  const timestamp = Date.now().toString();
  const hmac = crypto
    .createHmac('sha256', getHmacKey())
    .update(timestamp)
    .digest('hex');
  return `${timestamp}.${hmac}`;
}

/**
 * Validate an admin token.
 * Returns true if the token is valid and not expired.
 */
export function validateToken(token) {
  if (!token) return false;

  const [timestamp, hmac] = token.split('.');
  if (!timestamp || !hmac) return false;

  // Check expiry
  const age = Date.now() - parseInt(timestamp);
  if (isNaN(age) || age > TOKEN_TTL_MS) return false;

  // Verify HMAC (timing-safe comparison)
  const expected = crypto
    .createHmac('sha256', getHmacKey())
    .update(timestamp)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Check if PIN protection is enabled. */
export function isPinRequired() {
  return PIN.length > 0;
}

/** Verify a PIN attempt. */
export function verifyPin(attempt) {
  if (!PIN) return true; // No PIN set → always valid
  return attempt === PIN;
}

/**
 * Fastify preHandler hook for protected routes.
 * Checks for Bearer token in Authorization header.
 * If PIN is not configured, all requests pass through.
 */
export function requireAdmin(request, reply, done) {
  if (!isPinRequired()) {
    done();
    return;
  }

  const auth = request.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');

  if (validateToken(token)) {
    done();
    return;
  }

  reply.code(401).send({ error: 'Unauthorized', pinRequired: true });
}
