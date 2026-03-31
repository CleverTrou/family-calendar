import { getCachedData, syncAllCalendars } from '../services/calendar-store.js';
import {
  loadSettings,
  saveSettings,
  getAvailableFonts,
} from '../services/settings.js';
import { config } from '../config.js';

/**
 * Register REST API routes for both the display frontend and the admin panel.
 */
export async function registerApiRoutes(fastify) {
  // ── Display endpoints ───────────────────────────────

  // Primary endpoint: all combined calendar + reminders data + settings
  fastify.get('/calendar', async () => {
    return getCachedData();
  });

  // Force an immediate re-sync
  fastify.post('/sync', async () => {
    await syncAllCalendars();
    return { status: 'ok', ...getCachedData() };
  });

  // Health check
  fastify.get('/health', async () => {
    const data = getCachedData();
    return {
      status: 'ok',
      lastSyncTime: data.lastSyncTime,
      lastError: data.lastError,
      eventCount: data.events.length,
      remindersCount: data.reminders.items.length,
      enabledSources: data.enabledSources,
      uptime: Math.round(process.uptime()),
    };
  });

  // ── Settings endpoints (used by /admin panel) ───────

  // Get current settings + metadata for the admin panel
  fastify.get('/settings', async () => {
    const data = getCachedData();
    return {
      settings: data.settings,
      knownCalendars: data.knownCalendars,
      availableFonts: getAvailableFonts(),
    };
  });

  // Save updated settings
  fastify.put('/settings', async (request) => {
    const updated = saveSettings(request.body);
    // Trigger a re-sync so visibility changes take effect immediately
    syncAllCalendars();
    return { status: 'ok', settings: updated };
  });

  // ── Display schedule endpoint (polled by Pi) ────────

  /**
   * Returns whether the display should be on or off right now,
   * based on the schedule in settings. The Pi polls this endpoint
   * every 30–60 seconds and runs xset dpms force on/off accordingly.
   */
  fastify.get('/display/status', async () => {
    const settings = loadSettings();
    const { screenSchedule, screenOnTime, screenOffTime, screenOnDays } = settings.display;

    // If schedule is disabled, screen should always be on
    if (!screenSchedule) {
      return { screenOn: true, schedule: false };
    }

    // Get current time in the configured display timezone
    const now = new Date();
    const tz = config.timezone;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour').value);
    const minute = parseInt(parts.find((p) => p.type === 'minute').value);
    const currentMinutes = hour * 60 + minute;

    // Check day-of-week (0=Sun, 1=Mon, ...)
    const dayStr = dayFormatter.format(now);
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayMap[dayStr];
    const dayEnabled = !screenOnDays || screenOnDays.includes(currentDay);

    // Parse on/off times to minutes since midnight
    const [onH, onM] = (screenOnTime || '06:30').split(':').map(Number);
    const [offH, offM] = (screenOffTime || '23:00').split(':').map(Number);
    const onMinutes = onH * 60 + onM;
    const offMinutes = offH * 60 + offM;

    let screenOn;
    if (onMinutes < offMinutes) {
      // Normal range: on at 06:30, off at 23:00
      screenOn = dayEnabled && currentMinutes >= onMinutes && currentMinutes < offMinutes;
    } else {
      // Overnight range: on at 22:00, off at 06:00 (spans midnight)
      screenOn = dayEnabled && (currentMinutes >= onMinutes || currentMinutes < offMinutes);
    }

    return {
      screenOn,
      schedule: true,
      currentTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      currentDay,
      onTime: screenOnTime,
      offTime: screenOffTime,
    };
  });
}
