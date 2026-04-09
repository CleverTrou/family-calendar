/**
 * Admin panel controller.
 * Manages two tabs: Accounts (connect/disconnect providers) and Display (visual settings).
 */

let currentSettings = null;
let originalJSON = '';       // snapshot for dirty-checking
let availableFonts = {};
let knownCalendars = [];
let adminToken = null;       // PIN auth token (null = no PIN required)
let systemStatsInterval = null;

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
    renderWeatherControls();
    renderThemeControls();
    renderScreenSchedule();
    renderDisplayScale();
    renderFontOptions();
    setupSaveButton();
    setupAccountButtons();
    setupLogViewer();
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

  // Start/stop system stats + log auto-refresh
  if (tabName === 'system') {
    loadSystemStats();
    loadLogs();
    systemStatsInterval = setInterval(loadSystemStats, 10000);
    logInterval = setInterval(loadLogs, 10000);
  } else {
    if (systemStatsInterval) { clearInterval(systemStatsInterval); systemStatsInterval = null; }
    if (logInterval) { clearInterval(logInterval); logInterval = null; }
  }
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
  } else if (success === 'microsoft') {
    showToast('Microsoft Calendar connected successfully!', 'success');
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

  // Microsoft
  document.getElementById('btn-connect-microsoft').addEventListener('click', () => {
    document.getElementById('microsoft-setup').style.display = '';
    document.getElementById('btn-connect-microsoft').closest('.card').style.display = 'none';
    updateMicrosoftRedirectUri();
  });
  document.getElementById('btn-microsoft-cancel').addEventListener('click', () => {
    document.getElementById('microsoft-setup').style.display = 'none';
    document.getElementById('btn-connect-microsoft').closest('.card').style.display = '';
  });
  document.getElementById('btn-microsoft-authorize').addEventListener('click', startMicrosoftAuth);

  // ICS Feed
  document.getElementById('btn-connect-ics').addEventListener('click', () => {
    document.getElementById('ics-setup').style.display = '';
    document.getElementById('btn-connect-ics').closest('.card').style.display = 'none';
  });
  document.getElementById('btn-ics-cancel').addEventListener('click', () => {
    document.getElementById('ics-setup').style.display = 'none';
    document.getElementById('btn-connect-ics').closest('.card').style.display = '';
  });
  document.getElementById('btn-ics-submit').addEventListener('click', connectICS);
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

async function connectICS() {
  var feedUrl = document.getElementById('ics-feed-url').value.trim();
  var label = document.getElementById('ics-feed-label').value.trim();
  var statusEl = document.getElementById('ics-status');
  var btn = document.getElementById('btn-ics-submit');

  if (!feedUrl) {
    statusEl.textContent = 'Please enter a feed URL.';
    statusEl.className = 'status-msg error';
    return;
  }

  btn.textContent = 'Testing...';
  btn.disabled = true;
  statusEl.textContent = 'Fetching and validating feed...';
  statusEl.className = 'status-msg';

  try {
    var resp = await authFetch('/api/accounts/ics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedUrl: feedUrl, label: label || undefined }),
    });

    var data = await resp.json();

    if (resp.ok) {
      statusEl.textContent = 'Feed connected: ' + data.label;
      statusEl.className = 'status-msg success';
      showToast('Calendar feed added!', 'success');

      // Clear inputs
      document.getElementById('ics-feed-url').value = '';
      document.getElementById('ics-feed-label').value = '';

      setTimeout(function () {
        document.getElementById('ics-setup').style.display = 'none';
        document.getElementById('btn-connect-ics').closest('.card').style.display = '';
        statusEl.textContent = '';
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

  btn.textContent = 'Test & Add Feed';
  btn.disabled = false;
}

/* ── Microsoft Auth ───────────────────────────────── */

function updateMicrosoftRedirectUri() {
  const uri = window.location.protocol + '//' + window.location.host + '/api/auth/microsoft/callback';
  document.getElementById('microsoft-redirect-uri').textContent = uri;
}

function startMicrosoftAuth() {
  const clientId = document.getElementById('microsoft-client-id').value.trim();
  const clientSecret = document.getElementById('microsoft-client-secret').value.trim();

  if (!clientId || !clientSecret) {
    showToast('Please enter both Application ID and Client Secret.', 'error');
    return;
  }

  const params = new URLSearchParams({ clientId, clientSecret });
  window.location.href = '/api/auth/microsoft/start?' + params;
}

/* ── Calendar Toggles (Display tab) ────────────────── */

function renderCalendarToggles() {
  const container = document.getElementById('calendar-toggles');

  // Build set from live calendars only (not stale settings keys)
  const allKeys = new Set();
  for (const cal of knownCalendars) {
    allKeys.add(cal.source + ':' + cal.name);
  }

  // Prune stale visibility entries that no longer exist
  for (const key of Object.keys(currentSettings.calendars.visible)) {
    if (!allKeys.has(key)) {
      delete currentSettings.calendars.visible[key];
    }
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

/* ── Weather Location ─────────────────────────────── */

function renderWeatherControls() {
  // Ensure weather settings object exists
  if (!currentSettings.weather) {
    currentSettings.weather = { lat: '', lon: '' };
  }

  const latInput = document.getElementById('weather-lat');
  const lonInput = document.getElementById('weather-lon');
  const locateBtn = document.getElementById('btn-weather-locate');
  const statusEl = document.getElementById('weather-status');

  latInput.value = currentSettings.weather.lat || '';
  lonInput.value = currentSettings.weather.lon || '';

  latInput.addEventListener('change', () => {
    currentSettings.weather.lat = latInput.value.trim();
    updateSunTimesDisplay();
    markDirty();
  });
  lonInput.addEventListener('change', () => {
    currentSettings.weather.lon = lonInput.value.trim();
    updateSunTimesDisplay();
    markDirty();
  });

  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      statusEl.textContent = 'Geolocation not supported by this browser.';
      statusEl.className = 'status-msg error';
      return;
    }

    statusEl.textContent = 'Getting location...';
    statusEl.className = 'status-msg';
    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        latInput.value = lat;
        lonInput.value = lon;
        currentSettings.weather.lat = lat;
        currentSettings.weather.lon = lon;
        statusEl.textContent = 'Location set!';
        statusEl.className = 'status-msg success';
        locateBtn.disabled = false;
        updateSunTimesDisplay();
        markDirty();
      },
      (err) => {
        const messages = {
          1: 'Location permission denied.',
          2: 'Location unavailable.',
          3: 'Location request timed out.',
        };
        statusEl.textContent = messages[err.code] || 'Could not get location.';
        statusEl.className = 'status-msg error';
        locateBtn.disabled = false;
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

/* ── Theme Controls ────────────────────────────────── */

function renderThemeControls() {
  const themeSelect = document.getElementById('theme-select');
  themeSelect.value = currentSettings.display.theme;
  themeSelect.addEventListener('change', (e) => {
    currentSettings.display.theme = e.target.value;
    updateThemePanelVisibility();
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

  updateThemePanelVisibility();
  renderThemePalettePicker();
}

function renderThemePalettePicker() {
  const container = document.getElementById('theme-palette-picker');
  if (!container) return;

  const current = currentSettings.display.colorTheme || 'default';
  const fragment = document.createDocumentFragment();

  COLOR_THEME_ORDER.forEach(function (key) {
    var theme = COLOR_THEMES[key];
    if (!theme) return;

    var swatch = document.createElement('div');
    swatch.className = 'theme-swatch' + (key === current ? ' selected' : '');
    swatch.dataset.theme = key;

    // Preview: left half = light, right half = dark
    var preview = document.createElement('div');
    preview.className = 'theme-swatch-preview';

    var lightHalf = document.createElement('div');
    lightHalf.className = 'theme-swatch-half';
    var darkHalf = document.createElement('div');
    darkHalf.className = 'theme-swatch-half';

    if (theme.light && theme.dark) {
      lightHalf.style.background = theme.light['--bg-body'];
      darkHalf.style.background = theme.dark['--bg-body'];

      // Light side: card-colored dot + text line
      var lightDot = document.createElement('div');
      lightDot.className = 'theme-swatch-dot';
      lightDot.style.background = theme.light['--text-muted'];
      var lightLine = document.createElement('div');
      lightLine.className = 'theme-swatch-line';
      lightLine.style.background = theme.light['--text-secondary'];
      lightHalf.appendChild(lightDot);
      lightHalf.appendChild(lightLine);

      // Dark side: card-colored dot + text line
      var darkDot = document.createElement('div');
      darkDot.className = 'theme-swatch-dot';
      darkDot.style.background = theme.dark['--text-muted'];
      var darkLine = document.createElement('div');
      darkLine.className = 'theme-swatch-line';
      darkLine.style.background = theme.dark['--text-secondary'];
      darkHalf.appendChild(darkDot);
      darkHalf.appendChild(darkLine);
    } else {
      // Default theme — use styles.css hardcoded values
      lightHalf.style.background = '#f0f2f5';
      darkHalf.style.background = '#0f0f14';
      var defLightDot = document.createElement('div');
      defLightDot.className = 'theme-swatch-dot';
      defLightDot.style.background = '#4b5563';
      var defLightLine = document.createElement('div');
      defLightLine.className = 'theme-swatch-line';
      defLightLine.style.background = '#374151';
      lightHalf.appendChild(defLightDot);
      lightHalf.appendChild(defLightLine);
      var defDarkDot = document.createElement('div');
      defDarkDot.className = 'theme-swatch-dot';
      defDarkDot.style.background = '#a0a7b4';
      var defDarkLine = document.createElement('div');
      defDarkLine.className = 'theme-swatch-line';
      defDarkLine.style.background = '#c9cdd5';
      darkHalf.appendChild(defDarkDot);
      darkHalf.appendChild(defDarkLine);
    }

    preview.appendChild(lightHalf);
    preview.appendChild(darkHalf);

    var label = document.createElement('div');
    label.className = 'theme-swatch-label';
    label.textContent = theme.label;

    swatch.appendChild(preview);
    swatch.appendChild(label);

    swatch.addEventListener('click', function () {
      container.querySelectorAll('.theme-swatch').forEach(function (s) {
        s.classList.remove('selected');
      });
      swatch.classList.add('selected');
      currentSettings.display.colorTheme = key;
      markDirty();
    });

    fragment.appendChild(swatch);
  });

  container.textContent = '';
  container.appendChild(fragment);
}

function updateThemePanelVisibility() {
  const theme = currentSettings.display.theme;
  const hoursRow = document.getElementById('dark-mode-hours');
  const sunInfo = document.getElementById('sun-times-info');

  hoursRow.style.display = theme === 'auto' ? 'flex' : 'none';
  sunInfo.style.display = theme === 'auto-sun' ? 'block' : 'none';

  if (theme === 'auto-sun') {
    updateSunTimesDisplay();
  }
}

function updateSunTimesDisplay() {
  const textEl = document.getElementById('sun-times-text');
  const lat = parseFloat(currentSettings.weather && currentSettings.weather.lat);
  const lon = parseFloat(currentSettings.weather && currentSettings.weather.lon);

  if (isNaN(lat) || isNaN(lon)) {
    textEl.textContent = 'Set your location above to enable sunrise/sunset timing.';
    return;
  }

  var formatted = getFormattedSunTimes(lat, lon);
  if (!formatted) {
    textEl.textContent = 'Sunrise/sunset unavailable for this location (polar region).';
    return;
  }

  textEl.textContent = 'Today\u2019s sunrise: ' + formatted.sunrise + ' \u00B7 sunset: ' + formatted.sunset;
}

function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h < 12) return h + ':00 AM';
  return (h - 12) + ':00 PM';
}

/* ── Screen Schedule ──────────────────────────────── */

function renderScreenSchedule() {
  const display = currentSettings.display;

  // Enable/disable toggle
  const toggle = document.getElementById('screen-schedule-toggle');
  toggle.checked = display.screenSchedule !== false;
  toggle.addEventListener('change', (e) => {
    currentSettings.display.screenSchedule = e.target.checked;
    updateScheduleVisibility();
    markDirty();
  });

  // On/off times
  const onTime = document.getElementById('screen-on-time');
  const offTime = document.getElementById('screen-off-time');
  onTime.value = display.screenOnTime || '06:30';
  offTime.value = display.screenOffTime || '23:00';

  onTime.addEventListener('change', (e) => {
    currentSettings.display.screenOnTime = e.target.value;
    markDirty();
  });
  offTime.addEventListener('change', (e) => {
    currentSettings.display.screenOffTime = e.target.value;
    markDirty();
  });

  // Day-of-week buttons
  const activeDays = display.screenOnDays || [1, 2, 3, 4, 5, 6, 0];
  const dayBtns = document.querySelectorAll('#screen-on-days .day-btn');
  dayBtns.forEach((btn) => {
    const day = parseInt(btn.dataset.day);
    if (activeDays.includes(day)) btn.classList.add('active');

    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const days = [];
      document.querySelectorAll('#screen-on-days .day-btn.active').forEach((b) => {
        days.push(parseInt(b.dataset.day));
      });
      currentSettings.display.screenOnDays = days;
      markDirty();
    });
  });

  updateScheduleVisibility();
}

function updateScheduleVisibility() {
  const options = document.getElementById('screen-schedule-options');
  options.style.display = currentSettings.display.screenSchedule !== false ? '' : 'none';
}

/* ── Display Scale ───────────────────────────────── */

function renderDisplayScale() {
  const display = currentSettings.display;
  const scale = display.displayScale || 1;

  const slider = document.getElementById('display-scale-slider');
  const valueLabel = document.getElementById('display-scale-value');

  slider.value = scale;
  valueLabel.textContent = scale + '×';

  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valueLabel.textContent = val + '×';
    currentSettings.display.displayScale = val;
    markDirty();
  });

  // Preset buttons
  document.querySelectorAll('.scale-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.scale);
      slider.value = val;
      valueLabel.textContent = val + '×';
      currentSettings.display.displayScale = val;
      markDirty();
    });
  });
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

