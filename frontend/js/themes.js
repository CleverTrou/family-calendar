/**
 * Color theme palettes for the family calendar display.
 *
 * Each theme defines light and dark variants using the same CSS custom
 * properties as styles.css. Themes are applied by injecting a <style>
 * element that overrides the default palette via cascade (same selector
 * specificity, later source order wins).
 *
 * The "default" theme uses no overrides — it falls back to styles.css.
 * Person/calendar accent colors (--color-primary, --color-secondary,
 * --color-family) are NOT part of themes — those are user-configured.
 */

/* eslint-disable quote-props */
var COLOR_THEMES = {
  'default': {
    label: 'Default',
    // No overrides — uses styles.css values
  },

  'nord': {
    label: 'Nord',
    light: {
      '--bg-body':         '#e5e9f0',
      '--bg-card':         '#eceff4',
      '--bg-panel-header': '#d8dee9',
      '--text-primary':    '#2e3440',
      '--text-secondary':  '#3b4252',
      '--text-muted':      '#4c566a',
      '--border':          '#c8d0de',
      '--shadow':          'rgba(46, 52, 64, 0.08)',
      '--reminder-done':   '#b8c4d8',
    },
    dark: {
      '--bg-body':         '#242933',
      '--bg-card':         '#2e3440',
      '--bg-panel-header': '#3b4252',
      '--text-primary':    '#eceff4',
      '--text-secondary':  '#d8dee9',
      '--text-muted':      '#7e8a9e',
      '--border':          '#3b4252',
      '--shadow':          'rgba(0, 0, 0, 0.3)',
      '--reminder-done':   '#4c566a',
    },
  },

  'ocean': {
    label: 'Ocean',
    light: {
      '--bg-body':         '#e8f0f8',
      '--bg-card':         '#f0f6fc',
      '--bg-panel-header': '#dce8f4',
      '--text-primary':    '#0c2d48',
      '--text-secondary':  '#1a4568',
      '--text-muted':      '#3b6a8c',
      '--border':          '#c0d6ea',
      '--shadow':          'rgba(12, 45, 72, 0.07)',
      '--reminder-done':   '#a8c4dc',
    },
    dark: {
      '--bg-body':         '#0a1929',
      '--bg-card':         '#112340',
      '--bg-panel-header': '#162d4a',
      '--text-primary':    '#e2edf5',
      '--text-secondary':  '#b0cadc',
      '--text-muted':      '#6a8fac',
      '--border':          '#1a3558',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#1e3d5e',
    },
  },

  'forest': {
    label: 'Forest',
    light: {
      '--bg-body':         '#eaf0e8',
      '--bg-card':         '#f2f7f0',
      '--bg-panel-header': '#dde8da',
      '--text-primary':    '#1a2e1a',
      '--text-secondary':  '#2d4a2d',
      '--text-muted':      '#4a6a4a',
      '--border':          '#c4d6c0',
      '--shadow':          'rgba(26, 46, 26, 0.07)',
      '--reminder-done':   '#aac4a6',
    },
    dark: {
      '--bg-body':         '#0e180e',
      '--bg-card':         '#162416',
      '--bg-panel-header': '#1e321e',
      '--text-primary':    '#e0eada',
      '--text-secondary':  '#b8ccb0',
      '--text-muted':      '#6e946a',
      '--border':          '#243824',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#2a4a2a',
    },
  },

  'sunset': {
    label: 'Sunset',
    light: {
      '--bg-body':         '#f8f0e6',
      '--bg-card':         '#fdf8f2',
      '--bg-panel-header': '#f0e4d6',
      '--text-primary':    '#3d2010',
      '--text-secondary':  '#5c3a1e',
      '--text-muted':      '#8b6040',
      '--border':          '#e4d0b8',
      '--shadow':          'rgba(61, 32, 16, 0.07)',
      '--reminder-done':   '#ccb89c',
    },
    dark: {
      '--bg-body':         '#181008',
      '--bg-card':         '#241a10',
      '--bg-panel-header': '#302418',
      '--text-primary':    '#f5e8d8',
      '--text-secondary':  '#d4bfa4',
      '--text-muted':      '#9c7e5c',
      '--border':          '#3c2c1a',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#4a3824',
    },
  },

  'rose': {
    label: 'Rose',
    light: {
      '--bg-body':         '#f8eef2',
      '--bg-card':         '#fdf5f8',
      '--bg-panel-header': '#f0e0e6',
      '--text-primary':    '#3d1525',
      '--text-secondary':  '#5c2040',
      '--text-muted':      '#8b4868',
      '--border':          '#e4c4d2',
      '--shadow':          'rgba(61, 21, 37, 0.07)',
      '--reminder-done':   '#d4a8bc',
    },
    dark: {
      '--bg-body':         '#180a10',
      '--bg-card':         '#241218',
      '--bg-panel-header': '#301a22',
      '--text-primary':    '#f5e0e8',
      '--text-secondary':  '#d4b0c0',
      '--text-muted':      '#9c6880',
      '--border':          '#3c1e2c',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#4a2436',
    },
  },

  'slate': {
    label: 'Slate',
    light: {
      '--bg-body':         '#f1f5f9',
      '--bg-card':         '#f8fafc',
      '--bg-panel-header': '#e2e8f0',
      '--text-primary':    '#0f172a',
      '--text-secondary':  '#334155',
      '--text-muted':      '#64748b',
      '--border':          '#cbd5e1',
      '--shadow':          'rgba(15, 23, 42, 0.06)',
      '--reminder-done':   '#94a3b8',
    },
    dark: {
      '--bg-body':         '#0f172a',
      '--bg-card':         '#1e293b',
      '--bg-panel-header': '#273548',
      '--text-primary':    '#f1f5f9',
      '--text-secondary':  '#cbd5e1',
      '--text-muted':      '#64748b',
      '--border':          '#334155',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#334155',
    },
  },

  'mocha': {
    label: 'Mocha',
    light: {
      '--bg-body':         '#f0ebe6',
      '--bg-card':         '#f8f4f0',
      '--bg-panel-header': '#e4dcd4',
      '--text-primary':    '#3e2723',
      '--text-secondary':  '#5d4037',
      '--text-muted':      '#795548',
      '--border':          '#d7ccc8',
      '--shadow':          'rgba(62, 39, 35, 0.07)',
      '--reminder-done':   '#bcaaa4',
    },
    dark: {
      '--bg-body':         '#1a1210',
      '--bg-card':         '#261c18',
      '--bg-panel-header': '#322622',
      '--text-primary':    '#efebe9',
      '--text-secondary':  '#d7ccc8',
      '--text-muted':      '#8d7468',
      '--border':          '#3e302a',
      '--shadow':          'rgba(0, 0, 0, 0.35)',
      '--reminder-done':   '#4a3830',
    },
  },

  'kitchen-paper': {
    label: 'Kitchen Paper',
    // Warm-domestic: cream paper, deep ink, dashed dividers, pastel event
    // pills with colored left-border, "today" ribbon. Adapted from the
    // Claude Design handoff: "A colorful, wall-mounted display of the
    // family's shared calendar… warm paper textures, muted pastels,
    // handwritten accents." Designed for legibility at ~12 ft.
    light: {
      '--bg-body':         '#fdfaf0',
      '--bg-card':         '#f7f0dc',
      '--bg-panel-header': '#f0e7cc',
      '--bg-day-header':   '#f7f0dc',
      '--text-primary':    '#140d04',
      '--text-secondary':  '#2e2614',
      '--text-muted':      '#5a4c30',
      '--border':          '#d0bf95',
      '--shadow':          'rgba(80, 50, 10, 0.12)',
      '--event-bg-opacity':'0.28',
      '--reminder-done':   '#c9b98f',
    },
    dark: {
      '--bg-body':         '#1a140c',
      '--bg-card':         '#221a10',
      '--bg-panel-header': '#2e2416',
      '--bg-day-header':   '#221a10',
      '--text-primary':    '#f1e5c8',
      '--text-secondary':  '#d4c29a',
      '--text-muted':      '#9b8963',
      '--border':          '#3a2d1a',
      '--shadow':          'rgba(0, 0, 0, 0.5)',
      '--event-bg-opacity':'0.35',
      '--reminder-done':   '#4a3a22',
    },
    // Extra CSS beyond variable overrides — injected only when this
    // theme is selected. Scoped by [data-display-style="kitchen-paper"].
  },
};

