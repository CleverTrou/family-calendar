/**
 * OAuth2 callback routes for Google (and eventually Microsoft).
 *
 * Flow:
 *   1. Admin UI opens /api/auth/google/start in a new tab
 *   2. Server redirects to Google's consent screen
 *   3. Google redirects back to /api/auth/google/callback with a code
 *   4. Server exchanges the code for tokens, stores them, discovers calendars
 *   5. Redirects back to /admin#accounts with a success/error message
 */

import { google } from 'googleapis';
import crypto from 'node:crypto';
import { setAccount } from '../services/credential-store.js';

// In-memory CSRF state tokens (short-lived, keyed by state → timestamp)
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanExpiredStates() {
  const now = Date.now();
  for (const [state, ts] of pendingStates) {
    if (now - ts > STATE_TTL_MS) pendingStates.delete(state);
  }
}

/**
 * Build the OAuth2 redirect URI from the incoming request's host.
 * This ensures it works on localhost, LAN IPs, and custom ports.
 */
function getRedirectUri(request) {
  const proto = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

export async function registerAuthRoutes(fastify) {

  /**
   * GET /google/start
   * Initiates Google OAuth2 consent flow.
   * Query params:
   *   - clientId (optional, use if not yet stored)
   *   - clientSecret (optional, use if not yet stored)
   */
  fastify.get('/google/start', async (request, reply) => {
    const clientId = request.query.clientId || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = request.query.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      return reply.code(400).send({
        error: 'Missing Google OAuth2 credentials',
        hint: 'Provide clientId and clientSecret as query params or set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env',
      });
    }

    const redirectUri = getRedirectUri(request);
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Generate CSRF state token
    const state = crypto.randomBytes(20).toString('hex');
    cleanExpiredStates();
    pendingStates.set(state, {
      timestamp: Date.now(),
      clientId,
      clientSecret,
      redirectUri,
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      prompt: 'consent', // Always get a refresh token
      state,
    });

    return reply.redirect(authUrl);
  });

  /**
   * GET /google/callback
   * Google redirects here after user consents.
   * Exchanges the authorization code for tokens, discovers calendars,
   * and stores everything in the credential store.
   */
  fastify.get('/google/callback', async (request, reply) => {
    const { code, state, error } = request.query;

    if (error) {
      console.error('[Auth] Google authorization denied:', error);
      return reply.redirect('/admin#accounts?error=' + encodeURIComponent(error));
    }

    if (!code || !state) {
      return reply.redirect('/admin#accounts?error=missing_code');
    }

    // Validate CSRF state
    const stateData = pendingStates.get(state);
    if (!stateData) {
      return reply.redirect('/admin#accounts?error=invalid_state');
    }
    pendingStates.delete(state);

    const { clientId, clientSecret, redirectUri } = stateData;

    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        console.error('[Auth] No refresh token returned. User may need to revoke access and re-authorize.');
        return reply.redirect('/admin#accounts?error=no_refresh_token');
      }

      // Discover available calendars
      oauth2Client.setCredentials(tokens);
      const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
      const calList = await calendarApi.calendarList.list();
      const calendars = (calList.data.items || []).map((cal) => ({
        id: cal.id,
        name: cal.summary,
        accessRole: cal.accessRole,
        primary: cal.primary || false,
      }));

      // Store in credential store
      const accountKey = 'google:default';
      setAccount(accountKey, {
        provider: 'google',
        label: 'Google Calendar',
        clientId,
        clientSecret,
        refreshToken: tokens.refresh_token,
        calendarIds: calendars.map((c) => c.id), // Default: sync all
        calendars,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });

      console.log(`[Auth] Google connected! Found ${calendars.length} calendars.`);
      return reply.redirect('/admin#accounts?success=google');

    } catch (err) {
      console.error('[Auth] Google token exchange failed:', err.message);
      return reply.redirect('/admin#accounts?error=' + encodeURIComponent(err.message));
    }
  });
}
