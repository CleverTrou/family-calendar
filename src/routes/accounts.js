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
import { resetICloudClient } from '../services/icloud-calendar.js';

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
    } else if (account.provider === 'icloud') {
      // For iCloud, calendarIds are actually calendar names
      setAccount(key, { calendarNames: calendarIds.map((n) => n.toLowerCase()) });
      resetICloudClient();
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
    if (account.provider === 'google') resetGoogleClient();
    if (account.provider === 'icloud') resetICloudClient();

    console.log(`[Accounts] Disconnected account: ${key}`);
    return { status: 'ok' };
  });
}