/** Ordered keys for consistent UI rendering. */
var COLOR_THEME_ORDER = [
  'default', 'nord', 'ocean', 'forest',
  'sunset', 'rose', 'slate', 'mocha', 'kitchen-paper',
];

/**
 * Apply a color palette by injecting CSS variable overrides.
 * Sets data-color-theme on <html> for palette identification.
 * Decorative styling (grain, rounded cards, etc.) is handled
 * separately by applyDisplayStyle().
 * @param {string} themeName - Key from COLOR_THEMES
 */
function applyColorTheme(themeName) {
  var style = document.getElementById('color-theme-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'color-theme-style';
    document.head.appendChild(style);
  }

  var theme = COLOR_THEMES[themeName];
  if (!theme || !theme.light) {
    style.textContent = '';
    document.documentElement.removeAttribute('data-color-theme');
    return;
  }

  document.documentElement.setAttribute('data-color-theme', themeName);

  var css = ':root[data-theme="light"] {\n';
  for (var kl in theme.light) {
    css += '  ' + kl + ': ' + theme.light[kl] + ';\n';
  }
  css += '}\n';
  css += ':root[data-theme="dark"] {\n';
  for (var kd in theme.dark) {
    css += '  ' + kd + ': ' + theme.dark[kd] + ';\n';
  }
  css += '}\n';

  style.textContent = css;
}

