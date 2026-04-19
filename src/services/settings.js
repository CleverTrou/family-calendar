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
    font: 'system',          // font key from AVAILABLE_FONTS
    weekStart: 'monday',     // 'monday' or 'sunday' — first column of the grid
    darkModeStart: 21,       // hour (24h) to switch to dark
    darkModeEnd: 7,          // hour (24h) to switch to light
    screenSchedule: true,    // enable screen on/off schedule
    screenOnTime: '06:30',   // HH:MM — when to turn screen on
    screenOffTime: '23:00',  // HH:MM — when to turn screen off
    screenOnDays: [1, 2, 3, 4, 5, 6, 0], // days of week (0=Sun, 1=Mon, ...)
    displayScale: 1,           // UI scale factor (0.5–3, applied as CSS zoom + Chromium flag)
  },
  weather: {
    lat: '',                 // latitude for weather forecasts
    lon: '',                 // longitude for weather forecasts
  },
};

/**
 * Fonts available in the settings panel.
 * 'system' uses the OS default. Others are Google Fonts loaded by the frontend.
 */
export const AVAILABLE_FONTS = {
  system: {
    label: 'System Default',
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleImport: null,
  },
  inter: {
    label: 'Inter',
    stack: '"Inter", sans-serif',
    googleImport: 'Inter:wght@400;500;600;700',
  },
  'source-sans': {
    label: 'Source Sans 3',
    stack: '"Source Sans 3", sans-serif',
    googleImport: 'Source+Sans+3:wght@400;500;600;700',
  },
  lato: {
    label: 'Lato',
    stack: '"Lato", sans-serif',
    googleImport: 'Lato:wght@400;700',
  },
  nunito: {
    label: 'Nunito',
    stack: '"Nunito", sans-serif',
    googleImport: 'Nunito:wght@400;600;700',
  },
  'roboto-slab': {
    label: 'Roboto Slab',
    stack: '"Roboto Slab", serif',
    googleImport: 'Roboto+Slab:wght@400;500;600;700',
  },
  merriweather: {
    label: 'Merriweather',
    stack: '"Merriweather", serif',
    googleImport: 'Merriweather:wght@400;700',
  },
  fraunces: {
    label: 'Fraunces',
    stack: '"Fraunces", Georgia, serif',
    googleImport: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700',
  },
  newsreader: {
    label: 'Newsreader',
    stack: '"Newsreader", Georgia, serif',
    googleImport: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700',
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
