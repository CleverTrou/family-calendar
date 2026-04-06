/**
 * Renders the two-week calendar grid view.
 *
 * Layout:
 *   Day-of-week headers (Mon–Sun)
 *   ┌── This Week ─────────────────────────────────┐
 *   │  Mon | Tue | Wed | Thu | Fri | Sat | Sun      │
 *   │  21       22       23       24      ...        │
 *   │  [allday] [allday]                             │
 *   │  9a Meet  10a Doc                              │
 *   └──────────────────────────────────────────────┘
 *   ┌── Next Week ─────────────────────────────────┐
 *   │  (same structure)                             │
 *   └──────────────────────────────────────────────┘
 *
 * All-day events appear INSIDE each day cell (below date, above timed events).
 * Multi-day all-day events appear in each day they span.
 *
 * All user-facing text uses textContent (no innerHTML) to prevent XSS.
 * Color assignment delegates to getColorForEvent() from utils.js.
 */

const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' });
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_EVENTS = 4;

/* ── Main Entry Point ──────────────────────────────── */

/** Index weather daily array by date string for O(1) lookup. */
function buildWeatherMap(weather) {
  const map = {};
  if (weather && weather.daily) {
    for (const day of weather.daily) {
      map[day.date] = day;
    }
  }
  return map;
}

function renderCalendar(events, weather) {
  const container = document.getElementById('calendar-grid');

  if (!events || events.length === 0) {
    container.textContent = '';
    const msg = document.createElement('div');
    msg.className = 'no-events';
    msg.textContent = 'No upcoming events';
    container.appendChild(msg);
    return;
  }

  const { weekDates, weekStart1, weekStart2 } = getTwoWeekRange();
  const week1Dates = weekDates.slice(0, 7);
  const week2Dates = weekDates.slice(7, 14);
  const weatherMap = buildWeatherMap(weather);

  const fragment = document.createDocumentFragment();

  // Day-of-week header (shared across both weeks)
  fragment.appendChild(buildDayHeaders());

  // Week 1
  const week1Label = document.createElement('div');
  week1Label.className = 'week-label';
  week1Label.textContent = 'This Week';
  fragment.appendChild(week1Label);
  fragment.appendChild(buildWeekRow(week1Dates, events, weatherMap));

  // Week 2
  const week2Label = document.createElement('div');
  week2Label.className = 'week-label';
  week2Label.textContent = 'Next Week';
  fragment.appendChild(week2Label);
  fragment.appendChild(buildWeekRow(week2Dates, events, weatherMap));

  container.textContent = '';
  container.appendChild(fragment);
}

/* ── Day-of-Week Header ────────────────────────────── */

function buildDayHeaders() {
  const header = document.createElement('div');
  header.className = 'week-header';
  for (const name of DAY_NAMES) {
    const cell = document.createElement('div');
    cell.className = 'week-header-cell';
    cell.textContent = name;
    header.appendChild(cell);
  }
  return header;
}

/* ── Week Row ──────────────────────────────────────── */

function buildWeekRow(weekDates7, allEvents, weatherMap) {
  const weekRow = document.createElement('div');
  weekRow.className = 'week-row';

  const daysContainer = document.createElement('div');
  daysContainer.className = 'week-days';

  for (const dayDate of weekDates7) {
    daysContainer.appendChild(buildDayCell(dayDate, allEvents, weatherMap));
  }

  weekRow.appendChild(daysContainer);
  return weekRow;
}

/* ── Day Cell ──────────────────────────────────────── */