/**
 * Apply a display style by setting data-display-style on <html>
 * and injecting the style's decorative CSS overlay.
 * @param {string} styleName - Key from DISPLAY_STYLES
 */
function applyDisplayStyle(styleName) {
  var style = document.getElementById('display-style-css');
  if (!style) {
    style = document.createElement('style');
    style.id = 'display-style-css';
    document.head.appendChild(style);
  }

  var ds = DISPLAY_STYLES[styleName];
  if (!ds) {
    style.textContent = '';
    document.documentElement.removeAttribute('data-display-style');
    return;
  }

  document.documentElement.setAttribute('data-display-style', styleName);
  style.textContent = ds.css || '';
}

/**
 * Apply a typeface pairing by injecting a Google Fonts link (if needed)
 * and setting CSS font-stack variables on :root.
 * @param {string} pairingKey - Key from TYPEFACE_PAIRINGS, or 'system'
 */
function applyTypefacePairing(pairingKey) {
  var link = document.getElementById('typeface-gfont');

  if (!pairingKey || pairingKey === 'system') {
    if (link) link.remove();
    document.documentElement.style.removeProperty('--display-font');
    document.documentElement.style.removeProperty('--body-font');
    document.documentElement.removeAttribute('data-font');
    return;
  }

  var pairing = TYPEFACE_PAIRINGS[pairingKey];
  if (!pairing) return;

  document.documentElement.setAttribute('data-font', pairingKey);

  var importUrl = 'https://fonts.googleapis.com/css2?family=' + pairing.googleImport + '&display=swap';
  if (!link || link.href !== importUrl) {
    if (link) link.remove();
    link = document.createElement('link');
    link.id = 'typeface-gfont';
    link.rel = 'stylesheet';
    link.href = importUrl;
    document.head.appendChild(link);
  }

  document.documentElement.style.setProperty('--display-font', pairing.displayFont);
  document.documentElement.style.setProperty('--body-font', pairing.bodyFont);
}

/**
 * Kitchen Paper style CSS — warm-domestic aesthetic.
 * Paper grain, rounded cards, dashed dividers, pastel event pills,
 * stacked time/title layout. Scoped by [data-display-style="kitchen-paper"].
 */
