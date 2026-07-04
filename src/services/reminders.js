import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readEncryptedFile, writeEncryptedFile } from './encrypted-store.js';

/**
 * Unified reminders/tasks store.
 *
 * Merges items from three independent sources:
 *   1. Apple Reminders — pushed via iPhone Shortcuts webhook (full snapshot)
 *   2. Google Tasks — polled during the sync cycle
 *   3. Microsoft To Do — polled during the sync cycle
 *
 * Each source overwrites only its own items so they don't interfere.
 * All stores are persisted to disk so they survive server restarts.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, '..', '..', 'data', 'reminders-cache.enc');
const LEGACY_CACHE_PATH = join(__dirname, '..', '..', 'data', 'reminders-cache.json');

// ── Persistence ────────────────────────────────────────

function loadCache() {
  const current = readEncryptedFile(CACHE_PATH);
  if (current) return current;

  // One-time migration from the old plaintext cache (pre-encryption).
  if (existsSync(LEGACY_CACHE_PATH)) {
    try {
      const legacy = JSON.parse(readFileSync(LEGACY_CACHE_PATH, 'utf-8'));
      console.log('[Reminders] Migrating reminders-cache.json to encrypted reminders-cache.enc');
      writeEncryptedFile(CACHE_PATH, legacy);
      unlinkSync(LEGACY_CACHE_PATH);
      return legacy;
    } catch (err) {
      console.error('[Reminders] Failed to migrate legacy reminders cache:', err.message);
    }
  }

  return null;
}

function saveCache(apple, googleTasks, microsoftTasks) {
  writeEncryptedFile(CACHE_PATH, { apple, googleTasks, microsoftTasks });
}

// ── Initialize from cache ──────────────────────────────

const cached = loadCache();

let appleStore = cached?.apple ?? {
  items: [],
  lastSyncedAt: null,
  syncedBy: null,
};

let googleTasksStore = cached?.googleTasks ?? {
  items: [],
  lastSyncedAt: null,
};

let microsoftTasksStore = cached?.microsoftTasks ?? {
  items: [],
  lastSyncedAt: null,
};

if (cached) {
  const appleCount = appleStore.items.length;
  const googleCount = googleTasksStore.items.length;
  const msCount = microsoftTasksStore.items.length;
  console.log(
    `[Reminders] Loaded ${appleCount + googleCount + msCount} cached items ` +
    `(apple: ${appleCount}, google-tasks: ${googleCount}, microsoft-tasks: ${msCount})`
  );
}

// ── Public API ─────────────────────────────────────────

/** Return merged reminders from all sources. */
export function getReminders() {
  const allItems = [
    ...appleStore.items.map((item) => ({ ...item, source: item.source || 'apple' })),
    ...googleTasksStore.items,
    ...microsoftTasksStore.items,
  ];

  // Use the most recent sync time from any source
  const syncTimes = [
    appleStore.lastSyncedAt,
    googleTasksStore.lastSyncedAt,
    microsoftTasksStore.lastSyncedAt,
  ].filter(Boolean);
  const lastSyncedAt = syncTimes.length > 0
    ? syncTimes.reduce((a, b) => (a > b ? a : b))
    : null;

  return {
    items: allItems,
    lastSyncedAt,
    syncedBy: appleStore.syncedBy,
  };
}

/**
 * Replace all Apple Reminders with a fresh set from a Shortcuts POST.
 * Each POST is a full snapshot (not a delta), so we simply overwrite.
 */
export function updateReminders(items, syncedBy = 'unknown') {
  appleStore = {
    items: items.map((item) => ({
      id: item.id || randomUUID(),
      title: item.title || '(Untitled)',
      notes: item.notes || null,
      dueDate: item.dueDate || null,
      isCompleted: !!item.isCompleted,
      priority: item.priority ?? 0, // 0=none, 1=high, 5=medium, 9=low
      list: item.list || 'Family',
      source: 'apple',
    })),
    lastSyncedAt: new Date().toISOString(),
    syncedBy,
  };
  saveCache(appleStore, googleTasksStore, microsoftTasksStore);
  return appleStore;
}

/**
 * Replace all Google Tasks with a fresh set from the sync cycle.
 * Called by calendar-store after fetching from Google Tasks API.
 */
export function updateGoogleTasks(items) {
  googleTasksStore = {
    items: items.map((item) => ({
      id: item.id || `gtask:${randomUUID()}`,
      title: item.title || '(Untitled)',
      notes: item.notes || null,
      dueDate: item.dueDate || null,
      isCompleted: !!item.isCompleted,
      priority: item.priority ?? 0,
      list: item.list || 'Tasks',
      source: item.source || 'google-tasks',
    })),
    lastSyncedAt: new Date().toISOString(),
  };
  saveCache(appleStore, googleTasksStore, microsoftTasksStore);
  return googleTasksStore;
}

/**
 * Replace all Microsoft To Do tasks with a fresh set from the sync cycle.
 * Called by calendar-store after fetching from Microsoft Graph API.
 */
export function updateMicrosoftTasks(items) {
  microsoftTasksStore = {
    items: items.map((item) => ({
      id: item.id || `mstodo:${randomUUID()}`,
      title: item.title || '(Untitled)',
      notes: item.notes || null,
      dueDate: item.dueDate || null,
      isCompleted: !!item.isCompleted,
      priority: item.priority ?? 0,
      list: item.list || 'To Do',
      source: item.source || 'microsoft-tasks',
    })),
    lastSyncedAt: new Date().toISOString(),
  };
  saveCache(appleStore, googleTasksStore, microsoftTasksStore);
  return microsoftTasksStore;
}