/* ── System Stats (System tab) ────────────────────── */

async function loadSystemStats() {
  try {
    const resp = await fetch('/api/system/stats');
    if (!resp.ok) throw new Error('Failed to fetch stats');
    const stats = await resp.json();
    renderSystemInfo(stats);
    renderResourceUsage(stats);
    renderThermalInfo(stats);
  } catch (err) {
    document.getElementById('system-info').innerHTML =
      '<p class="muted">Could not load system stats: ' + err.message + '</p>';
  }
}

function renderSystemInfo(stats) {
  const container = document.getElementById('system-info');
  const fragment = document.createDocumentFragment();
  const items = [
    ['Hostname', stats.hostname],
    ['Platform', stats.platform + ' / ' + stats.arch],
    ['Node.js', stats.nodeVersion],
    ['CPU', stats.cpu.model],
    ['Cores', stats.cpu.cores],
    ['System Uptime', formatUptime(stats.uptime.system)],
    ['Server Uptime', formatUptime(stats.uptime.process)],
  ];
  for (const [label, value] of items) {
    fragment.appendChild(statItem(label, value));
  }
  container.replaceChildren(fragment);
}

function renderResourceUsage(stats) {
  const container = document.getElementById('system-resources');
  const fragment = document.createDocumentFragment();

  // CPU usage bar
  fragment.appendChild(statBar('CPU', stats.cpu.usagePercent, '%'));

  // Memory bar
  fragment.appendChild(statBar(
    'Memory',
    stats.memory.usedPercent,
    '% (' + formatBytes(stats.memory.used) + ' / ' + formatBytes(stats.memory.total) + ')'
  ));

  // Disk bar
  if (stats.disk) {
    fragment.appendChild(statBar(
      'Disk',
      stats.disk.usedPercent,
      '% (' + formatBytes(stats.disk.used) + ' / ' + formatBytes(stats.disk.total) + ')'
    ));
  }

  // Load averages
  if (stats.cpu.loadAvg) {
    const la = stats.cpu.loadAvg;
    fragment.appendChild(statItem(
      'Load Average',
      la['1m'].toFixed(2) + ' / ' + la['5m'].toFixed(2) + ' / ' + la['15m'].toFixed(2)
    ));
  }
  container.replaceChildren(fragment);
}

