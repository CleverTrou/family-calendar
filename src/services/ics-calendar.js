/**
 * ICS Feed calendar service.
 *
 * Fetches and parses standard iCalendar (.ics) feed URLs.
 * These are read-only public/secret URLs that Google Calendar,
 * Outlook.com, and other providers offer — no OAuth2 or
 * developer account required.
 *
 * Uses the same ical.js library as the iCloud CalDAV service.
 */

import ICAL from 'ical.js';
import { listAccounts } from './credential-store.js';

/**
 * Parse raw iCalendar text into normalized event objects.
 * Filters to the requested date window since ICS feeds
 * return all events (no server-side date filtering).
 */
function parseICalEvents(icalData, calendarName, timeMin, timeMax) {
  try {
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    // Detect the calendar name from the VCALENDAR X-WR-CALNAME property
    // (most providers include this). Use it as fallback if no label was set.
    const detectedName = comp.getFirstPropertyValue('x-wr-calname');

    const events = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      // Handle recurring events by expanding occurrences in the date window
      if (event.isRecurring()) {
        const iter = event.iterator();
        let next;
        // Safety cap to avoid infinite loops on badly-formed feeds
        let limit = 500;
        while ((next = iter.next()) && limit-- > 0) {
          const start = next.toJSDate();
          if (start > timeMax) break;

          const duration = event.duration;
          const end = new Date(start.getTime() + duration.toSeconds() * 1000);
          if (end < timeMin) continue;

          events.push({
            id: event.uid + '_' + start.toISOString(),
            title: event.summary || '(No title)',
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: next.isDate,
            location: event.location || null,
            source: 'ics',
            calendarName: calendarName || detectedName || 'ICS Feed',
          });
        }
      } else {
        // Single (non-recurring) event
        const start = event.startDate.toJSDate();
        const end = event.endDate.toJSDate();

        // Filter to date window
        if (end < timeMin || start > timeMax) continue;

        events.push({
          id: event.uid,
          title: event.summary || '(No title)',
          start: start.toISOString(),
          end: end.toISOString(),
          allDay: event.startDate.isDate,
          location: event.location || null,
          source: 'ics',
          calendarName: calendarName || detectedName || 'ICS Feed',
        });
      }
    }

    return events;
  } catch (err) {
    console.error(`[ICS] Error parsing feed "${calendarName}":`, err.message);
    return [];
  }
}

/**
 * Fetch events from all configured ICS feed URLs.
 * Each feed is stored as a separate account in the credential store
 * with provider: 'ics'.
 */
export async function fetchICSEvents(daysBack, daysForward) {
  const accounts = listAccounts();
  const icsAccounts = accounts.filter((a) => a.provider === 'ics');

  if (icsAccounts.length === 0) return [];

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - daysBack);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + daysForward);

  const allEvents = [];

  for (const account of icsAccounts) {
    // Full account data (with URL) from credential store
    const { getAccount } = await import('./credential-store.js');
    const acct = getAccount(account.key);
    if (!acct || !acct.feedUrl) continue;

    try {
      const response = await fetch(acct.feedUrl, {
        headers: { 'User-Agent': 'FamilyCalendar/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const icalData = await response.text();
      const events = parseICalEvents(icalData, acct.label, timeMin, timeMax);
      allEvents.push(...events);

      console.log(`[ICS] Fetched ${events.length} events from "${acct.label}"`);
    } catch (err) {
      console.error(`[ICS] Error fetching "${acct.label}" (${account.key}):`, err.message);
    }
  }

  return allEvents;
}
