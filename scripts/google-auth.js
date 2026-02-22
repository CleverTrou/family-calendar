/**
 * One-time Google Calendar OAuth2 setup script.
 *
 * Run this ONCE on your MacBook to get a refresh token:
 *   npm run auth:google
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use an existing one)
 *   3. Enable "Google Calendar API" (APIs & Services > Library)
 *   4. Create OAuth 2.0 credentials (APIs & Services > Credentials)
 *      - Application type: "Web application"
 *      - Authorized redirect URI: http://localhost:9090/callback
 *   5. Copy Client ID and Client Secret into your .env file
 *
 * This script will:
 *   1. Open your browser for Google consent
 *   2. Capture the authorization code via a local callback server
 *   3. Exchange it for tokens and print the refresh token
 *   4. You paste the refresh token into your .env file
 */

import { google } from 'googleapis';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { URL } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 9090;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || clientId.includes('your-client-id')) {
  console.error(
    '\n\u274C Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.\n' +
      'See instructions at the top of this file.\n'
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  prompt: 'consent', // Force consent to always get a refresh token
});

console.log('\n\uD83D\uDCCB Opening browser for Google Calendar authorization...\n');
console.log('If the browser doesn\'t open, visit this URL manually:\n');
console.log(authUrl);
console.log('');

// Open browser safely using execFile (no shell injection risk)
execFile('open', [authUrl]);

// Temporary callback server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Authorization denied</h2><p>You can close this window.</p>');
    console.error('\n\u274C Authorization denied:', error, '\n');
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end('Missing authorization code');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<h2>Authorization successful!</h2>' +
        '<p>You can close this window and check your terminal.</p>'
    );

    console.log('\n\u2705 Authorization successful!\n');
    console.log('Add this to your .env file:\n');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');

    if (tokens.access_token) {
      // Quick test: list calendars so user can find their calendar IDs
      oauth2Client.setCredentials(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calList = await calendar.calendarList.list();

      console.log('\uD83D\uDCC5 Your Google Calendars:\n');
      for (const cal of calList.data.items || []) {
        console.log('  ' + cal.summary);
        console.log('    ID: ' + cal.id);
        console.log('    Access: ' + cal.accessRole + '\n');
      }
      console.log(
        'Add the calendar IDs you want to display to GOOGLE_CALENDAR_IDS in .env\n' +
          '(comma-separated, e.g.: primary,family123@group.calendar.google.com)\n'
      );
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h2>Error exchanging token</h2>');
    console.error('\n\u274C Token exchange failed:', err.message, '\n');
  }

  server.close();
  setTimeout(() => process.exit(0), 1000);
});

server.listen(PORT, () => {
  console.log('Waiting for callback on http://localhost:' + PORT + '/callback ...\n');
});