function KITCHEN_PAPER_STYLE_CSS() {
  // SVG paper grain — encoded inline to avoid an extra HTTP request.
  var grainLight = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 0.22 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
  var grainDark  = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.4  0 0 0 0.10 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

  return [
    '[data-display-style="kitchen-paper"] body {',
    '  background:',
    '    radial-gradient(120% 80% at 20% 0%, var(--bg-card), var(--bg-body) 55%, var(--bg-card) 100%);',
    '  position: relative;',
    '}',
    '[data-display-style="kitchen-paper"] body::before {',
    '  content: "";',
    '  position: fixed; inset: 0; pointer-events: none; z-index: 0;',
    '  background-image: ' + grainLight + ';',
    '  background-size: 320px 320px;',
    '  mix-blend-mode: multiply;',
    '  opacity: 0.55;',
    '}',
    '[data-display-style="kitchen-paper"][data-theme="dark"] body::before {',
    '  background-image: ' + grainDark + ';',
    '  mix-blend-mode: screen;',
    '  opacity: 0.6;',
    '}',
    /* Layer everything above the grain */
    '[data-display-style="kitchen-paper"] .header,',
    '[data-display-style="kitchen-paper"] .main,',
    '[data-display-style="kitchen-paper"] .footer { position: relative; z-index: 1; }',

    /* Header with dashed bottom rule and warm accents */
    '[data-display-style="kitchen-paper"] .header {',
    '  background: transparent;',
    '  border-bottom: 1px dashed var(--border);',
    '}',
    '[data-display-style="kitchen-paper"] .clock {',
    '  font-weight: 500; letter-spacing: -0.02em;',
    '}',
    '[data-display-style="kitchen-paper"] .date {',
    '  color: var(--text-secondary);',
    '  font-style: italic;',
    '}',
    '[data-display-style="kitchen-paper"] .header-title {',
    '  letter-spacing: 0.22em;',
    '  color: var(--text-muted);',
    '  font-style: italic;',
    '  text-transform: lowercase;',
    '}',

    /* Main: subtle paper gradient, no solid borders between panels */
    '[data-display-style="kitchen-paper"] .main { background: transparent; gap: 0; }',
    '[data-display-style="kitchen-paper"] .calendar-panel,',
    '[data-display-style="kitchen-paper"] .reminders-panel { background: transparent; }',

    /* Week label banner — dashed spine under the handwritten label */
    '[data-display-style="kitchen-paper"] .week-label {',
    '  background: transparent;',
    '  color: var(--text-primary);',
    '  font-weight: 600;',
    '  letter-spacing: 0.02em;',
    '  text-transform: none;',
    '  font-style: italic;',
    '  font-size: 1.3vw;',
    '  padding: 1.2vh 1vw 0.6vh;',
    '  border-bottom: 1px dashed var(--border);',
    '}',

    /* Day-of-week header — subtle, spaced uppercase */
    '[data-display-style="kitchen-paper"] .week-header {',
    '  background: transparent;',
    '  border-bottom: 1px dashed var(--border);',
    '}',
    '[data-display-style="kitchen-paper"] .week-header-cell {',
    '  color: var(--text-muted);',
    '  letter-spacing: 0.2em;',
    '  text-align: left;',
    '  padding-left: 0.8vw;',
    '}',

    /* Week row: no harsh solid border */
    '[data-display-style="kitchen-paper"] .week-row { border-bottom: none; }',
    '[data-display-style="kitchen-paper"] .week-days {',
    '  gap: 0.5vw;',
    '  padding: 0.6vh 0.6vw;',
    '}',

    /* Day cells become rounded "paper cards" with subtle inset shadow */
    '[data-display-style="kitchen-paper"] .day-cell {',
    '  background: var(--bg-card);',
    '  border: 1px solid var(--border);',
    '  border-radius: 10px;',
    '  box-shadow: 0 1px 2px var(--shadow);',
    '  position: relative;',
    '  padding: 0.8vh 0.6vw;',
    '}',
    '[data-display-style="kitchen-paper"] .day-cell::before {',
    '  content: "";',
    '  position: absolute; inset: 0 0 auto 0; height: 16px;',
    '  background: linear-gradient(to bottom, rgba(0,0,0,0.04), transparent);',
    '  pointer-events: none;',
    '  border-radius: 10px 10px 0 0;',
    '}',

    /* Today: warm halo (ribbon label dropped — color alone is enough
       and the ribbon collided with the weather badge on the right) */
    '[data-display-style="kitchen-paper"] .day-cell.is-today {',
    '  background: var(--bg-body);',
    '  border-color: var(--color-family);',
    '  box-shadow: 0 0 0 3px rgba(210, 130, 55, 0.25), 0 2px 10px var(--shadow);',
    '}',
    '[data-display-style="kitchen-paper"] .day-cell.is-today .day-cell-date {',
    '  color: var(--color-family);',
    '}',

    /* Date number: warmer, tighter */
    '[data-display-style="kitchen-paper"] .day-cell-date {',
    '  font-weight: 600;',
    '  letter-spacing: -0.02em;',
    '  line-height: 0.9;',
    '}',

    /* Weather: inline (icon + hi / lo) instead of stacked, with "/" divider */
    '[data-display-style="kitchen-paper"] .day-weather-temps {',
    '  flex-direction: row;',
    '  align-items: baseline;',
    '  gap: 0.15vw;',
    '}',
    '[data-display-style="kitchen-paper"] .day-weather-lo::before {',
    '  content: " / ";',
    '  color: var(--text-muted);',
    '  margin: 0 0.1vw;',
    '}',
    '[data-display-style="kitchen-paper"] .day-weather-hi {',
    '  color: var(--text-secondary);',
    '  font-weight: 600;',
    '}',

    /* All-day event: pastel blended fill + colored left border.
       !important needed to override the inline style.backgroundColor
       set in buildAllDayEventCompact. The --event-color custom prop
       is also set inline on the element so we can color-mix here. */
    '[data-display-style="kitchen-paper"] .allday-event {',
    '  background: color-mix(in oklab, var(--event-color) 28%, var(--bg-body)) !important;',
    '  color: var(--text-primary);',
    '  border-left: 3px solid var(--event-color);',
    '  border-radius: 6px;',
    '  font-weight: 600;',
    '  padding: 0.35vh 0.55vw;',
    '  opacity: 1;',
    '  white-space: normal;',
    '  overflow: visible;',
    '  text-overflow: clip;',
    '  line-height: 1.2;',
    '}',

    /* Timed event: stack time above title so the title gets full cell
       width — addresses "hard to read from across the room". */
    '[data-display-style="kitchen-paper"] .timed-event {',
    '  display: block;',
    '  position: relative;',
    '  padding-left: 1vw;',
    '  font-size: 1.1vw;',
    '  line-height: 1.2;',
    '}',
    '[data-display-style="kitchen-paper"] .timed-event-dot {',
    '  position: absolute; left: 0; top: 0.55vh;',
    '  width: 0.65vw; height: 0.65vw;',
    '}',
    '[data-display-style="kitchen-paper"] .timed-event-time {',
    '  display: block;',
    '  font-size: 0.85vw;',
    '  font-weight: 600;',
    '  color: var(--text-muted);',
    '  letter-spacing: 0.02em;',
    '  text-transform: lowercase;',
    '  margin-bottom: 0.1vh;',
    '}',
    '[data-display-style="kitchen-paper"] .timed-event-title {',
    '  display: block;',
    '  padding-left: 0;',
    '  font-weight: 600;',
    '  font-size: 1.1vw;',
    '  line-height: 1.2;',
    '  white-space: normal;',
    '  overflow: visible;',
    '  text-wrap: pretty;',
    '}',
    '[data-display-style="kitchen-paper"] .day-events-more {',
    '  font-size: 1vw;',
    '  font-style: italic;',
    '  padding-left: 1vw;',
    '}',

    /* Reminders panel: dashed separators, rounded card treatment */
    '[data-display-style="kitchen-paper"] .panel-header {',
    '  background: transparent;',
    '  border-bottom: 1px dashed var(--border);',
    '  color: var(--text-muted);',
    '  font-style: italic;',
    '  letter-spacing: 0.02em;',
    '  text-transform: lowercase;',
    '  font-size: 1.3vw;',
    '  font-weight: 600;',
    '}',
    '[data-display-style="kitchen-paper"] .reminder-item {',
    '  border-bottom: 1px dashed var(--border);',
    '}',
    '[data-display-style="kitchen-paper"] .reminder-checkbox {',
    '  border-color: var(--color-family);',
    '}',
    '[data-display-style="kitchen-paper"] .reminder-checkbox.google-task {',
    '  border-color: var(--color-primary);',
    '  border-radius: 4px;',
    '}',
    '[data-display-style="kitchen-paper"] .reminder-due {',
    '  font-style: italic;',
    '  color: var(--text-muted);',
    '}',
    '[data-display-style="kitchen-paper"] .reminders-meta {',
    '  background: transparent;',
    '  border-top: 1px dashed var(--border);',
    '  font-style: italic;',
    '}',

    /* Footer: dashed top rule, no solid background */
    '[data-display-style="kitchen-paper"] .footer {',
    '  background: transparent;',
    '  border-top: 1px dashed var(--border);',
    '  letter-spacing: 0.16em;',
    '  text-transform: uppercase;',
    '  color: var(--text-muted);',
    '}',
    ''
  ].join('\n');
}

