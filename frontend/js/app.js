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

    renderCalendar(currentData.events, currentData.weather);
    renderReminders(currentData.reminders);
    updateHeaderWeather(currentData.weather);
    updateSyncStatus(currentData);
  } catch (err) {
    console.error('[App] Fetch failed:', err);
    document.getElementById('sync-status').textContent = '\u26A0\uFE0F Offline';
  }
}

function updateSyncStatus(data) {
  const statusEl = document.getElementById('sync-status');
  const footerSyncEl = document.getElementById('footer-sync');
  const footerCountsEl = document.getElementById('footer-counts');

  if (data.lastError) {
    statusEl.textContent = '\u26A0\uFE0F';
    statusEl.title = data.lastError;
  } else {
    statusEl.textContent = '\u25CF';
    statusEl.style.color = '#0f9d58';
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

/* ── Font ───────────────────────────────────────────── */

function applyFont(fontKey) {
  if (!fontKey || fontKey === 'system') {
    // Remove any Google Fonts link and reset to system font
    if (currentFontLink) {
      currentFontLink.remove();
      currentFontLink = null;
    }
    document.documentElement.style.removeProperty('--display-font');
    return;
  }

  // Font metadata is embedded in settings from the backend,
  // but we also need the Google Fonts import URL. We can construct it
  // from the font key using a known mapping.
  var fontMap = {
    inter:         { stack: '"Inter", sans-serif',         imp: 'Inter:wght@400;500;600;700' },
    'source-sans': { stack: '"Source Sans 3", sans-serif', imp: 'Source+Sans+3:wght@400;500;600;700' },
    lato:          { stack: '"Lato", sans-serif',          imp: 'Lato:wght@400;700' },
    nunito:        { stack: '"Nunito", sans-serif',        imp: 'Nunito:wght@400;600;700' },
    'roboto-slab': { stack: '"Roboto Slab", serif',        imp: 'Roboto+Slab:wght@400;500;600;700' },
    merriweather:  { stack: '"Merriweather", serif',       imp: 'Merriweather:wght@400;700' },
  };

  var font = fontMap[fontKey];
  if (!font) return;

  // Load Google Font if not already loaded
  var importUrl = 'https://fonts.googleapis.com/css2?family=' + font.imp + '&display=swap';
  if (!currentFontLink || currentFontLink.href !== importUrl) {
    if (currentFontLink) currentFontLink.remove();
    currentFontLink = document.createElement('link');
    currentFontLink.rel = 'stylesheet';
    currentFontLink.href = importUrl;
    document.head.appendChild(currentFontLink);
  }

  document.documentElement.style.setProperty('--display-font', font.stack);
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
