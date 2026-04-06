/**
 * Shared utility functions for the family calendar display.
 */

/* ── Calendar Color Mapping ─────────────────────────── */

// Default colors (overridden by settings from the API when available)
let calendarColors = {
  trevor: '#4285f4',
  larissa: '#e91e8c',
  family: '#0f9d58',
  default: '#78909c',
};

/**
 * Update the color palette from settings.
 * Called by app.js after each data fetch.
 */
function applyColorSettings(colors) {
  if (colors) {
    calendarColors = { ...calendarColors, ...colors };
    // Also update CSS custom properties so the legend dots use settings colors
    const root = document.documentElement;
    root.style.setProperty('--color-trevor', calendarColors.trevor);
    root.style.setProperty('--color-larissa', calendarColors.larissa);
    root.style.setProperty('--color-family', calendarColors.family);
  }
}

/**
 * Color keys that should NOT be matched against event title/notes.
 * These are generic service or system names that would cause false
 * positives (e.g. an event titled "Outlook on life" → Microsoft blue).
 * All other color keys are treated as person/group names and will
 * be checked against title/notes as a fallback.
 */
const NON_PERSON_KEYS = new Set(['default', 'outlook']);

/**
 * Determine display color for an event.
 *
 * Priority:
 *   1. Calendar name contains any color key (person or non-person)
 *   2. Event title contains a person key
 *   3. Event notes/description contains a person key
 *   4. Fall back to the default gray
 */
function getColorForEvent(event) {
  const name = (event.calendarName || '').toLowerCase();

  // 1. Calendar name — match all keys (person + non-person like "outlook")
  for (const [key, color] of Object.entries(calendarColors)) {
    if (key === 'default') continue;
    if (name.includes(key)) return { color, label: key.charAt(0).toUpperCase() + key.slice(1) };
  }

  // 2–3. Title, then notes — only match person/group keys
  const title = (event.title || '').toLowerCase();
  const notes = (event.notes || event.description || '').toLowerCase();
  const personKeys = Object.keys(calendarColors).filter((k) => !NON_PERSON_KEYS.has(k));

  for (const key of personKeys) {
    if (title.includes(key)) return { color: calendarColors[key], label: key.charAt(0).toUpperCase() + key.slice(1) };
  }
  for (const key of personKeys) {
    if (notes.includes(key)) return { color: calendarColors[key], label: key.charAt(0).toUpperCase() + key.slice(1) };
  }

  return { color: calendarColors.default, label: event.calendarName || 'Other' };
}

/* ── Date / Time Formatting ─────────────────────────── */

const DATE_FORMAT_WEEKDAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
});
const DATE_FORMAT_FULL = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
});
const DATE_FORMAT_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});
const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatTime(isoString) {
  return TIME_FORMAT.format(new Date(isoString));
}

function formatDateFull(date) {
  return DATE_FORMAT_FULL.format(date);
}

function formatWeekday(date) {
  return DATE_FORMAT_WEEKDAY.format(date);
}

/**
 * Return a human-friendly day label: "Today", "Tomorrow", or "Wednesday, Jan 15".
 */
function getDayLabel(date) {
  const now = new Date();
  const today = stripTime(now);
  const target = stripTime(date);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${formatWeekday(date)}, ${formatDateFull(date)}`;
}

/**
 * Format a due date for reminders: "Today", "Tomorrow", "Overdue", or "Jan 15".
 */
function formatDueDate(isoString) {
  if (!isoString) return null;
  const due = new Date(isoString);
  const now = new Date();
  const today = stripTime(now);
  const dueDay = stripTime(due);
  const diffDays = Math.round((dueDay - today) / 86400000);

  if (diffDays < 0) return { text: `Overdue (${DATE_FORMAT_SHORT.format(due)})`, overdue: true };
  if (diffDays === 0) return { text: 'Due today', overdue: false };
  if (diffDays === 1) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${DATE_FORMAT_SHORT.format(due)}`, overdue: false };
}

/**
 * Parse an event date string safely as a local date.
 *
 * Date-only strings ("2026-02-24") are parsed by JS as UTC midnight,
 * which shifts to the PREVIOUS day in any timezone west of UTC.
 * This helper detects date-only format and constructs a local Date instead.
 *
 * Strings with a "T" ("2026-02-24T15:00:00") are already parsed as local
 * (unless they end with "Z"), so they pass through to new Date() normally.
 */
