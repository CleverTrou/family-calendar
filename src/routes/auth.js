/**
 * OAuth2 callback routes for Google and Microsoft.
 *
 * Both flows follow the same pattern:
 *   1. Admin UI opens /api/auth/{provider}/start in a new tab
 *   2. Server redirects to provider's consent screen
 *   3. Provider redirects back to /api/auth/{provider}/callback with a code
 *   4. Server exchanges the code for tokens, discovers calendars/tasks
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
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/tasks.readonly',
      ],
      prompt: 'consent', // Always get a refresh token
      state,
    });

    // Google requires device_id and device_name when the redirect URI
    // points to a private/local IP address (10.x, 192.168.x, etc.)
    const url = new URL(authUrl);
    const redirectHost = new URL(redirectUri).hostname;
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|localhost$)/.test(redirectHost);
    if (isPrivateIP) {
      // Use a stable device ID derived from the redirect host
      url.searchParams.set('device_id', redirectHost);
      url.searchParams.set('device_name', 'Family Calendar');
    }

    return reply.redirect(url.toString());
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

      // Discover available calendars and task lists
      oauth2Client.setCredentials(tokens);

      const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
      const calList = await calendarApi.calendarList.list();
      const calendars = (calList.data.items || []).map((cal) => ({
        id: cal.id,
        name: cal.summary,
        accessRole: cal.accessRole,
        primary: cal.primary || false,
      }));

      // Discover Google Tasks lists
      let taskLists = [];
      try {
        const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });
        const tlResult = await tasksApi.tasklists.list({ maxResults: 100 });
        taskLists = (tlResult.data.items || []).map((tl) => ({
          id: tl.id,
          name: tl.title,
        }));
      } catch (err) {
        console.warn('[Auth] Could not discover task lists:', err.message);
      }

      // Store in credential store
      const accountKey = 'google:default';
      setAccount(accountKey, {
        provider: 'google',
        label: 'Google Calendar & Tasks',
        clientId,
        clientSecret,
        refreshToken: tokens.refresh_token,
        calendarIds: calendars.map((c) => c.id), // Default: sync all
        calendars,
        taskListIds: taskLists.map((tl) => tl.id), // Default: sync all
        taskLists,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });

      console.log(`[Auth] Google connected! Found ${calendars.length} calendars and ${taskLists.length} task lists.`);
      return reply.redirect('/admin#accounts?success=google');

    } catch (err) {
      console.error('[Auth] Google token exchange failed:', err.message);
      return reply.redirect('/admin#accounts?error=' + encodeURIComponent(err.message));
    }
  });

  /* ─── Microsoft OAuth2 ────────────────────────────── */

  const MS_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const MS_SCOPES = 'Calendars.Read Tasks.Read User.Read offline_access';

  function getMicrosoftRedirectUri(request) {
    const proto = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers.host;
    return `${proto}://${host}/api/auth/microsoft/callback`;
  }

  /**
   * GET /microsoft/start
   * Initiates Microsoft OAuth2 consent flow.
   * Query params: clientId, clientSecret
   */
  fastify.get('/microsoft/start', async (request, reply) => {
    const clientId = request.query.clientId || '';
    const clientSecret = request.query.clientSecret || '';

    if (!clientId || !clientSecret) {
      return reply.code(400).send({
        error: 'Missing Microsoft OAuth2 credentials',
        hint: 'Provide clientId and clientSecret as query params.',
      });
    }

    const redirectUri = getMicrosoftRedirectUri(request);
    const state = crypto.randomBytes(20).toString('hex');
    cleanExpiredStates();
    pendingStates.set(state, {
      timestamp: Date.now(),
      clientId,
      clientSecret,
      redirectUri,
      provider: 'microsoft',
    });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: MS_SCOPES,
      response_mode: 'query',
      state,
      prompt: 'consent',
    });

    return reply.redirect(`${MS_AUTH_BASE}/authorize?${params}`);
  });

  /**
   * GET /microsoft/callback
   * Microsoft redirects here after user consents.
   * Exchanges the authorization code for tokens, discovers calendars & tasks.
   */
  fastify.get('/microsoft/callback', async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    if (error) {
      console.error('[Auth] Microsoft authorization denied:', error_description || error);
      return reply.redirect('/admin#accounts?error=' + encodeURIComponent(error_description || error));
    }

    if (!code || !state) {
      return reply.redirect('/admin#accounts?error=missing_code');
    }

    const stateData = pendingStates.get(state);
    if (!stateData || stateData.provider !== 'microsoft') {
      return reply.redirect('/admin#accounts?error=invalid_state');
    }
    pendingStates.delete(state);

    const { clientId, clientSecret, redirectUri } = stateData;

    try {
      // Exchange authorization code for tokens
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: MS_SCOPES,
      });

      const tokenResp = await fetch(`${MS_AUTH_BASE}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody,
      });

      if (!tokenResp.ok) {
        const err = await tokenResp.json().catch(() => ({}));
        throw new Error(err.error_description || err.error || 'Token exchange failed');
      }

      const tokens = await tokenResp.json();

      if (!tokens.refresh_token) {
        console.error('[Auth] Microsoft did not return a refresh token.');
        return reply.redirect('/admin#accounts?error=no_refresh_token');
      }

      // Discover calendars and task lists using the new token
      const graphHeaders = { Authorization: `Bearer ${tokens.access_token}` };

      // Get user display name
      let userLabel = 'Microsoft Calendar & Tasks';
      try {
        const meResp = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail', {
          headers: graphHeaders,
        });
        if (meResp.ok) {
          const me = await meResp.json();
          userLabel = me.displayName
            ? `${me.displayName} (Microsoft)`
            : me.mail
              ? `${me.mail} (Microsoft)`
              : userLabel;
        }
      } catch { /* non-critical */ }

      // Discover calendars
      let calendars = [];
      try {
        const calResp = await fetch('https://graph.microsoft.com/v1.0/me/calendars?$top=100&$select=id,name,canEdit,isDefaultCalendar', {
          headers: graphHeaders,
        });
        if (calResp.ok) {
          const calData = await calResp.json();
          calendars = (calData.value || []).map((cal) => ({
            id: cal.id,
            name: cal.name,
            canEdit: cal.canEdit,
            isDefault: cal.isDefaultCalendar || false,
          }));
        }
      } catch (err) {
        console.warn('[Auth] Could not discover Microsoft calendars:', err.message);
      }

      // Discover To Do task lists
      let taskLists = [];
      try {
        const tlResp = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists?$top=100', {
          headers: graphHeaders,
        });
        if (tlResp.ok) {
          const tlData = await tlResp.json();
          taskLists = (tlData.value || []).map((tl) => ({
            id: tl.id,
            name: tl.displayName,
          }));
        }
      } catch (err) {
        console.warn('[Auth] Could not discover Microsoft task lists:', err.message);
      }

      // Store in credential store
      const accountKey = 'microsoft:default';
      setAccount(accountKey, {
        provider: 'microsoft',
        label: userLabel,
        clientId,
        clientSecret,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
        calendarIds: calendars.map((c) => c.id),
        calendars,
        taskLists,
        status: 'connected',
        connectedAt: new Date().toISOString(),
      });

      console.log(`[Auth] Microsoft connected! Found ${calendars.length} calendars and ${taskLists.length} task lists.`);
      return reply.redirect('/admin#accounts?success=microsoft');

    } catch (err) {
      console.error('[Auth] Microsoft token exchange failed:', err.message);
      return reply.redirect('/admin#accounts?error=' + encodeURIComponent(err.message));
    }
  });
}
