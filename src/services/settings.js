import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'settings.json');

/**
 * Default settings applied when no settings.json exists or when
 * new keys are added in future versions. Uses Object.assign-style
 * merging so existing user settings are preserved.
 */
const DEFAULTS = {
  calendars: {
    // Which calendars to show (keyed by "source:calendarName")
    // Populated dynamically as calendars are discovered
    visible: {},
    // Color overrides per calendar-name keyword
    colors: {
      person1: '#4285f4',
      person2: '#e91e8c',
      family: '#0f9d58',
      outlook: '#0078d4',
      default: '#78909c',
    },
  },
  display: {
    theme: 'auto',           // 'light', 'dark', 'auto', or 'auto-sun'
    colorTheme: 'default',   // color palette key from COLOR_THEMES
    displayStyle: 'kitchen-paper', // decorative style: 'default', 'kitchen-paper', 'japandi'
    font: 'system',          // typeface pairing key from TYPEFACE_PAIRINGS
    weekStart: 'monday',     // 'monday' or 'sunday' — first column of the grid
    darkModeStart: 21,       // hour (24h) to switch to dark
    darkModeEnd: 7,          // hour (24h) to switch to light
    screenSchedule: true,    // enable screen on/off schedule
    screenOnTime: '06:30',   // HH:MM — when to turn screen on
    screenOffTime: '23:00',  // HH:MM — when to turn screen off
    screenOnDays: [1, 2, 3, 4, 5, 6, 0], // days of week (0=Sun, 1=Mon, ...)
    controlTvViaCec: false,    // send HDMI-CEC wake/standby commands to the TV on schedule transitions
    displayScale: 1,           // UI scale factor (0.5–3, applied as CSS zoom + Chromium flag)
  },
  weather: {
    lat: '',                 // latitude for weather forecasts
    lon: '',                 // longitude for weather forecasts
  },
};

/**
 * Typeface pairings available in the settings panel.
 * Each pairing defines a display font (clock, headings) and body font (text).
 * 'system' uses the OS default; others load from Google Fonts.
 *
 * Kept in sync with TYPEFACE_PAIRINGS in frontend/js/themes.js.
 */
export const AVAILABLE_FONTS = {
  system: {
    label: 'System',
    description: 'OS default',
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleImport: null,
  },
  editorial: {
    label: 'Editorial',
    description: 'Fraunces · Inter',
    stack: '"Fraunces", Georgia, serif',
    googleImport: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700',
  },
  mincho: {
    label: 'Mincho',
    description: 'Shippori Mincho',
    stack: '"Shippori Mincho", Georgia, serif',
    googleImport: 'Shippori+Mincho:wght@400;500;600;700;800',
  },
  gothic: {
    label: 'Gothic',
    description: 'Zen Kaku Gothic',
    stack: '"Zen Kaku Gothic New", "Inter", sans-serif',
    googleImport: 'Zen+Kaku+Gothic+New:wght@400;500;700;900',
  },
  newsreader: {
    label: 'Newsreader',
    description: 'Newsreader',
    stack: '"Newsreader", Georgia, serif',
    googleImport: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700',
  },
  grotesk: {
    label: 'Grotesk',
    description: 'IBM Plex Sans · Mono',
    stack: '"IBM Plex Sans", "Inter", sans-serif',
    googleImport: 'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600',
  },
};

/** Load settings from disk, merging with defaults for any missing keys. */
export function loadSettings() {
  let saved = {};
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    saved = JSON.parse(raw);
  } catch {
    // File doesn't exist yet or is invalid — use defaults
  }
  const merged = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), saved);

  // Migration: if user has custom person color keys, strip generic placeholders
  // so "person1"/"person2" don't appear alongside real names like "trevor"/"larissa"
  if (saved.calendars && saved.calendars.colors) {
    const SYSTEM_KEYS = new Set(['family', 'outlook', 'default', 'person1', 'person2']);
    const hasCustomPeople = Object.keys(saved.calendars.colors).some((k) => !SYSTEM_KEYS.has(k));
    if (hasCustomPeople) {
      delete merged.calendars.colors.person1;
      delete merged.calendars.colors.person2;
    }
  }

  return merged;
}

/** Save settings to disk. */
export function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  return settings;
}

/** Get the list of available fonts (for the admin panel dropdown). */
export function getAvailableFonts() {
  return AVAILABLE_FONTS;
}

/**
 * Register a discovered calendar so it appears in the visibility toggles.
 * Called by the calendar store after each sync.
 */
export function registerCalendar(source, calendarName) {
  const key = `${source}:${calendarName}`;
  const settings = loadSettings();
  if (!(key in settings.calendars.visible)) {
    // Default new calendars to visible
    settings.calendars.visible[key] = true;
    saveSettings(settings);
  }
}

/**
 * Check if a specific calendar should be shown on the display.
 * Returns true if visible or if the calendar hasn't been configured yet.
 */
export function isCalendarVisible(source, calendarName) {
  const settings = loadSettings();
  const key = `${source}:${calendarName}`;
  // Default to visible if not yet in settings
  return settings.calendars.visible[key] !== false;
}

/** Deep merge: target values are overwritten by source values. */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