function parseEventDate(dateStr) {
  if (typeof dateStr === 'string' && dateStr.length === 10 && !dateStr.includes('T')) {
    // Date-only: "YYYY-MM-DD" → local midnight
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

/** Strip time components, returning midnight of the same day. */
function stripTime(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format "X minutes ago" style relative time. */
function formatRelativeTime(isoString) {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

/**
 * Group events by day for the agenda view.
 * Returns an array of { date, label, events } objects.
 */
function groupEventsByDay(events) {
  const groups = new Map();

  for (const event of events) {
    const dateKey = stripTime(parseEventDate(event.start)).toISOString();
    if (!groups.has(dateKey)) {
      const date = parseEventDate(event.start);
      groups.set(dateKey, {
        date,
        label: getDayLabel(date),
        dateStr: formatDateFull(date),
        isToday: stripTime(date).getTime() === stripTime(new Date()).getTime(),
        events: [],
      });
    }
    groups.get(dateKey).events.push(event);
  }

  return Array.from(groups.values());
}

/* ── Week-Grid Helpers ─────────────────────────────── */

/**
 * Return the Monday (start of ISO week) for the given date.
 * Mon=1, Tue=2, ... Sun=7 convention.
 */
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Return the 14-day window (this week Monday → next week Sunday)
 * plus the two Monday anchor dates.
 */
function getTwoWeekRange() {
  const today = new Date();
  const week1Start = getWeekStart(today);
  const week2Start = new Date(week1Start);
  week2Start.setDate(week2Start.getDate() + 7);

  const weekDates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(week1Start);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    weekDates.push(d);
  }
  return { weekDates, weekStart1: week1Start, weekStart2: week2Start };
}

/**
 * Does this event span more than one calendar day?
 * Covers both all-day multi-day events and timed events crossing midnight.
 */
function isMultiDayEvent(event) {
  if (event.allDay) {
    const startDay = stripTime(parseEventDate(event.start));
    const endDay = stripTime(parseEventDate(event.end));
    // end is exclusive for all-day events, so >1 day means multi-day
    return (endDay - startDay) > 86400000;
  }
  const startDay = stripTime(parseEventDate(event.start));
  const endDay = stripTime(parseEventDate(event.end));
  return startDay.getTime() !== endDay.getTime();
}

/**
 * Calculate CSS Grid column span for a spanning event within a given week.
 * Returns { startCol, endCol } (1-based, endCol is exclusive for grid-column),
 * or null if the event doesn't overlap this week at all.
 *
 * Handles:
 * - All-day events where end is exclusive (Google Calendar convention)
 * - Timed events where end day needs +1 to make exclusive
 * - Clipping to week boundaries (Mon col 1 → Sun col 7)
 */
function getEventDaySpan(event, weekStartDate) {
  const weekStart = stripTime(new Date(weekStartDate));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const evStart = stripTime(parseEventDate(event.start));
  let evEnd;
  if (event.allDay) {
    evEnd = stripTime(parseEventDate(event.end)); // already exclusive
  } else {
    evEnd = stripTime(parseEventDate(event.end));
    evEnd.setDate(evEnd.getDate() + 1); // make exclusive
  }

  // No overlap?
  if (evEnd <= weekStart || evStart >= weekEnd) return null;

  // Clip to week boundaries
  const clippedStart = evStart < weekStart ? weekStart : evStart;
  const clippedEnd = evEnd > weekEnd ? weekEnd : evEnd;

  // 1-based column: Mon=1, Tue=2, ... Sun=7; endCol is exclusive (for grid-column)
  const startCol = Math.round((clippedStart - weekStart) / 86400000) + 1;
  const endCol = Math.round((clippedEnd - weekStart) / 86400000) + 1;

  return { startCol, endCol };
}

/**
 * Assign vertical "lanes" to spanning events so they stack without collision.
 * Uses a greedy first-fit algorithm: for each event, place it in the first
 * lane where its column range doesn't conflict with already-placed events.
 *
 * Returns { assignments: [{ event, lane, startCol, endCol }], laneCount }.
 */
function assignSpanLanes(spanningEvents, weekStartDate) {
  const lanes = []; // each lane is an array of [startCol, endCol) ranges
  const assignments = [];

  for (const event of spanningEvents) {
    const span = getEventDaySpan(event, weekStartDate);
    if (!span) continue;

    let placed = false;
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const occupied = lanes[laneIdx];
      const conflicts = occupied.some(
        ([s, e]) => span.startCol < e && span.endCol > s
      );
      if (!conflicts) {
        occupied.push([span.startCol, span.endCol]);
        assignments.push({ event, lane: laneIdx, ...span });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([[span.startCol, span.endCol]]);
      assignments.push({ event, lane: lanes.length - 1, ...span });
    }
  }

  return { assignments, laneCount: lanes.length };
}
