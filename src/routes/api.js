import { getCachedData, syncAllCalendars } from '../services/calendar-store.js';
import {
  loadSettings,
  saveSettings,
  getAvailableFonts,
} from '../services/settings.js';

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
}