/**
 * Japandi style CSS — minimal, quiet, restrained.
 * Slight rounding (2px), accent top-line on today, pastel event pills,
 * stacked time/title layout, no grain. Scoped by [data-display-style="japandi"].
 */
function JAPANDI_STYLE_CSS() {
  return [
    /* Day cells: slight rounding, card surface */
    '[data-display-style="japandi"] .day-cell {',
    '  background: var(--bg-card);',
    '  border: 1px solid var(--border);',
    '  border-radius: 2px;',
    '  box-shadow: none;',
    '}',

    /* Today: accent top-line instead of halo */
    '[data-display-style="japandi"] .day-cell.is-today {',
    '  background: var(--bg-card);',
    '  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--border));',
    '  box-shadow: inset 0 2px 0 var(--color-primary);',
    '}',
    '[data-display-style="japandi"] .day-cell.is-today .day-cell-date {',
    '  color: var(--color-primary);',
    '}',

    /* All-day events: pastel fill + colored left border */
    '[data-display-style="japandi"] .allday-event {',
    '  background: color-mix(in oklab, var(--event-color) 22%, var(--bg-body)) !important;',
    '  color: var(--text-primary);',
    '  border-left: 3px solid var(--event-color);',
    '  border-radius: 3px;',
    '  font-weight: 600;',
    '  padding: 0.3vh 0.5vw;',
    '  opacity: 1;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '}',

    /* Timed events: stacked time-above-title layout */
    '[data-display-style="japandi"] .timed-event {',
    '  display: block;',
    '  position: relative;',
    '  padding-left: 1vw;',
    '  font-size: 1.1vw;',
    '  line-height: 1.2;',
    '}',
    '[data-display-style="japandi"] .timed-event-dot {',
    '  position: absolute; left: 0; top: 0.55vh;',
    '  width: 0.65vw; height: 0.65vw;',
    '}',
    '[data-display-style="japandi"] .timed-event-time {',
    '  display: block;',
    '  font-size: 0.85vw;',
    '  font-weight: 600;',
    '  color: var(--text-muted);',
    '  letter-spacing: 0.02em;',
    '  margin-bottom: 0.1vh;',
    '}',
    '[data-display-style="japandi"] .timed-event-title {',
    '  display: block;',
    '  font-weight: 600;',
    '  font-size: 1.1vw;',
    '  line-height: 1.2;',
    '  white-space: normal;',
    '  overflow: visible;',
    '  text-wrap: pretty;',
    '}',
    '[data-display-style="japandi"] .day-events-more {',
    '  font-size: 1vw;',
    '  padding-left: 1vw;',
    '}',

    /* Reminders: hairline separators */
    '[data-display-style="japandi"] .reminder-item {',
    '  border-bottom: 1px solid var(--border);',
    '}',
    '[data-display-style="japandi"] .reminder-checkbox {',
    '  border-color: var(--color-family);',
    '}',
    '[data-display-style="japandi"] .reminder-checkbox.google-task {',
    '  border-color: var(--color-primary);',
    '  border-radius: 4px;',
    '}',

    /* Week days: subtle gap between cells */
    '[data-display-style="japandi"] .week-days {',
    '  gap: 0.35vw;',
    '  padding: 0.5vh 0.4vw;',
    '}',
    '[data-display-style="japandi"] .week-row { border-bottom: none; }',

    /* Week label: clean, no italic */
    '[data-display-style="japandi"] .week-label {',
    '  background: transparent;',
    '  border-bottom: 1px solid var(--border);',
    '  font-size: 0.78vw;',
    '  letter-spacing: 0.18em;',
    '  text-transform: uppercase;',
    '  font-weight: 600;',
    '  padding: 0.6vh 0.5vw 0.5vh;',
    '}',
    '[data-display-style="japandi"] .week-header {',
    '  background: transparent;',
    '  border-bottom: 1px solid var(--border);',
    '}',
    ''
  ].join('\n');
}

