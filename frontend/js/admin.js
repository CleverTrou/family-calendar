/**
 * Admin panel controller.
 * Manages two tabs: Accounts (connect/disconnect providers) and Display (visual settings).
 */

let currentSettings = null;
let originalJSON = '';       // snapshot for dirty-checking
let availableFonts = {};
let knownCalendars = [];
let adminToken = null;       // PIN auth token (null = no PIN required)

/* ── Initialization ─────────────────────────────────── */

async function init() {
  // Restore saved admin token
  adminToken = sessionStorage.getItem('adminToken');

  // Check if PIN is required
  try {
    const statusResp = await fetch('/api/admin/status');
    const status = await statusResp.json();
    if (status.pinRequired && !await verifyExistingToken()) {
      showPinOverlay();
      return;
    }
  } catch {
    // If status check fails, proceed without PIN
  }

  await loadData();
  setupTabs();
  handleUrlParams();
}

async function verifyExistingToken() {
  if (!adminToken) return false;
  try {
    const resp = await authFetch('/api/accounts');
    return resp.ok;
  } catch {
    return false;
  }
}

async function loadData() {
  try {
    const [settingsResp, accountsResp] = await Promise.all([
      fetch('/api/settings'),
      authFetch('/api/accounts'),
    ]);

    const settingsData = await settingsResp.json();
    currentSettings = settingsData.settings;
    availableFonts = settingsData.availableFonts;
    knownCalendars = settingsData.knownCalendars;
    originalJSON = JSON.stringify(currentSettings);

    const accountsData = accountsResp.ok ? await accountsResp.json() : { accounts: [] };
    renderAccountsList(accountsData.accounts);
    renderCalendarToggles();
    renderColorPickers();
    renderThemeControls();
    renderFontOptions();
    setupSaveButton();
    setupAccountButtons();
    updateRedirectUri();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

/** Fetch wrapper that includes the admin auth token. */
function authFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (adminToken) {
    headers['Authorization'] = 'Bearer ' + adminToken;
  }
  return fetch(url, { ...options, headers });
}

/* ── PIN Overlay ───────────────────────────────────── */

function showPinOverlay() {
  document.getElementById('pin-overlay').style.display = 'flex';
  const input = document.getElementById('pin-input');
  input.focus();

  document.getElementById('btn-pin-submit').addEventListener('click', submitPin);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });
}

async function submitPin() {
  const pin = document.getElementById('pin-input').value;
  const errorEl = document.getElementById('pin-error');

  try {
    const resp = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (!resp.ok) {
      errorEl.textContent = 'Incorrect PIN';
      return;
    }

    const data = await resp.json();
    adminToken = data.token;
    sessionStorage.setItem('adminToken', adminToken);
    document.getElementById('pin-overlay').style.display = 'none';
    await loadData();
    setupTabs();
    handleUrlParams();
  } catch {
    errorEl.textContent = 'Connection error';
  }
}

/* ── Tabs ──────────────────────────────────────────── */

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tabName)
  );
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('active', p.id === 'panel-' + tabName)
  );
}

/** Handle URL hash and query params (e.g., after OAuth redirect). */
function handleUrlParams() {
  const hash = window.location.hash.replace('#', '');
  const params = new URLSearchParams(window.location.search);

  if (hash.startsWith('accounts')) {
    switchTab('accounts');
  }

  const success = params.get('success');
  const error = params.get('error');

  if (success === 'google') {
    showToast('Google Calendar connected successfully!', 'success');
    reloadAccounts();
  } else if (error) {
    const messages = {
      'invalid_state': 'Session expired. Please try again.',
      'missing_code': 'Authorization was not completed.',
      'no_refresh_token': 'Google did not return a refresh token. Try revoking access at myaccount.google.com/permissions and reconnecting.',
    };
    showToast(messages[error] || 'Error: ' + decodeURIComponent(error), 'error');
  }

  if (success || error) {
    window.history.replaceState({}, '', '/admin#accounts');
  }
}

/* ── Accounts List ─────────────────────────────────── */

