import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { sandbox } from '../helpers/sandbox.js';

let box, app, token;
before(async () => {
  box = await sandbox();
  await box.import('services/log-buffer.js');
  app = await (await box.import('app.js')).buildApp();
  const result = await app.inject({ method: 'POST', url: '/api/admin/verify-pin', payload: { pin: process.env.ADMIN_PIN } });
  assert.equal(result.statusCode, 200);
  token = result.json().token;
});
after(async () => { await app?.close(); await box?.cleanup(); });
const headers = () => ({ authorization: `Bearer ${token}` });

test('all sensitive routes require admin authentication', async () => {
  const routes = [
    ['GET', '/api/settings'], ['PUT', '/api/settings'], ['POST', '/api/sync'],
    ['GET', '/api/system/stats'], ['GET', '/api/logs'], ['GET', '/api/accounts'],
    ['POST', '/api/accounts/icloud'], ['POST', '/api/accounts/ics'],
    ['POST', '/api/accounts/test:one/test'], ['PUT', '/api/accounts/test:one/calendars'],
    ['DELETE', '/api/accounts/test:one'], ['POST', '/api/auth/google/start'], ['POST', '/api/auth/microsoft/start'],
  ];
  for (const [method, url] of routes) {
    for (const authorization of ['', 'Bearer invalid']) {
      const result = await app.inject({ method, url, headers: { authorization }, ...(method === 'PUT' ? { payload: {} } : {}) });
      assert.equal(result.statusCode, 401, `${method} ${url}`);
      assert.deepEqual(result.json(), { error: 'Unauthorized', pinRequired: true });
    }
  }
  for (const url of ['/api/settings', '/api/accounts', '/api/logs']) assert.equal((await app.inject({ url, headers: headers() })).statusCode, 200);
});

test('public display works, has security headers, and denies cross-origin access', async () => {
  for (const url of ['/', '/admin', '/api/calendar', '/api/health', '/api/display/status', '/not-found']) {
    const response = await app.inject({ url, headers: { origin: 'https://attacker.example' } });
    assert.equal(response.statusCode, url === '/not-found' ? 404 : 200);
    if (url.startsWith('/api/')) assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(response.headers['referrer-policy'], 'same-origin');
    assert.match(response.headers['content-security-policy'], /script-src 'self';/);
    assert.match(response.headers['content-security-policy'], /connect-src 'self'/);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
    for (const secret of [process.env.ADMIN_PIN, process.env.CREDENTIAL_SECRET, process.env.REMINDERS_WEBHOOK_SECRET]) assert.equal(response.body.includes(secret), false);
  }
  const preflight = await app.inject({ method: 'OPTIONS', url: '/api/settings', headers: { origin: 'https://attacker.example', 'access-control-request-method': 'PUT' } });
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);
});

test('IP allowlist rejects outsiders even with spoofed forwarding headers', async () => {
  const blocked = await app.inject({ url: '/api/health', remoteAddress: '203.0.113.1', headers: { 'x-forwarded-for': '127.0.0.1' } });
  assert.equal(blocked.statusCode, 403);
  assert.equal((await app.inject({ url: '/api/health', remoteAddress: '::ffff:127.0.0.1' })).statusCode, 200);
});

test('secrets and server files cannot be downloaded through static routes', async () => {
  for (const url of ['/.env', '/settings.json', '/data/credentials.enc', '/src/config.js', '/package.json', '/%2e%2e/.env', '/%2e%2e%2f.env']) {
    const response = await app.inject(url);
    assert.ok([400, 403, 404].includes(response.statusCode), `${url}: ${response.statusCode}`);
  }
});

test('webhooks authenticate, validate, persist encrypted data and do not log malformed private text', async () => {
  const url = '/api/reminders/sync';
  const payload = { syncedBy: 'Test', items: [{ title: 'Synthetic private reminder', notes: 'Synthetic private note' }] };
  for (const secret of ['', 'wrong']) assert.equal((await app.inject({ method: 'POST', url, headers: { 'x-webhook-secret': secret }, payload })).statusCode, 401);
  const hookHeaders = { 'x-webhook-secret': process.env.REMINDERS_WEBHOOK_SECRET };
  const valid = await app.inject({ method: 'POST', url, headers: hookHeaders, payload });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().received, 1);
  for (const malformed of ['Synthetic malformed PRIVATE marker', '{}', 'null', '{"items":[null]}', '{"items":"bad"}']) {
    const response = await app.inject({ method: 'POST', url, headers: { ...hookHeaders, 'content-type': 'application/json' }, payload: malformed });
    assert.equal(response.statusCode, 400, malformed);
  }
  const logs = (await app.inject({ url: '/api/logs', headers: headers() })).body;
  for (const marker of ['Synthetic malformed PRIVATE marker', payload.items[0].title, payload.items[0].notes, process.env.REMINDERS_WEBHOOK_SECRET]) assert.equal(logs.includes(marker), false);
  const cache = await readFile(path.join(box.dir, 'data/reminders-cache.enc'));
  assert.equal(cache.includes(Buffer.from(payload.items[0].title)), false);
  assert.equal((await app.inject('/api/calendar')).json().reminders.items[0].title, payload.items[0].title);
  const oversized = await app.inject({ method: 'POST', url, headers: { ...hookHeaders, 'content-type': 'text/plain' }, payload: 'x'.repeat(1024 * 1024 + 1) });
  assert.equal(oversized.statusCode, 413);
  const pipe = await app.inject({ method: 'POST', url, headers: { ...hookHeaders, 'content-type': 'text/plain' }, payload: 'syncedBy:Test\nSynthetic task|||2030-01-01|||Synthetic notes|||1' });
  assert.equal(pipe.json().received, 1);
});

