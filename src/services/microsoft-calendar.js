/**
 * Microsoft Outlook Calendar integration via Graph API.
 *
 * Fetches events from all calendars visible to the authenticated user.
 * Automatically discovers calendars each sync cycle (like Google).
 * Uses the shared microsoft-graph.js helper for auth and API calls.
 */

import { graphGet, graphGetAll } from './microsoft-graph.js';
import { getAccount, setAccount } from './credential-store.js';

const ACCOUNT_KEY = 'microsoft:default';

/**
 * Discover all calendars visible to the authenticated user.
 * Updates the credential store so new calendars are picked up.
 */
async function discoverCalendars() {
  try {
    const data = await graphGet(ACCOUNT_KEY, '/me/calendars', {
      $top: '100',
      $select: 'id,name,canEdit,isDefaultCalendar,color',
    });

    const calendars = (data.value || []).map((cal) => ({
      id: cal.id,
      name: cal.name,
      canEdit: cal.canEdit,
      isDefault: cal.isDefaultCalendar || false,
    }));

    const calendarIds = calendars.map((c) => c.id);
    setAccount(ACCOUNT_KEY, { calendarIds, calendars });
    return calendarIds;
  } catch (err) {
    console.warn('[Microsoft] Calendar discovery failed, using stored list:', err.message);
    return null;
  }
}

/**
 * Fetch events from all Microsoft Outlook calendars.
 * Dynamically discovers calendars each sync.
 *
 * @param {number} daysBack - Days in the past to fetch
 * @param {number} daysForward - Days in the future to fetch
 * @returns {Promise<object[]>} Normalized event objects
 */
export async function fetchMicrosoftEvents(daysBack, daysForward) {
  const account = getAccount(ACCOUNT_KEY);
  if (!account) return [];

  // Discover live calendar list, fall back to stored IDs
  const calendarIds = await discoverCalendars() || account.calendarIds || [];

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - daysBack);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + daysForward);

  const startDateTime = timeMin.toISOString();
  const endDateTime = timeMax.toISOString();

  const allEvents = [];

  for (const calendarId of calendarIds) {
    try {
      // calendarView returns expanded recurring events
      const events = await graphGetAll(
        ACCOUNT_KEY,
        `/me/calendars/${calendarId}/calendarView`,
        {
          startDateTime,
          endDateTime,
          $top: '250',
          $select: 'id,subject,start,end,isAllDay,location,isCancelled',
          $orderby: 'start/dateTime',
        },
      );

      // Look up calendar name from stored metadata
      const acct = getAccount(ACCOUNT_KEY);
      const calMeta = (acct.calendars || []).find((c) => c.id === calendarId);
      const calendarName = calMeta?.name || 'Outlook';

      const mapped = events
        .filter((e) => !e.isCancelled)
        .map((event) => ({
          id: `ms:${event.id}`,
          title: event.subject || '(No title)',
          start: event.isAllDay
            ? event.start.dateTime.split('T')[0]
            : event.start.dateTime + (event.start.timeZone === 'UTC' ? 'Z' : ''),
          end: event.isAllDay
            ? event.end.dateTime.split('T')[0]
            : event.end.dateTime + (event.end.timeZone === 'UTC' ? 'Z' : ''),
          allDay: event.isAllDay || false,
          location: event.location?.displayName || null,
          source: 'microsoft',
          calendarName,
        }));

      allEvents.push(...mapped);
    } catch (err) {
      console.error(`[Microsoft] Error fetching calendar "${calendarId}":`, err.message);
    }
  }

  return allEvents;
}

/** Reset function for consistency with other services. */
export function resetMicrosoftClient() {
  // No persistent client to reset — Graph helper re-reads credentials each call
}
