import { randomUUID } from 'node:crypto';

/**
 * Unified reminders/tasks store.
 *
 * Merges items from two independent sources:
 *   1. Apple Reminders — pushed via iPhone Shortcuts webhook (full snapshot)
 *   2. Google Tasks — polled during the sync cycle
 *
 * Each source overwrites only its own items so they don't interfere.
 */

let appleStore = {
  items: [],
  lastSyncedAt: null,
  syncedBy: null,
};

let googleTasksStore = {
  items: [],
  lastSyncedAt: null,
};

/** Return merged reminders from all sources. */
export function getReminders() {
  const allItems = [
    ...appleStore.items.map((item) => ({ ...item, source: item.source || 'apple' })),
    ...googleTasksStore.items,
  ];

  // Use the most recent sync time from either source
  const syncTimes = [appleStore.lastSyncedAt, googleTasksStore.lastSyncedAt].filter(Boolean);
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
  return googleTasksStore;
}
