/**
 * Admin panel controller.
 * Fetches current settings from the API, renders controls, and saves changes.
 */

let currentSettings = null;
let originalJSON = '';       // snapshot for dirty-checking
let availableFonts = {};
let knownCalendars = [];

/* ── Initialization ─────────────────────────────────── */

async function init() {
  try {
    const resp = await fetch('/api/settings');
    const data = await resp.json();
    currentSettings = data.settings;
    availableFonts = data.availableFonts;
    knownCalendars = data.knownCalendars;
    originalJSON = JSON.stringify(currentSettings);

    renderCalendarToggles();
    renderColorPickers();
    renderThemeControls();
    renderFontOptions();
    setupSaveButton();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

/* ── Calendar Toggles ───────────────────────────────── */

function renderCalendarToggles() {
  const container = document.getElementById('calendar-toggles');

  // Combine known calendars with any in settings that may not be in current sync
  const allKeys = new Set();
  for (const cal of knownCalendars) {
    allKeys.add(cal.source + ':' + cal.name);
  }
  for (const key of Object.keys(currentSettings.calendars.visible)) {
    allKeys.add(key);
  }

  if (allKeys.size === 0) {
    container.textContent = 'No calendars discovered yet. Calendars will appear after the first successful sync.';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const key of Array.from(allKeys).sort()) {
    const [source, ...nameParts] = key.split(':');
    const name = nameParts.join(':');
    const isVisible = currentSettings.calendars.visible[key] !== false;

    const item = document.createElement('div');
    item.className = 'toggle-item';

    const label = document.createElement('div');
    label.className = 'toggle-label';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;

    const sourceTag = document.createElement('span');
    sourceTag.className = 'toggle-source';
    sourceTag.textContent = source;

    label.appendChild(nameSpan);
    label.appendChild(sourceTag);

    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = isVisible;
    input.dataset.key = key;
    input.addEventListener('change', (e) => {
      currentSettings.calendars.visible[e.target.dataset.key] = e.target.checked;
      markDirty();
    });

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggle.appendChild(input);
    toggle.appendChild(slider);

    item.appendChild(label);
    item.appendChild(toggle);
    fragment.appendChild(item);
  }

  container.textContent = '';
  container.appendChild(fragment);
}

/* ── Color Pickers ──────────────────────────────────── */

function renderColorPickers() {
  const container = document.getElementById('color-pickers');
  const colors = currentSettings.calendars.colors;
  const fragment = document.createDocumentFragment();

  for (const [key, value] of Object.entries(colors)) {
    const row = document.createElement('div');
    row.className = 'color-row';

    const label = document.createElement('label');
    label.textContent = key;

    const input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.dataset.key = key;
    input.addEventListener('input', (e) => {
      currentSettings.calendars.colors[e.target.dataset.key] = e.target.value;
      e.target.nextElementSibling.textContent = e.target.value;
      markDirty();
    });

    const hex = document.createElement('span');
    hex.className = 'color-hex';
    hex.textContent = value;

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(hex);
    fragment.appendChild(row);
  }

  container.textContent = '';
  container.appendChild(fragment);
}

/* ── Theme Controls ─────────────────────────────────── */

function renderThemeControls() {
  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = currentSettings.display.theme;
  themeSelect.addEventListener('change', (e) => {
    currentSettings.display.theme = e.target.value;
    updateDarkModeVisibility();
    markDirty();
  });

  // Populate hour dropdowns
  const startSelect = document.getElementById('dark-start');
  const endSelect = document.getElementById('dark-end');

  for (let h = 0; h < 24; h++) {
    const label = formatHour(h);

    const optStart = document.createElement('option');
    optStart.value = h;
    optStart.textContent = label;
    startSelect.appendChild(optStart);

    const optEnd = document.createElement('option');
    optEnd.value = h;
    optEnd.textContent = label;
    endSelect.appendChild(optEnd);
  }

  startSelect.value = currentSettings.display.darkModeStart;
  endSelect.value = currentSettings.display.darkModeEnd;

  startSelect.addEventListener('change', (e) => {
    currentSettings.display.darkModeStart = parseInt(e.target.value);
    markDirty();
  });
  endSelect.addEventListener('change', (e) => {
    currentSettings.display.darkModeEnd = parseInt(e.target.value);
    markDirty();
  });

  updateDarkModeVisibility();
}

function updateDarkModeVisibility() {
  const hoursRow = document.getElementById('dark-mode-hours');
  hoursRow.style.display = currentSettings.display.theme === 'auto' ? 'flex' : 'none';
}

function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h < 12) return h + ':00 AM';
  return (h - 12) + ':00 PM';
}

/* ── Font Selection ─────────────────────────────────── */

function renderFontOptions() {
  const container = document.getElementById('font-options');
  const currentFont = currentSettings.display.font;
  const fragment = document.createDocumentFragment();

  // Preload Google Fonts for previews
  const googleImports = Object.values(availableFonts)
    .filter((f) => f.googleImport)
    .map((f) => 'family=' + f.googleImport);

  if (googleImports.length > 0) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + googleImports.join('&') + '&display=swap';
    document.head.appendChild(link);
  }

  for (const [key, font] of Object.entries(availableFonts)) {
    const option = document.createElement('label');
    option.className = 'font-option' + (key === currentFont ? ' selected' : '');

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'font';
    radio.value = key;
    radio.checked = key === currentFont;
    radio.addEventListener('change', () => {
      currentSettings.display.font = key;
      document.querySelectorAll('.font-option').forEach((el) => el.classList.remove('selected'));
      option.classList.add('selected');
      markDirty();
    });

    const name = document.createElement('div');
    name.className = 'font-name';
    name.textContent = font.label;

    const preview = document.createElement('div');
    preview.className = 'font-preview';
    preview.style.fontFamily = font.stack;
    preview.textContent = 'Family Calendar';

    option.appendChild(radio);
    option.appendChild(name);
    option.appendChild(preview);
    fragment.appendChild(option);
  }

  container.textContent = '';
  container.appendChild(fragment);
}

/* ── Save Logic ─────────────────────────────────────── */

function setupSaveButton() {
  const btn = document.getElementById('btn-save');
  btn.addEventListener('click', saveSettings);
}

function markDirty() {
  const isDirty = JSON.stringify(currentSettings) !== originalJSON;
  const bar = document.getElementById('save-bar');
  const btn = document.getElementById('btn-save');
  const status = document.getElementById('save-status');

  bar.classList.toggle('visible', isDirty);
  btn.disabled = !isDirty;
  status.textContent = 'Unsaved changes';
  status.className = 'save-status';
}

async function saveSettings() {
  const btn = document.getElementById('btn-save');
  const status = document.getElementById('save-status');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const resp = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSettings),
    });

    if (!resp.ok) throw new Error('Save failed');

    const result = await resp.json();
    currentSettings = result.settings;
    originalJSON = JSON.stringify(currentSettings);

    status.textContent = 'Settings saved! Display will update within 60 seconds.';
    status.className = 'save-status saved';
    btn.textContent = 'Save Settings';

    // Hide the bar after a moment
    setTimeout(() => {
      document.getElementById('save-bar').classList.remove('visible');
    }, 3000);
  } catch (err) {
    status.textContent = 'Error saving: ' + err.message;
    status.className = 'save-status';
    btn.disabled = false;
    btn.textContent = 'Save Settings';
  }
}

/* ── Start ──────────────────────────────────────────── */

init();
