import { fetchGoogleEvents } from './google-calendar.js';
import { fetchGoogleTasks } from './google-tasks.js';
import { fetchICloudEvents } from './icloud-calendar.js';
import { getReminders, updateGoogleTasks } from './reminders.js';
import { config, getEnabledSources } from '../config.js';
import { registerCalendar, isCalendarVisible, loadSettings } from './settings.js';
import { getGoogleCredentials, listAccounts } from './credential-store.js';

let cachedEvents = [];
let knownCalendars = []; // track all discovered calendars + task lists for admin panel
let lastSyncTime = null;
let syncInProgress = false;
let lastError = null;

/**
 * Sync calendars from all enabled sources.
 * Uses Promise.allSettled so one failing source doesn't block the others.
 */
export async function syncAllCalendars() {
  if (syncInProgress) return;
  syncInProgress = true;
  lastError = null;

  const sources = getEnabledSources();
  const { calendarDaysBack, calendarDaysForward } = config;

  try {
    const promises = [];
    const labels = [];

    if (sources.google) {
      promises.push(fetchGoogleEvents(calendarDaysBack, calendarDaysForward));
      labels.push('google');
    }
    if (sources.icloud) {
      promises.push(fetchICloudEvents(calendarDaysBack, calendarDaysForward));
      labels.push('icloud');
    }

    if (promises.length === 0 && !sources.google) {
      console.warn('[Sync] No calendar sources configured.');
      return;
    }

    // Also fetch Google Tasks if Google is connected
    if (sources.google) {
      promises.push(fetchGoogleTasks());
      labels.push('google-tasks');
    }

    // Build known calendars map — seed from credential store first
    // so calendars with no current events still appear in admin toggles.
    const calMap = new Map();

    const accounts = listAccounts();
    for (const acct of accounts) {
      if (acct.provider === 'google') {
        for (const cal of (acct.calendars || [])) {
          const key = `google:${cal.name}`;
          calMap.set(key, { source: 'google', name: cal.name });
        }
      } else if (acct.provider === 'icloud') {
        for (const cal of (acct.calendars || [])) {
          const name = cal.name || cal;
          const key = `icloud:${name}`;
          calMap.set(key, { source: 'icloud', name });
        }
      }
    }

    // Seed Google Task lists from credential store
    const googleCreds = getGoogleCredentials();
    if (googleCreds && googleCreds.taskLists) {
      for (const tl of googleCreds.taskLists) {
        const key = `google-tasks:${tl.name}`;
        calMap.set(key, { source: 'google-tasks', name: tl.name });
      }
    }

    const results = await Promise.allSettled(promises);
    const events = [];
    const summary = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        if (labels[i] === 'google-tasks') {
          // Register task lists discovered from actual fetched data
          for (const task of result.value) {
            const key = `google-tasks:${task.list}`;
            if (!calMap.has(key)) {
              calMap.set(key, { source: 'google-tasks', name: task.list });
            }
          }
          // Filter tasks by list visibility, then store in reminders
          const visibleTasks = result.value.filter((t) =>
            isCalendarVisible('google-tasks', t.list)
          );
          updateGoogleTasks(visibleTasks);
          summary.push(`google-tasks: ${visibleTasks.length}/${result.value.length}`);
        } else {
          events.push(...result.value);
          summary.push(`${labels[i]}: ${result.value.length}`);
        }
      } else {
        summary.push(`${labels[i]}: FAILED (${result.reason?.message})`);
        lastError = `${labels[i]}: ${result.reason?.message}`;
      }
    });

    // Add calendars discovered from events (catches names not in cred store)
    for (const event of events) {
      const key = `${event.source}:${event.calendarName}`;
      if (!calMap.has(key)) {
        calMap.set(key, { source: event.source, name: event.calendarName });
      }
    }

    // Register all in settings (so visibility toggles appear)
    for (const [, cal] of calMap) {
      registerCalendar(cal.source, cal.name);
    }
    knownCalendars = Array.from(calMap.values());

    // Filter out hidden calendars based on user settings
    const visibleEvents = events.filter((e) =>
      isCalendarVisible(e.source, e.calendarName)
    );

    // Sort chronologically by start time
    visibleEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    cachedEvents = visibleEvents;
    lastSyncTime = new Date().toISOString();

    console.log(
      `[Sync] ${visibleEvents.length}/${events.length} events visible (${summary.join(', ')})`
    );
  } catch (err) {
    lastError = err.message;
    console.error('[Sync] Unexpected error:', err.message);
  } finally {
    syncInProgress = false;
  }
}

/** Return all cached data for the frontend. */
export function getCachedData() {
  const settings = loadSettings();
  return {
    events: cachedEvents,
    reminders: getReminders(),
    settings,
    knownCalendars,
    lastSyncTime,
    lastError,
    enabledSources: getEnabledSources(),
  };
}
