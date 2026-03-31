import { google } from 'googleapis';
import { getGoogleCredentials, setAccount } from './credential-store.js';

let oauth2Client = null;

function getAuth() {
  if (!oauth2Client) {
    const creds = getGoogleCredentials();
    if (!creds) throw new Error('No Google credentials configured');

    oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
    oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  }
  return oauth2Client;
}

/** Reset the cached OAuth2 client (call after credential changes). */
export function resetGoogleClient() {
  oauth2Client = null;
}

/**
 * Discover all calendars visible to the authenticated user.
 * Updates the stored calendarIds so new subscriptions (e.g., holidays)
 * and deletions are picked up automatically.
 */
async function discoverCalendars(calendarApi) {
  try {
    const calList = await calendarApi.calendarList.list();
    const calendars = (calList.data.items || []).map((cal) => ({
      id: cal.id,
      name: cal.summary,
      accessRole: cal.accessRole,
      primary: cal.primary || false,
    }));

    // Update the credential store with the live calendar list
    const calendarIds = calendars.map((c) => c.id);
    setAccount('google:default', { calendarIds, calendars });

    return calendarIds;
  } catch (err) {
    console.warn('[Google] Calendar discovery failed, using stored list:', err.message);
    return null; // fallback to stored calendarIds
  }
}

/**
 * Fetch events from all Google Calendars.
 * Dynamically discovers calendars each sync so new subscriptions
 * (e.g., holidays) and deletions are picked up automatically.
 */
export async function fetchGoogleEvents(daysBack, daysForward) {
  const creds = getGoogleCredentials();
  if (!creds) return [];

  const auth = getAuth();
  const calendarApi = google.calendar({ version: 'v3', auth });

  // Discover live calendar list, fall back to stored IDs
  const calendarIds = await discoverCalendars(calendarApi) || creds.calendarIds;

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - daysBack);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + daysForward);

  const allEvents = [];

  for (const calendarId of calendarIds) {
    try {
      const response = await calendarApi.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      const calendarName = response.data.summary || calendarId;

      const events = (response.data.items || []).map((event) => ({
        id: event.id,
        title: event.summary || '(No title)',
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        allDay: !event.start.dateTime,
        location: event.location || null,
        source: 'google',
        calendarName,
      }));

      allEvents.push(...events);
    } catch (err) {
      console.error(`[Google] Error fetching "${calendarId}":`, err.message);
    }
  }

  return allEvents;
}