function renderAccountsList(accounts) {
  const container = document.getElementById('accounts-list');
  container.textContent = '';

  if (!accounts || accounts.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No accounts connected. Add one below to get started.';
    container.appendChild(p);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const account of accounts) {
    const item = document.createElement('div');
    item.className = 'account-item';

    const statusClass = account.status === 'connected' ? 'connected' :
                         account.status === 'error' ? 'error' : 'disconnected';

    // Info section
    const info = document.createElement('div');
    info.className = 'account-info';

    const providerRow = document.createElement('div');
    providerRow.className = 'account-provider';

    const dot = document.createElement('span');
    dot.className = 'status-dot ' + statusClass;
    providerRow.appendChild(dot);

    const nameEl = document.createElement('strong');
    nameEl.textContent = account.label;
    providerRow.appendChild(nameEl);

    const sourceTag = document.createElement('span');
    sourceTag.className = 'toggle-source';
    sourceTag.textContent = account.provider;
    providerRow.appendChild(sourceTag);

    info.appendChild(providerRow);

    const meta = document.createElement('div');
    meta.className = 'account-meta';
    let metaText = account.calendars.length + ' calendar' + (account.calendars.length !== 1 ? 's' : '');
    if (account.connectedAt) {
      metaText += ' \u00b7 connected ' + timeAgo(account.connectedAt);
    }
    meta.textContent = metaText;
    info.appendChild(meta);

    item.appendChild(info);

    // Actions section
    const actions = document.createElement('div');
    actions.className = 'account-actions';

    const testBtn = document.createElement('button');
    testBtn.className = 'btn-small';
    testBtn.textContent = 'Test';
    testBtn.addEventListener('click', () => testAccount(account.key, testBtn));
    actions.appendChild(testBtn);

    const disconnectBtn = document.createElement('button');
    disconnectBtn.className = 'btn-small btn-danger';
    disconnectBtn.textContent = 'Disconnect';
    disconnectBtn.addEventListener('click', () => disconnectAccount(account.key));
    actions.appendChild(disconnectBtn);

    item.appendChild(actions);
    fragment.appendChild(item);
  }

  container.appendChild(fragment);
}

async function reloadAccounts() {
  try {
    const resp = await authFetch('/api/accounts');
    if (resp.ok) {
      const data = await resp.json();
      renderAccountsList(data.accounts);
    }
  } catch { /* ignore */ }
}

