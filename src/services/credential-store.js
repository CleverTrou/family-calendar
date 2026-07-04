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

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEncryptedFile, writeEncryptedFile } from './encrypted-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CRED_FILE = path.join(DATA_DIR, 'credentials.enc');

let _cache = null; // in-memory cache to avoid repeated disk reads + decryption

/* ── File I/O ────────────────────────────────────── */

function loadFromDisk() {
  return readEncryptedFile(CRED_FILE) ?? {};
}

function saveToDisk(data) {
  writeEncryptedFile(CRED_FILE, data);
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