test('settings reject invalid schedule, theme and scale values', async () => {
  for (const display of [{ screenOnTime: '25:00' }, { theme: 'invalid' }, { displayScale: 0.1 }, { screenOnDays: [7] }]) {
    assert.equal((await app.inject({ method: 'PUT', url: '/api/settings', headers: headers(), payload: { display } })).statusCode, 400);
  }
});

test('ICS account creation rejects internal URLs without saving credentials', async () => {
  const result = await app.inject({ method: 'POST', url: '/api/accounts/ics', headers: headers(), payload: { feedUrl: 'http://169.254.169.254/latest/meta-data/' } });
  assert.equal(result.statusCode, 400);
  assert.deepEqual((await app.inject({ url: '/api/accounts', headers: headers() })).json().accounts, []);
});

test('PIN brute force is limited, including valid PIN after quota exhaustion', async () => {
  const isolated = await (await box.import('app.js')).buildApp();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await isolated.inject({ method: 'POST', url: '/api/admin/verify-pin', payload: { pin: 'wrong' } })).statusCode, 401);
    const limited = await isolated.inject({ method: 'POST', url: '/api/admin/verify-pin', payload: { pin: process.env.ADMIN_PIN } });
    assert.equal(limited.statusCode, 429);
    assert.ok(Number(limited.headers['retry-after']) > 0);
  } finally { await isolated.close(); }
});

for (const provider of ['google', 'microsoft']) {
  test(`${provider} OAuth rejects unknown, cross-provider, expired and replayed state`, async (t) => {
    let exchanges = 0;
    t.mock.method(google.auth.OAuth2.prototype, 'getToken', async () => { exchanges++; return { tokens: {} }; });
    t.mock.method(globalThis, 'fetch', async () => { exchanges++; return { ok: true, json: async () => ({}) }; });
    const start = async () => {
      const response = await app.inject({ method: 'POST', url: `/api/auth/${provider}/start`, headers: headers(), payload: { clientId: 'synthetic-id', clientSecret: 'synthetic-oauth-secret' } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.includes('synthetic-oauth-secret'), false);
      return new URL(response.json().url).searchParams.get('state');
    };
    const callback = (target, state) => app.inject(`/api/auth/${target}/callback?code=synthetic-code&state=${state}`);
    assert.match((await callback(provider, 'unknown')).headers.location, /invalid_state/);
    const crossState = await start();
    assert.match((await callback(provider === 'google' ? 'microsoft' : 'google', crossState)).headers.location, /invalid_state/);
    assert.equal(exchanges, 0);
    // A legitimate state is consumed even if the exchange returns no refresh token.
    assert.match((await callback(provider, crossState)).headers.location, /no_refresh_token/);
    assert.equal(exchanges, 1);
    assert.match((await callback(provider, crossState)).headers.location, /invalid_state/);
    const state = await start();
    const future = Date.now() + 10 * 60 * 1000 + 1;
    t.mock.method(Date, 'now', () => future);
    for (let i = 0; i < 2; i++) assert.match((await callback(provider, state)).headers.location, /invalid_state/);
    assert.equal(exchanges, 1);
  });
}

 test('authenticated settings persist and the display endpoint applies schedule settings', async () => {
  const settings = { display: { theme: 'dark', screenSchedule: false, weekStart: 'sunday', displayScale: 1.25 } };
  const saved = await app.inject({ method: 'PUT', url: '/api/settings', headers: headers(), payload: settings });
  assert.equal(saved.statusCode, 200);
  const loaded = (await app.inject({ url: '/api/settings', headers: headers() })).json().settings;
  for (const [key, value] of Object.entries(settings.display)) assert.equal(loaded.display[key], value);
  assert.equal(JSON.parse(await readFile(path.join(box.dir, 'settings.json'), 'utf8')).display.weekStart, 'sunday');
  assert.deepEqual((await app.inject('/api/display/status')).json(), { screenOn: true, schedule: false, controlTvViaCec: false });
});
