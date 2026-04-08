/**
 * Account management API routes.
 *
 * GET  /          — list all connected accounts (no secrets)
 * POST /icloud    — connect an iCloud account (tests connection first)
 * POST /:key/test — test an existing account's connection
 * PUT  /:key/calendars — update which calendars to sync
 * DELETE /:key    — disconnect an account
 */

import { google } from 'googleapis';
import { DAVClient } from 'tsdav';
import {
  listAccounts,
  getAccount,
  setAccount,
  deleteAccount,
  getGoogleCredentials,
} from '../services/credential-store.js';
import { resetGoogleClient } from '../services/google-calendar.js';
import { resetGoogleTasksClient } from '../services/google-tasks.js';
import { resetICloudClient } from '../services/icloud-calendar.js';
import { resetMicrosoftClient } from '../services/microsoft-calendar.js';
import { resetMicrosoftTasksClient } from '../services/microsoft-tasks.js';

export async function registerAccountRoutes(fastify) {

  /** List all connected accounts (metadata only, no secrets). */
  fastify.get('/', async () => {
    return { accounts: listAccounts() };
  });

  /**
   * Connect an iCloud account.
   * Tests the connection immediately before saving.
   */
  fastify.post('/icloud', async (request, reply) => {
    const { username, appPassword, label } = request.body || {};

    if (!username || !appPassword) {
      return reply.code(400).send({
        error: 'Missing required fields: username, appPassword',
      });
    }

    // Test the connection
    try {
      const testClient = new DAVClient({
        serverUrl: 'https://caldav.icloud.com',
        credentials: { username, password: appPassword },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
      await testClient.login();
      const calendars = await testClient.fetchCalendars();

      const calendarList = calendars.map((cal) => ({
        id: cal.url,
        name: cal.displayName || 'Unnamed',
      }));

      // Save to credential store
      const accountKey = 'icloud:default';
      setAccount(accountKey, {
        provider: 'icloud',
        label: label || 'iCloud Calendar',
        username,
        appPassword,
        calendarNames: calendarList.map((c) => c.name.toLowerCase()),
        calendars: calendarList,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });

      // Reset cached client so next sync uses new credentials
      resetICloudClient();

      console.log(`[Accounts] iCloud connected! Found ${calendarList.length} calendars.`);
      return {
        status: 'connected',
        calendars: calendarList,
      };
    } catch (err) {
      console.error('[Accounts] iCloud connection test failed:', err.message);

      // Translate common errors to user-friendly messages
      let message = err.message;
      if (message.includes('401') || message.includes('Unauthorized')) {
        message = 'Invalid username or app-specific password. Make sure you generated an app-specific password at appleid.apple.com (not your regular Apple ID password).';
      } else if (message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
        message = 'Could not reach iCloud servers. Check your internet connection.';
      }

      return reply.code(400).send({ error: message });
    }
  });

  /**
   * Connect an ICS feed URL (read-only calendar subscription).
   * Tests the URL immediately before saving.
   */
  fastify.post('/ics', async (request, reply) => {
    const { feedUrl, label } = request.body || {};

    if (!feedUrl) {
      return reply.code(400).send({ error: 'Missing required field: feedUrl' });
    }

    // Basic URL validation
    let parsed;
    try {
      parsed = new URL(feedUrl);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL format.' });
    }

    if (!parsed.protocol.startsWith('http')) {
      return reply.code(400).send({ error: 'URL must start with http:// or https://' });
    }

    // Test the feed by fetching it
    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'FamilyCalendar/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const icalData = await response.text();

      // Verify it looks like valid iCalendar data
      if (!icalData.includes('BEGIN:VCALENDAR')) {
        throw new Error('Response is not a valid iCalendar feed (no VCALENDAR found).');
      }

      // Try to detect the calendar name from the feed
      let detectedName = label || '';
      const nameMatch = icalData.match(/X-WR-CALNAME:(.*)/);
      if (nameMatch && !label) {
        detectedName = nameMatch[1].trim();
      }
      if (!detectedName) {
        detectedName = parsed.hostname;
      }

      // Generate a unique account key
      const existingIcs = listAccounts().filter((a) => a.provider === 'ics');
      const accountKey = `ics:feed${existingIcs.length + 1}`;

      setAccount(accountKey, {
        provider: 'ics',
        label: detectedName,
        feedUrl,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });

      console.log(`[Accounts] ICS feed connected: "${detectedName}"`);
      return {
        status: 'connected',
        label: detectedName,
        key: accountKey,
      };
    } catch (err) {
      console.error('[Accounts] ICS feed test failed:', err.message);

      let message = err.message;
      if (message.includes('ENOTFOUND') || message.includes('ETIMEDOUT')) {
        message = 'Could not reach the feed URL. Check the URL and your internet connection.';
      } else if (message.includes('AbortError') || message.includes('timeout')) {
        message = 'Request timed out. The feed URL may be unreachable.';
      }

      return reply.code(400).send({ error: message });
    }
  });

  /**
   * Test an existing account's connection.
   * Re-authenticates and lists calendars.
   */
  fastify.post('/:key/test', async (request, reply) => {
    const { key } = request.params;
    const account = getAccount(key);

    if (!account) {
      return reply.code(404).send({ error: 'Account not found' });
    }

    try {
      if (account.provider === 'google') {
        const creds = getGoogleCredentials();
        if (!creds) throw new Error('No Google credentials found');

        const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
        oauth2Client.setCredentials({ refresh_token: creds.refreshToken });

        const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
        const calList = await calendarApi.calendarList.list();
        const calendars = (calList.data.items || []).map((cal) => ({
          id: cal.id,
          name: cal.summary,
          accessRole: cal.accessRole,
          primary: cal.primary || false,
        }));

        setAccount(key, { status: 'connected', calendars });
        return { status: 'connected', calendars };

      } else if (account.provider === 'icloud') {
        const testClient = new DAVClient({
          serverUrl: 'https://caldav.icloud.com',
          credentials: { username: account.username, password: account.appPassword },
          authMethod: 'Basic',
          defaultAccountType: 'caldav',
        });
        await testClient.login();
        const calendars = await testClient.fetchCalendars();
        const calendarList = calendars.map((cal) => ({
          id: cal.url,
          name: cal.displayName || 'Unnamed',
        }));

        setAccount(key, { status: 'connected', calendars: calendarList });
        return { status: 'connected', calendars: calendarList };

      } else if (account.provider === 'microsoft') {
        // Test by fetching calendars via Graph API
        const { graphGet } = await import('../services/microsoft-graph.js');
        const data = await graphGet(key, '/me/calendars', { $top: '100', $select: 'id,name' });
        const calendars = (data.value || []).map((cal) => ({
          id: cal.id,
          name: cal.name,
        }));

        setAccount(key, { status: 'connected', calendars });
        return { status: 'connected', calendars };

      } else if (account.provider === 'ics') {
        if (!account.feedUrl) throw new Error('No feed URL stored');
        const response = await fetch(account.feedUrl, {
          headers: { 'User-Agent': 'FamilyCalendar/1.0' },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCalendar feed');
        setAccount(key, { status: 'connected' });
        return { status: 'connected', calendars: [{ name: account.label }] };
      }

      return reply.code(400).send({ error: 'Unknown provider' });
    } catch (err) {
      setAccount(key, { status: 'error' });
      return reply.code(400).send({ error: err.message });
    }
  });

  /**
   * Update which calendars to sync for a given account.
   */
  fastify.put('/:key/calendars', async (request, reply) => {
    const { key } = request.params;
    const account = getAccount(key);

    if (!account) {
      return reply.code(404).send({ error: 'Account not found' });
    }

    const { calendarIds } = request.body || {};
    if (!Array.isArray(calendarIds)) {
      return reply.code(400).send({ error: 'calendarIds must be an array' });
    }

    if (account.provider === 'google') {
      setAccount(key, { calendarIds });
      resetGoogleClient();
      resetGoogleTasksClient();
    } else if (account.provider === 'icloud') {
      // For iCloud, calendarIds are actually calendar names
      setAccount(key, { calendarNames: calendarIds.map((n) => n.toLowerCase()) });
      resetICloudClient();
    } else if (account.provider === 'microsoft') {
      setAccount(key, { calendarIds });
      resetMicrosoftClient();
      resetMicrosoftTasksClient();
    }

    return { status: 'ok' };
  });

  /**
   * Disconnect an account (removes from credential store).
   */
  fastify.delete('/:key', async (request, reply) => {
    const { key } = request.params;
    const account = getAccount(key);

    if (!account) {
      return reply.code(404).send({ error: 'Account not found' });
    }

    deleteAccount(key);

    // Reset cached clients
    if (account.provider === 'google') {
      resetGoogleClient();
      resetGoogleTasksClient();
    }
    if (account.provider === 'icloud') resetICloudClient();
    if (account.provider === 'microsoft') {
      resetMicrosoftClient();
      resetMicrosoftTasksClient();
    }

    console.log(`[Accounts] Disconnected account: ${key}`);
    return { status: 'ok' };
  });
}