function buildDayCell(date, allEvents, weatherMap) {
  const cell = document.createElement('div');
  const today = stripTime(new Date());
  const cellDate = stripTime(date);
  const isToday = cellDate.getTime() === today.getTime();
  const isPast = cellDate < today;

  cell.className =
    'day-cell' + (isToday ? ' is-today' : '') + (isPast ? ' is-past' : '');

  // ── Date + Weather header row ──
  const dateRow = document.createElement('div');
  dateRow.className = 'day-cell-header';

  const dateNum = document.createElement('div');
  dateNum.className = 'day-cell-date';
  dateNum.textContent = date.getDate();

  if (date.getDate() === 1) {
    const monthSpan = document.createElement('span');
    monthSpan.className = 'day-cell-month';
    monthSpan.textContent = ' ' + MONTH_SHORT.format(date);
    dateNum.appendChild(monthSpan);
  }
  dateRow.appendChild(dateNum);

  // ── Weather badge (icon + hi/lo) ──
  const dateKey = cellDate.getFullYear() + '-' +
    String(cellDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(cellDate.getDate()).padStart(2, '0');
  const dayWeather = weatherMap[dateKey];
  if (dayWeather) {
    const badge = document.createElement('div');
    badge.className = 'day-weather';
    badge.title = dayWeather.label;

    const icon = document.createElement('span');
    icon.className = 'day-weather-icon';
    icon.textContent = dayWeather.icon;

    const temps = document.createElement('span');
    temps.className = 'day-weather-temps';

    const hi = document.createElement('span');
    hi.className = 'day-weather-hi';
    hi.textContent = dayWeather.high + '\u00B0';

    const lo = document.createElement('span');
    lo.className = 'day-weather-lo';
    lo.textContent = dayWeather.low + '\u00B0';

    temps.appendChild(hi);
    temps.appendChild(lo);
    badge.appendChild(icon);
    badge.appendChild(temps);
    dateRow.appendChild(badge);
  }

  cell.appendChild(dateRow);

  // ── All-day events (below date, above timed events) ──
  // An all-day event with exclusive end date spans [start, end).
  // Show it in every day cell it covers.
  const allDayEvents = allEvents
    .filter((ev) => {
      if (!ev.allDay) return false;
      const evStart = stripTime(parseEventDate(ev.start));
      const evEnd = stripTime(parseEventDate(ev.end)); // exclusive end
      return cellDate >= evStart && cellDate < evEnd;
    })
    .sort((a, b) => parseEventDate(a.start) - parseEventDate(b.start));

  if (allDayEvents.length > 0) {
    const allDayContainer = document.createElement('div');
    allDayContainer.className = 'day-allday-events';
    for (const ev of allDayEvents) {
      allDayContainer.appendChild(buildAllDayEventCompact(ev));
    }
    cell.appendChild(allDayContainer);
  }

  // ── Timed events (non-allDay, starting on this day) ──
  const dayKey = cellDate.getTime();
  const timedEvents = allEvents
    .filter((ev) => !ev.allDay && stripTime(parseEventDate(ev.start)).getTime() === dayKey)
    .sort((a, b) => parseEventDate(a.start) - parseEventDate(b.start));

  const eventsContainer = document.createElement('div');
  eventsContainer.className = 'day-events';

  const visibleCount = Math.min(timedEvents.length, MAX_VISIBLE_EVENTS);
  for (let i = 0; i < visibleCount; i++) {
    eventsContainer.appendChild(buildTimedEventCompact(timedEvents[i]));
  }

  if (timedEvents.length > MAX_VISIBLE_EVENTS) {
    const more = document.createElement('div');
    more.className = 'day-events-more';
    more.textContent = '+' + (timedEvents.length - MAX_VISIBLE_EVENTS) + ' more';
    eventsContainer.appendChild(more);
  }

  cell.appendChild(eventsContainer);
  return cell;
}

/* ── All-Day Event Chip ───────────────────────────── */

function buildAllDayEventCompact(event) {
  const colorInfo = getColorForEvent(event);
  const el = document.createElement('div');
  el.className = 'allday-event';
  el.style.backgroundColor = colorInfo.color;
  el.textContent = event.title;
  el.title = event.title; // tooltip for truncated text
  return el;
}

/* ── Compact Timed Event (dot + time + title) ──────── */

function buildTimedEventCompact(event) {
  const colorInfo = getColorForEvent(event);
  const el = document.createElement('div');
  el.className = 'timed-event';

  const dot = document.createElement('span');
  dot.className = 'timed-event-dot';
  dot.style.backgroundColor = colorInfo.color;

  const time = document.createElement('span');
  time.className = 'timed-event-time';
  time.textContent = formatTime(event.start);

  const title = document.createElement('span');
  title.className = 'timed-event-title';
  title.textContent = event.title;

  el.appendChild(dot);
  el.appendChild(time);
  el.appendChild(title);

  return el;
}