function renderThermalInfo(stats) {
  const card = document.getElementById('system-thermal-card');
  const container = document.getElementById('system-thermal');

  const hasThermal = stats.cpu.temperature != null || stats.cpu.gpuTemperature != null || stats.fan || stats.throttled;
  card.style.display = hasThermal ? '' : 'none';
  if (!hasThermal) return;

  const fragment = document.createDocumentFragment();

  if (stats.cpu.temperature != null) {
    const warn = stats.cpu.temperature >= 70;
    const el = statItem('CPU Temp', stats.cpu.temperature.toFixed(1) + ' \u00b0C');
    if (warn) el.classList.add('stat-warn');
    fragment.appendChild(el);
  }

  if (stats.cpu.gpuTemperature != null) {
    const warn = stats.cpu.gpuTemperature >= 70;
    const el = statItem('GPU Temp', stats.cpu.gpuTemperature.toFixed(1) + ' \u00b0C');
    if (warn) el.classList.add('stat-warn');
    fragment.appendChild(el);
  }

  if (stats.fan) {
    const rpm = stats.fan.rpm;
    let fanText = rpm + ' RPM';
    if (rpm === 0) fanText = 'Off (0 RPM)';
    if (stats.fan.dutyCycle != null) fanText += ' \u00b7 ' + stats.fan.dutyCycle + '% duty';
    fragment.appendChild(statItem('Fan', fanText));
  }

  if (stats.throttled) {
    const t = stats.throttled;
    const issues = [];
    if (t.underVoltageNow) issues.push('Under-voltage NOW');
    if (t.throttledNow) issues.push('Throttled NOW');
    if (t.frequencyCappedNow) issues.push('Frequency capped NOW');
    if (t.underVoltageOccurred) issues.push('Under-voltage (since boot)');
    if (t.throttledOccurred) issues.push('Throttled (since boot)');
    if (t.frequencyCappedOccurred) issues.push('Freq capped (since boot)');

    const el = statItem('Throttling', issues.length > 0 ? issues.join(', ') : 'None');
    if (issues.some((i) => i.includes('NOW'))) el.classList.add('stat-warn');
    fragment.appendChild(el);
  }
  container.replaceChildren(fragment);
}

