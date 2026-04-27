/**
 * Main application controller for the family calendar display.
 * Handles data fetching, clock updates, settings-driven theming, and burn-in prevention.
 */

var REFRESH_INTERVAL = 60_000;         // Fetch new data every 60 seconds
const CLOCK_INTERVAL = 1_000;          // Update clock every second
const THEME_CHECK_INTERVAL = 60_000;   // Check light/dark every minute
const PIXEL_SHIFT_INTERVAL = 30 * 60_000; // Shift pixels every 30 min

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const HEADER_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

let currentData = null;
let currentFontLink = null;  // Track the Google Fonts <link> element

/* ── Data Fetching ──────────────────────────────────── */

async function fetchData() {
  try {
    const response = await fetch('/api/calendar');
    if (!response.ok) throw new Error('HTTP ' + response.status);
    currentData = await response.json();

    // In lightweight mode (Pi Zero / low-RAM), reduce polling frequency
    if (currentData.lightweight && REFRESH_INTERVAL < 120_000) {
      REFRESH_INTERVAL = 120_000;
    }

    // Apply settings before rendering
    if (currentData.settings) {
      applySettings(currentData.settings);
    }

    const display = (currentData.settings && currentData.settings.display) || {};
    renderCalendar(currentData.events, currentData.weather, { weekStart: display.weekStart });
    renderReminders(currentData.reminders);
    updateHeaderWeather(currentData.weather);
    updateSyncStatus(currentData);
  } catch (err) {
    console.error('[App] Fetch failed:', err);
    const statusEl = document.getElementById('sync-status');
    const iconEl = document.getElementById('sync-status-icon');
    const textEl = document.getElementById('sync-status-text');
    statusEl.classList.add('is-error');
    iconEl.textContent = '\u26A0';
    textEl.textContent = 'Offline — check server connection';
    statusEl.title = err.message || 'Network error';
  }
}

function updateSyncStatus(data) {
  const statusEl = document.getElementById('sync-status');
  const iconEl = document.getElementById('sync-status-icon');
  const textEl = document.getElementById('sync-status-text');
  const footerSyncEl = document.getElementById('footer-sync');
  const footerCountsEl = document.getElementById('footer-counts');

  if (data.lastError) {
    statusEl.classList.add('is-error');
    iconEl.textContent = '\u26A0'; // ⚠ warning sign
    textEl.textContent = 'Sync error — check Admin \u2192 System \u2192 Logs';
    statusEl.title = data.lastError;
  } else {
    statusEl.classList.remove('is-error');
    iconEl.textContent = '\u25CF'; // ● filled circle
    textEl.textContent = '';
    statusEl.title = '';
  }

  footerSyncEl.textContent = 'Calendars synced ' + formatRelativeTime(data.lastSyncTime);

  const incomplete = data.reminders.items
    ? data.reminders.items.filter(function (r) { return !r.isCompleted; }).length
    : 0;
  footerCountsEl.textContent = data.events.length + ' events \u00B7 ' + incomplete + ' reminders';
}

/* ── Settings Application ──────────────────────────── */

function applySettings(settings) {
  // Colors
  if (settings.calendars && settings.calendars.colors) {
    applyColorSettings(settings.calendars.colors);
  }

  // Theme
  if (settings.display) {
    applyColorTheme(settings.display.colorTheme || 'default');
    applyDisplayStyle(settings.display.displayStyle || 'kitchen-paper');
    updateThemeFromSettings(settings.display);
    applyFont(settings.display.font);
    applyDisplayScale(settings.display.displayScale);
  }
}

/* ── Header Weather ────────────────────────────────── */

function updateHeaderWeather(weather) {
  const el = document.getElementById('header-weather');
  if (!weather || !weather.current) {
    el.textContent = '';
    return;
  }
  const { temp, icon, label } = weather.current;
  el.textContent = `${icon} ${temp}°`;
  el.title = label;
}

/* ── Clock ──────────────────────────────────────────── */

function updateClock() {
  var now = new Date();
  document.getElementById('clock').textContent = CLOCK_FORMAT.format(now);
  document.getElementById('date').textContent = HEADER_DATE_FORMAT.format(now);
}

/* ── Theme ──────────────────────────────────────────── */

function updateTheme() {
  if (currentData && currentData.settings && currentData.settings.display) {
    updateThemeFromSettings(currentData.settings.display);
  } else {
    // Fallback defaults before first fetch
    var hour = new Date().getHours();
    var isDark = hour >= 21 || hour < 7;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }
}

function updateThemeFromSettings(display) {
  var theme = display.theme || 'auto';

  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    return;
  }

  // Auto (sunrise/sunset): use sun calculator if location is available
  if (theme === 'auto-sun') {
    var weather = currentData && currentData.settings && currentData.settings.weather;
    var lat = weather && parseFloat(weather.lat);
    var lon = weather && parseFloat(weather.lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      var isDark = isSunDark(lat, lon);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      return;
    }
    // No location configured — fall through to fixed-hours auto
  }

  // Auto (fixed hours): use configured hours
  var hour = new Date().getHours();
  var start = display.darkModeStart != null ? display.darkModeStart : 21;
  var end = display.darkModeEnd != null ? display.darkModeEnd : 7;
  var isDark = hour >= start || hour < end;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/* ── Font / Typeface ────────────────────────────────── */

function applyFont(fontKey) {
  // Delegate to themes.js applyTypefacePairing which handles
  // multi-variable font pairings (--display-font + --body-font).
  // Legacy single-font keys not in TYPEFACE_PAIRINGS fall back to system.
  if (typeof applyTypefacePairing === 'function') {
    applyTypefacePairing(fontKey);
    // Keep currentFontLink in sync (applyTypefacePairing manages its own link)
    currentFontLink = document.getElementById('typeface-gfont');
  }
}

/* ── Display Scale (CSS zoom) ──────────────────────── */

function applyDisplayScale(scale) {
  if (!scale || scale === 1) {
    document.documentElement.style.removeProperty('zoom');
    return;
  }
  document.documentElement.style.zoom = scale;
}

/* ── Burn-in Prevention (subtle pixel shift) ────────── */

function pixelShift() {
  var x = Math.floor(Math.random() * 5) - 2; // -2 to +2 px
  var y = Math.floor(Math.random() * 5) - 2;
  document.body.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
}

/* ── Initialization ─────────────────────────────────── */

updateClock();
updateTheme();
fetchData();

setInterval(fetchData, REFRESH_INTERVAL);
setInterval(updateClock, CLOCK_INTERVAL);
setInterval(updateTheme, THEME_CHECK_INTERVAL);
setInterval(pixelShift, PIXEL_SHIFT_INTERVAL);
