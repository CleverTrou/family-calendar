import { randomUUID } from 'node:crypto';

/**
 * In-memory store for Apple Reminders received from iPhone Shortcuts.
 *
 * Since Apple dropped CalDAV for Reminders in iOS 13, there's no way
 * to query them directly from a non-Apple device. Instead, an Apple
 * Shortcut on each phone periodically POSTs the current state here.
 */
let store = {
  items: [],
  lastSyncedAt: null,
  syncedBy: null,
};

export function getReminders() {
  return { ...store };
}

/**
 * Replace all stored reminders with a fresh set from a Shortcuts POST.
 * Each POST is a full snapshot (not a delta), so we simply overwrite.
 */
export function updateReminders(items, syncedBy = 'unknown') {
  store = {
    items: items.map((item) => ({
      id: item.id || randomUUID(),
      title: item.title || '(Untitled)',
      notes: item.notes || null,
      dueDate: item.dueDate || null,
      isCompleted: !!item.isCompleted,
      priority: item.priority ?? 0, // 0=none, 1=high, 5=medium, 9=low
      list: item.list || 'Family',
    })),
    lastSyncedAt: new Date().toISOString(),
    syncedBy,
  };
  return store;
}
