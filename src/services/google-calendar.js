import { google } from 'googleapis';
import { config } from '../config.js';

let oauth2Client = null;

function getAuth() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret
    );
    oauth2Client.setCredentials({
      refresh_token: config.google.refreshToken,
    });
  }
  return oauth2Client;
}

/**
 * Fetch events from all configured Google Calendars.
 * Returns a normalized array of event objects.
 */
export async function fetchGoogleEvents(daysBack, daysForward) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - daysBack);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + daysForward);

  const allEvents = [];

  for (const calendarId of config.google.calendarIds) {
    try {
      const response = await calendar.events.list({
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
