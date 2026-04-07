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
};

/** Ordered keys for consistent UI rendering. */
var COLOR_THEME_ORDER = [
  'default', 'nord', 'ocean', 'forest',
  'sunset', 'rose', 'slate', 'mocha',
];

/**
 * Apply a color theme by injecting CSS variable overrides.
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
    // Default theme — remove overrides, fall back to styles.css
    style.textContent = '';
    return;
  }

  var css = '';

  css += ':root[data-theme="light"] {\n';
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