/** Create a label/value stat row element. */
function statItem(label, value) {
  const row = document.createElement('div');
  row.className = 'stat-item';

  const lbl = document.createElement('span');
  lbl.className = 'stat-label';
  lbl.textContent = label;

  const val = document.createElement('span');
  val.className = 'stat-value';
  val.textContent = value;

  row.appendChild(lbl);
  row.appendChild(val);
  return row;
}

/** Create a stat row with a progress bar. */
function statBar(label, percent, suffix) {
  const row = document.createElement('div');
  row.className = 'stat-item stat-bar-item';

  const top = document.createElement('div');
  top.className = 'stat-bar-header';

  const lbl = document.createElement('span');
  lbl.className = 'stat-label';
  lbl.textContent = label;

  const val = document.createElement('span');
  val.className = 'stat-value';
  val.textContent = (percent != null ? percent : '—') + (suffix || '');

  top.appendChild(lbl);
  top.appendChild(val);

  const track = document.createElement('div');
  track.className = 'stat-bar-track';

  const fill = document.createElement('div');
  fill.className = 'stat-bar-fill';
  if (percent != null) {
    fill.style.width = percent + '%';
    if (percent >= 90) fill.classList.add('critical');
    else if (percent >= 70) fill.classList.add('warning');
  }

  track.appendChild(fill);
  row.appendChild(top);
  row.appendChild(track);
  return row;
}