/* ── Display Styles ──────────────────────────────────────────────────── */

/**
 * Display styles define the decorative layer applied on top of any palette.
 * Style and palette are orthogonal: any style works with any palette.
 *
 * 'default'       — base styles.css only; no overlay
 * 'kitchen-paper' — warm-domestic: grain, rounded cards, dashed dividers
 * 'japandi'       — minimal: slight rounding, accent line, hairlines
 */
var DISPLAY_STYLES = {
  'default': {
    label: 'Default',
    description: 'Clean grid, no decoration',
    css: '',
  },
  'kitchen-paper': {
    label: 'Kitchen Paper',
    description: 'Warm paper, rounded cards, dashed dividers',
    css: KITCHEN_PAPER_STYLE_CSS(),
  },
  'japandi': {
    label: 'Japandi',
    description: 'Minimal, quiet, restrained',
    css: JAPANDI_STYLE_CSS(),
  },
};

var DISPLAY_STYLE_ORDER = ['default', 'kitchen-paper', 'japandi'];

/* ── Typeface Pairings ───────────────────────────────────────────────── */

/**
 * Typeface pairings for the calendar display.
 * Each pairing sets --display-font (clock, headings) and --body-font (text).
 * Single-font pairings set both to the same family.
 *
 * 'system'    — OS default, no Google Fonts
 * 'editorial' — Fraunces display + Inter body (confident, modern)
 * 'mincho'    — Shippori Mincho throughout (quiet, traditional)
 * 'gothic'    — Zen Kaku Gothic throughout (calm humanist sans)
 * 'newsreader'— Newsreader throughout (warm, friendly, legible)
 * 'grotesk'   — IBM Plex Sans body + Plex Mono numerals (engineered)
 */
