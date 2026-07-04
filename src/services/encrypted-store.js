/**
 * Shared AES-256-GCM encryption for JSON data files at rest.
 *
 * Keyed off the same CREDENTIAL_SECRET (auto-generated on first run) used
 * for the OAuth credential store — one master secret for everything this
 * app persists locally, since it's all comparably sensitive.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ENV_FILE = path.join(__dirname, '..', '..', '.env');

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100_000;
const SALT = 'family-calendar-cred-salt-v1'; // static salt is OK since key is already random

/* ── Key management ──────────────────────────────── */

const KEY_FILE = path.join(DATA_DIR, '.credential-key');

/**
 * Get or generate the master encryption secret.
 * Reads CREDENTIAL_SECRET from process.env; if absent, reads back a
 * previously generated key from data/.credential-key (so a read-only
 * .env — e.g. Docker — doesn't get a fresh, unrecoverable key every
 * restart); if neither exists, generates a random 32-byte hex string
 * and appends it to .env (or data/.credential-key if .env isn't writable).
 */
function getMasterSecret() {
  if (process.env.CREDENTIAL_SECRET) {
    return process.env.CREDENTIAL_SECRET;
  }

  if (fs.existsSync(KEY_FILE)) {
    const existing = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    if (existing) {
      process.env.CREDENTIAL_SECRET = existing;
      return existing;
    }
  }

  const secret = crypto.randomBytes(32).toString('hex');

  // Append to .env file
  try {
    const envContent = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';
    const separator = envContent.endsWith('\n') ? '' : '\n';
    fs.appendFileSync(ENV_FILE, `${separator}\n# Auto-generated encryption key for credential store\nCREDENTIAL_SECRET=${secret}\n`);
    try { fs.chmodSync(ENV_FILE, 0o600); } catch { /* ignore on systems that don't support it */ }
    console.log('[EncryptedStore] Generated new CREDENTIAL_SECRET and appended to .env');
  } catch (err) {
    // If .env is read-only (Docker), write to a separate file
    fs.writeFileSync(KEY_FILE, secret, { encoding: 'utf-8', mode: 0o600 });
    console.log('[EncryptedStore] Generated new encryption key in data/.credential-key');
  }

  process.env.CREDENTIAL_SECRET = secret;
  return secret;
}

let _cachedKey = null; // PBKDF2 (100k iterations) is expensive — the secret is static per process, so derive once
let _cachedSecret = null;

function deriveKey(secret) {
  if (_cachedKey && _cachedSecret === secret) return _cachedKey;
  _cachedKey = crypto.pbkdf2Sync(secret, SALT, PBKDF2_ITERATIONS, 32, 'sha256');
  _cachedSecret = secret;
  return _cachedKey;
}

/* ── Encryption / Decryption ─────────────────────── */

export function encryptJSON(data) {
  const key = deriveKey(getMasterSecret());
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv (16) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptJSON(buffer) {
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

/** Read + decrypt a JSON file. Returns null if missing or undecryptable. */
export function readEncryptedFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return decryptJSON(fs.readFileSync(filePath));
  } catch (err) {
    console.error(`[EncryptedStore] Failed to decrypt ${filePath}:`, err.message);
    return null;
  }
}

/** Encrypt + atomically write a JSON-serializable value to disk. */
export function writeEncryptedFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const buffer = encryptJSON(data);
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, buffer, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}
