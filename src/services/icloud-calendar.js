import { DAVClient } from 'tsdav';
import ICAL from 'ical.js';
import { getICloudCredentials } from './credential-store.js';

let client = null;

async function getClient() {
  if (!client) {
    const creds = getICloudCredentials();
    if (!creds) throw new Error('No iCloud credentials configured');

    client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: creds.username,
        password: creds.appPassword,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });
    await client.login();
  }
  return client;
}

/**
 * Parse raw iCalendar text into normalized event objects.
 * Handles VEVENT components and extracts key fields.
 */
function parseICalEvents(icalData, calendarName) {
  try {
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    return vevents.map((vevent) => {
      const event = new ICAL.Event(vevent);
      return {
        id: event.uid,
        title: event.summary || '(No title)',
        start: event.startDate.toJSDate().toISOString(),
        end: event.endDate.toJSDate().toISOString(),
        allDay: event.startDate.isDate,
        location: event.location || null,
        source: 'icloud',
        calendarName,
      };
    });
  } catch (err) {
    console.error(`[iCloud] Error parsing iCal for "${calendarName}":`, err.message);
    return [];
  }
}

/**
 * Fetch events from all configured iCloud Calendars via CalDAV.
 */
export async function fetchICloudEvents(daysBack, daysForward) {
  const creds = getICloudCredentials();
  if (!creds) return [];

  const davClient = await getClient();
  const calendars = await davClient.fetchCalendars();

  const timeStart = new Date();
  timeStart.setDate(timeStart.getDate() - daysBack);
  const timeEnd = new Date();
  timeEnd.setDate(timeEnd.getDate() + daysForward);

  const allEvents = [];

  for (const cal of calendars) {
    const calName = cal.displayName || '';

    // Filter to only configured calendar names (if any specified)
    if (
      creds.calendarNames.length > 0 &&
      !creds.calendarNames.includes(calName.toLowerCase())
    ) {
      continue;
    }

    try {
      const objects = await davClient.fetchCalendarObjects({
        calendar: cal,
        timeRange: {
          start: timeStart.toISOString(),
          end: timeEnd.toISOString(),
        },
        expand: true,
      });

      for (const obj of objects) {
        if (obj.data) {
          allEvents.push(...parseICalEvents(obj.data, calName));
        }
      }
    } catch (err) {
      console.error(`[iCloud] Error fetching "${calName}":`, err.message);
    }
  }

  return allEvents;
}

/** Reset the cached client (useful if auth fails and needs refresh). */
export function resetICloudClient() {
  client = null;
}