function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatUptime(seconds) {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

/* ── Log Viewer ───────────────────────────────────── */

let logInterval = null;

async function loadLogs() {
  var filter = document.getElementById('log-level-filter');
  var level = filter ? filter.value : '';
  try {
    var url = '/api/logs?limit=200';
    if (level) url += '&level=' + level;
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    renderLogs(data.entries);
  } catch (err) {
    var container = document.getElementById('log-viewer');
    container.textContent = 'Could not load logs: ' + err.message;
  }
}

function renderLogs(entries) {
  var container = document.getElementById('log-viewer');

  if (!entries || entries.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'log-empty';
    empty.textContent = 'No log entries yet.';
    container.replaceChildren(empty);
    return;
  }

  // Check scroll position BEFORE replacing content
  var wasScrolledToBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 20;

  var fragment = document.createDocumentFragment();
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var line = document.createElement('div');
    line.className = 'log-entry';

    var time = document.createElement('span');
    time.className = 'log-time';
    var d = new Date(e.time);
    time.textContent = d.toLocaleTimeString() + ' ';
    line.appendChild(time);

    var lvl = document.createElement('span');
    lvl.className = 'log-level-' + e.level;
    lvl.textContent = e.level.toUpperCase().padEnd(5) + ' ';
    line.appendChild(lvl);

    var msg = document.createTextNode(e.message);
    line.appendChild(msg);

    fragment.appendChild(line);
  }

  // Atomic swap — container never collapses to zero height
  container.replaceChildren(fragment);

  // Auto-scroll to bottom if user was already there
  if (wasScrolledToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function setupLogViewer() {
  var filter = document.getElementById('log-level-filter');
  if (filter) {
    filter.addEventListener('change', loadLogs);
  }
  var btn = document.getElementById('btn-refresh-logs');
  if (btn) {
    btn.addEventListener('click', loadLogs);
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