var TYPEFACE_PAIRINGS = {
  'system': {
    label: 'System',
    description: 'OS default',
    displayFont: null,
    bodyFont: null,
    googleImport: null,
  },
  'editorial': {
    label: 'Editorial',
    description: 'Fraunces · Inter',
    displayFont: '"Fraunces", Georgia, serif',
    bodyFont: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    googleImport: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700',
  },
  'mincho': {
    label: 'Mincho',
    description: 'Shippori Mincho',
    displayFont: '"Shippori Mincho", Georgia, serif',
    bodyFont: '"Shippori Mincho", Georgia, serif',
    googleImport: 'Shippori+Mincho:wght@400;500;600;700;800',
  },
  'gothic': {
    label: 'Gothic',
    description: 'Zen Kaku Gothic',
    displayFont: '"Zen Kaku Gothic New", "Inter", sans-serif',
    bodyFont: '"Zen Kaku Gothic New", "Inter", sans-serif',
    googleImport: 'Zen+Kaku+Gothic+New:wght@400;500;700;900',
  },
  'newsreader': {
    label: 'Newsreader',
    description: 'Newsreader',
    displayFont: '"Newsreader", Georgia, serif',
    bodyFont: '"Newsreader", Georgia, serif',
    googleImport: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700',
  },
  'grotesk': {
    label: 'Grotesk',
    description: 'IBM Plex Sans · Mono',
    displayFont: '"IBM Plex Mono", ui-monospace, monospace',
    bodyFont: '"IBM Plex Sans", "Inter", sans-serif',
    googleImport: 'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600',
  },
};

var TYPEFACE_ORDER = ['system', 'editorial', 'mincho', 'gothic', 'newsreader', 'grotesk'];
