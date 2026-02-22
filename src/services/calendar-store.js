import { fetchGoogleEvents } from './google-calendar.js';
import { fetchICloudEvents } from './icloud-calendar.js';
import { getReminders } from './reminders.js';
import { config, getEnabledSources } from '../config.js';
import { registerCalendar, isCalendarVisible, loadSettings } from './settings.js';

let cachedEvents = [];
let knownCalendars = []; // track all discovered calendars for the admin panel
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

    if (promises.length === 0) {
      console.warn('[Sync] No calendar sources configured.');
      return;
    }

    const results = await Promise.allSettled(promises);
    const events = [];
    const summary = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        events.push(...result.value);
        summary.push(`${labels[i]}: ${result.value.length}`);
      } else {
        summary.push(`${labels[i]}: FAILED (${result.reason?.message})`);
        lastError = `${labels[i]}: ${result.reason?.message}`;
      }
    });

    // Register discovered calendars and track them for the admin panel
    const calMap = new Map();
    for (const event of events) {
      const key = `${event.source}:${event.calendarName}`;
      if (!calMap.has(key)) {
        calMap.set(key, { source: event.source, name: event.calendarName });
        registerCalendar(event.source, event.calendarName);
      }
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