async function testAccount(key, btn) {
  btn.textContent = 'Testing...';
  btn.disabled = true;

  try {
    const resp = await authFetch('/api/accounts/' + key + '/test', { method: 'POST' });
    const data = await resp.json();

    if (resp.ok) {
      showToast('Connection OK! Found ' + data.calendars.length + ' calendars.', 'success');
    } else {
      showToast('Connection failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Test failed: ' + err.message, 'error');
  }

  btn.textContent = 'Test';
  btn.disabled = false;
  reloadAccounts();
}

async function disconnectAccount(key) {
  if (!confirm('Disconnect this account? Calendar events from this source will no longer sync.')) return;

  try {
    const resp = await authFetch('/api/accounts/' + key, { method: 'DELETE' });
    if (resp.ok) {
      showToast('Account disconnected.', 'success');
      reloadAccounts();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ── Account Connection Flows ──────────────────────── */

function setupAccountButtons() {
  // Google
  document.getElementById('btn-connect-google').addEventListener('click', () => {
    document.getElementById('google-setup').style.display = '';
    document.getElementById('btn-connect-google').closest('.card').style.display = 'none';
  });
  document.getElementById('btn-google-cancel').addEventListener('click', () => {
    document.getElementById('google-setup').style.display = 'none';
    document.getElementById('btn-connect-google').closest('.card').style.display = '';
  });
  document.getElementById('btn-google-authorize').addEventListener('click', startGoogleAuth);

  // iCloud
  document.getElementById('btn-connect-icloud').addEventListener('click', () => {
    document.getElementById('icloud-setup').style.display = '';
    document.getElementById('btn-connect-icloud').closest('.card').style.display = 'none';
  });
  document.getElementById('btn-icloud-cancel').addEventListener('click', () => {
    document.getElementById('icloud-setup').style.display = 'none';
    document.getElementById('btn-connect-icloud').closest('.card').style.display = '';
  });
  document.getElementById('btn-icloud-submit').addEventListener('click', connectICloud);
}

function updateRedirectUri() {
  const uri = window.location.protocol + '//' + window.location.host + '/api/auth/google/callback';
  document.getElementById('google-redirect-uri').textContent = uri;
}

function startGoogleAuth() {
  const clientId = document.getElementById('google-client-id').value.trim();
  const clientSecret = document.getElementById('google-client-secret').value.trim();

  if (!clientId || !clientSecret) {
    showToast('Please enter both Client ID and Client Secret.', 'error');
    return;
  }

  const params = new URLSearchParams({ clientId, clientSecret });
  window.location.href = '/api/auth/google/start?' + params;
}

async function connectICloud() {
  const username = document.getElementById('icloud-username').value.trim();
  const password = document.getElementById('icloud-password').value.trim();
  const statusEl = document.getElementById('icloud-status');
  const btn = document.getElementById('btn-icloud-submit');

  if (!username || !password) {
    statusEl.textContent = 'Please fill in both fields.';
    statusEl.className = 'status-msg error';
    return;
  }

  btn.textContent = 'Connecting...';
  btn.disabled = true;
  statusEl.textContent = 'Testing connection to iCloud...';
  statusEl.className = 'status-msg';

  try {
    const resp = await authFetch('/api/accounts/icloud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, appPassword: password }),
    });

    const data = await resp.json();

    if (resp.ok) {
      statusEl.textContent = 'Connected! Found ' + data.calendars.length + ' calendars.';
      statusEl.className = 'status-msg success';
      showToast('iCloud connected successfully!', 'success');

      setTimeout(() => {
        document.getElementById('icloud-setup').style.display = 'none';
        document.getElementById('btn-connect-icloud').closest('.card').style.display = '';
        reloadAccounts();
      }, 1500);
    } else {
      statusEl.textContent = data.error;
      statusEl.className = 'status-msg error';
    }
  } catch (err) {
    statusEl.textContent = 'Connection error: ' + err.message;
    statusEl.className = 'status-msg error';
  }

  btn.textContent = 'Test & Connect';
  btn.disabled = false;
}

/* ── Calendar Toggles (Display tab) ────────────────── */

function renderCalendarToggles() {
  const container = document.getElementById('calendar-toggles');

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

    // Add hint for iCloud stub calendars with ⚠️ in the name
    if (name.includes('⚠️') || name.includes('⚠')) {
      const hint = document.createElement('div');
      hint.className = 'toggle-hint';
      hint.textContent = 'iCloud system stub — likely non-functional over CalDAV';
      label.appendChild(hint);
    }

    // Add tooltip with full key for debugging
    item.title = key;

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

/* ── Color Pickers ─────────────────────────────────── */

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

/* ── Theme Controls ────────────────────────────────── */

function renderThemeControls() {
  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = currentSettings.display.theme;
  themeSelect.addEventListener('change', (e) => {
    currentSettings.display.theme = e.target.value;
    updateDarkModeVisibility();
    markDirty();
  });

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

/* ── Font Selection ────────────────────────────────── */

function renderFontOptions() {
  const container = document.getElementById('font-options');
  const currentFont = currentSettings.display.font;
  const fragment = document.createDocumentFragment();

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

/* ── Save Logic ────────────────────────────────────── */

function setupSaveButton() {
  document.getElementById('btn-save').addEventListener('click', saveDisplaySettings);
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

async function saveDisplaySettings() {
  const btn = document.getElementById('btn-save');
  const status = document.getElementById('save-status');

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const resp = await authFetch('/api/settings', {
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

/* ── Toast Notifications ───────────────────────────── */

function showToast(message, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* ── Utilities ─────────────────────────────────────── */

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

/* ── Start ─────────────────────────────────────────── */

init();
