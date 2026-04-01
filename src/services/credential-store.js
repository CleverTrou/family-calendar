/**
 * Encrypted credential storage for calendar provider accounts.
 *
 * Stores credentials in data/credentials.enc using AES-256-GCM.
 * The encryption key is derived from CREDENTIAL_SECRET in .env
 * (auto-generated on first run if missing).
 *
 * Falls back to .env values for backward compatibility when no
 * stored credentials exist for a provider.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CRED_FILE = path.join(DATA_DIR, 'credentials.enc');
const ENV_FILE = path.join(__dirname, '..', '..', '.env');

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100_000;
const SALT = 'family-calendar-cred-salt-v1'; // static salt is OK since key is already random

let _cache = null; // in-memory cache to avoid repeated disk reads + decryption

/* ── Key management ──────────────────────────────── */

/**
 * Get or generate the master encryption secret.
 * Reads CREDENTIAL_SECRET from process.env; if absent,
 * generates a random 32-byte hex string and appends it to .env.
 */
function getMasterSecret() {
  if (process.env.CREDENTIAL_SECRET) {
    return process.env.CREDENTIAL_SECRET;
  }

  const secret = crypto.randomBytes(32).toString('hex');

  // Append to .env file
  try {
    const envContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
    const separator = envContent.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(ENV_FILE, `${separator}\n# Auto-generated encryption key for credential store\nCREDENTIAL_SECRET=${secret}\n`);
    console.log('[CredentialStore] Generated new CREDENTIAL_SECRET and appended to .env');
  } catch (err) {
    // If .env is read-only (Docker), write to a separate file
    const keyFile = path.join(DATA_DIR, '.credential-key');
    fs.writeFileSync(keyFile, secret, 'utf-8');
    console.log('[CredentialStore] Generated new encryption key in data/.credential-key');
  }

  process.env.CREDENTIAL_SECRET = secret;
  return secret;
}

function deriveKey(secret) {
  return crypto.pbkdf2Sync(secret, SALT, PBKDF2_ITERATIONS, 32, 'sha256');
}

/* ── Encryption / Decryption ─────────────────────── */

function encrypt(data) {
  const key = deriveKey(getMasterSecret());
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(buffer) {
  const key = deriveKey(getMasterSecret());
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const ciphertext = buffer.subarray(32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

/* ── File I/O ────────────────────────────────────── */

function loadFromDisk() {
  if (!fs.existsSync(CRED_FILE)) return {};
  try {
    const buffer = fs.readFileSync(CRED_FILE);
    return decrypt(buffer);
  } catch (err) {
    console.error('[CredentialStore] Failed to decrypt credentials file:', err.message);
    return {};
  }
}

function saveToDisk(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const encrypted = encrypt(data);
  fs.writeFileSync(CRED_FILE, encrypted);
}

function getAll() {
  if (!_cache) _cache = loadFromDisk();
  return _cache;
}

function saveAll(data) {
  _cache = data;
  saveToDisk(data);
}

/* ── Public API ──────────────────────────────────── */

/** List all accounts (keys + metadata, no secrets). */
export function listAccounts() {
  const all = getAll();
  return Object.entries(all).map(([key, acct]) => ({
    key,
    provider: acct.provider,
    label: acct.label || key,
    status: acct.status || 'connected',
    connectedAt: acct.connectedAt || null,
    calendars: acct.calendars || [],
  }));
}

/** Get a single account by key (includes secrets). */
export function getAccount(key) {
  return getAll()[key] || null;
}

/** Create or update an account. */
export function setAccount(key, data) {
  const all = getAll();
  all[key] = { ...all[key], ...data, updatedAt: new Date().toISOString() };
  saveAll(all);
  return all[key];
}

/** Remove an account. */
export function deleteAccount(key) {
  const all = getAll();
  if (!(key in all)) return false;
  delete all[key];
  saveAll(all);
  _cache = all;
  return true;
}

/**
 * Get Google credentials: credential store first, .env fallback.
 * Returns { clientId, clientSecret, refreshToken, calendarIds } or null.
 */
export function getGoogleCredentials() {
  // Check credential store
  const all = getAll();
  const storeAccount = Object.entries(all).find(([, a]) => a.provider === 'google');

  if (storeAccount) {
    const [, acct] = storeAccount;
    if (acct.clientId && acct.refreshToken) {
      return {
        clientId: acct.clientId,
        clientSecret: acct.clientSecret,
        refreshToken: acct.refreshToken,
        calendarIds: acct.calendarIds || [],
        taskListIds: acct.taskListIds || [],
        taskLists: acct.taskLists || [],
      };
    }
  }

  // Fallback to .env
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || '';

  if (!clientId || !refreshToken) return null;

  return {
    clientId,
    clientSecret,
    calendarIds: (process.env.GOOGLE_CALENDAR_IDS || 'primary')
      .split(',').map((id) => id.trim()).filter(Boolean),
    refreshToken,
  };
}

/**
 * Get iCloud credentials: credential store first, .env fallback.
 * Returns { username, appPassword, calendarNames } or null.
 */
export function getICloudCredentials() {
  const all = getAll();
  const storeAccount = Object.entries(all).find(([, a]) => a.provider === 'icloud');

  if (storeAccount) {
    const [, acct] = storeAccount;
    if (acct.username && acct.appPassword) {
      return {
        username: acct.username,
        appPassword: acct.appPassword,
        calendarNames: acct.calendarNames || [],
      };
    }
  }

  // Fallback to .env
  const username = process.env.ICLOUD_USERNAME || '';
  const appPassword = process.env.ICLOUD_APP_PASSWORD || '';

  if (!username || !appPassword) return null;

  return {
    username,
    appPassword,
    calendarNames: (process.env.ICLOUD_CALENDAR_NAMES || '')
      .split(',').map((n) => n.trim().toLowerCase()).filter(Boolean),
  };
}

/**
 * Get Microsoft credentials from credential store.
 * Returns account data or null if not connected.
 */
export function getMicrosoftCredentials() {
  const all = getAll();
  const storeAccount = Object.entries(all).find(([, a]) => a.provider === 'microsoft');

  if (storeAccount) {
    const [, acct] = storeAccount;
    if (acct.clientId && acct.refreshToken) {
      return {
        clientId: acct.clientId,
        clientSecret: acct.clientSecret,
        refreshToken: acct.refreshToken,
        calendarIds: acct.calendarIds || [],
        taskLists: acct.taskLists || [],
      };
    }
  }

  return null;
}

/** Invalidate the in-memory cache (call after external changes). */
export function clearCache() {
  _cache = null;
}
