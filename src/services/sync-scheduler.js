import cron from 'node-cron';
import { syncAllCalendars } from './calendar-store.js';
import { config } from '../config.js';

/**
 * Start the periodic calendar sync.
 * Runs an initial sync immediately, then repeats on the configured interval.
 */
export function startSyncScheduler() {
  const intervalMin = config.syncIntervalMinutes;

  let syncInProgress = false;

  async function runSync() {
    if (syncInProgress) {
      console.warn('[Scheduler] Sync already in progress, skipping.');
      return;
    }
    syncInProgress = true;
    try {
      await syncAllCalendars();
    } finally {
      syncInProgress = false;
    }
  }

  // Initial sync on startup
  console.log('[Scheduler] Running initial calendar sync...');
  runSync();

  // Schedule recurring syncs
  cron.schedule(`*/${intervalMin} * * * *`, runSync);

  console.log(`[Scheduler] Syncing every ${intervalMin} minutes.`);
}
