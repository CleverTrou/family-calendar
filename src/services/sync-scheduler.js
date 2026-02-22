import cron from 'node-cron';
import { syncAllCalendars } from './calendar-store.js';
import { config } from '../config.js';

/**
 * Start the periodic calendar sync.
 * Runs an initial sync immediately, then repeats on the configured interval.
 */
export function startSyncScheduler() {
  const intervalMin = config.syncIntervalMinutes;

  // Initial sync on startup
  console.log('[Scheduler] Running initial calendar sync...');
  syncAllCalendars();

  // Schedule recurring syncs
  cron.schedule(`*/${intervalMin} * * * *`, () => {
    syncAllCalendars();
  });

  console.log(`[Scheduler] Syncing every ${intervalMin} minutes.`);
}
