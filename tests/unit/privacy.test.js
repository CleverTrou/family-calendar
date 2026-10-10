import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sandbox } from '../helpers/sandbox.js';

let box, store;
before(async () => { box = await sandbox(); store = await box.import('services/encrypted-store.js'); });
after(async () => box?.cleanup());

test('authenticated encryption is randomized and detects tampering, truncation and wrong keys', () => {
  const data = { title: 'Synthetic private appointment', refreshToken: 'synthetic-token' };
  const first = store.encryptJSON(data);
  assert.deepEqual(store.decryptJSON(first), data);
  assert.notDeepEqual(first, store.encryptJSON(data));
  assert.equal(first.includes(Buffer.from(data.title)), false);
  for (const offset of [0, 16, 32, first.length - 1]) {
    const corrupt = Buffer.from(first); corrupt[offset] ^= 1;
    assert.throws(() => store.decryptJSON(corrupt));
  }
  assert.throws(() => store.decryptJSON(first.subarray(0, 20)));
  const secret = process.env.CREDENTIAL_SECRET;
  try { process.env.CREDENTIAL_SECRET = 'different-test-key'; assert.throws(() => store.decryptJSON(first)); }
  finally { process.env.CREDENTIAL_SECRET = secret; }
});

test('files are private, encrypted, atomically replaced and fail closed on corruption', async () => {
  const file = path.join(box.dir, 'data', 'test.enc');
  store.writeEncryptedFile(file, { private: 'synthetic private data' });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await readFile(file)).includes(Buffer.from('synthetic private data')), false);
  store.writeEncryptedFile(file, { version: 2 });
  assert.deepEqual(store.readEncryptedFile(file), { version: 2 });
  assert.equal((await readdir(path.dirname(file))).some(name => name.endsWith('.tmp')), false);
  await writeFile(file, 'corrupted');
  assert.equal(store.readEncryptedFile(file), null);
  assert.equal(store.readEncryptedFile(file + '.missing'), null);
});

test('account listings expose only metadata and deletion persists', async () => {
  const accounts = await box.import('services/credential-store.js');
  const privateFields = { clientSecret: 'synthetic-client-secret', refreshToken: 'synthetic-refresh', accessToken: 'synthetic-access', feedUrl: 'https://example.test/private-token', appPassword: 'synthetic-password' };
  accounts.setAccount('test:one', { provider: 'test', label: 'Synthetic account', ...privateFields });
  const listing = JSON.stringify(accounts.listAccounts());
  for (const [key, value] of Object.entries(privateFields)) { assert.equal(listing.includes(key), false); assert.equal(listing.includes(value), false); }
  assert.equal(accounts.deleteAccount('test:one'), true);
  assert.equal(accounts.deleteAccount('test:one'), false);
  assert.deepEqual(store.readEncryptedFile(path.join(box.dir, 'data/credentials.enc')), {});
});

test('reminder snapshots preserve other providers and migrate plaintext caches to encryption', async () => {
  const legacy = { apple: { items: [{ title: 'Synthetic legacy reminder' }], lastSyncedAt: null }, googleTasks: { items: [], lastSyncedAt: null }, microsoftTasks: { items: [], lastSyncedAt: null } };
  const legacyPath = path.join(box.dir, 'data/reminders-cache.json');
  await writeFile(legacyPath, JSON.stringify(legacy));
  const reminders = await box.import('services/reminders.js');
  assert.equal(reminders.getReminders().items[0].title, 'Synthetic legacy reminder');
  await assert.rejects(stat(legacyPath), { code: 'ENOENT' });
  reminders.updateGoogleTasks([{ title: 'Synthetic Google task' }]);
  reminders.updateMicrosoftTasks([{ title: 'Synthetic Microsoft task' }]);
  reminders.updateReminders([{ title: 'Synthetic Apple task' }], 'Test');
  assert.equal(reminders.getReminders().items.length, 3);
  reminders.updateReminders([], 'Test');
  assert.deepEqual(reminders.getReminders().items.map(item => item.source).sort(), ['google-tasks', 'microsoft-tasks']);
  const cache = await readFile(path.join(box.dir, 'data/reminders-cache.enc'));
  assert.equal(cache.includes(Buffer.from('Synthetic')), false);
  assert.equal(store.decryptJSON(cache).apple.items.length, 0);
});

test('calendar cache migration preserves events and removes the plaintext file', async () => {
  const legacy = { events: [{ title: 'Synthetic confidential event' }], knownCalendars: [], lastSyncTime: '2026-01-01T12:00:00Z' };
  const file = path.join(box.dir, 'data/events-cache.json');
  await writeFile(file, JSON.stringify(legacy));
  const calendars = await box.import('services/calendar-store.js');
  assert.deepEqual(calendars.getCachedData().events, legacy.events);
  await assert.rejects(stat(file), { code: 'ENOENT' });
  const encrypted = await readFile(path.join(box.dir, 'data/events-cache.enc'));
  assert.equal(encrypted.includes(Buffer.from(legacy.events[0].title)), false);
  assert.deepEqual(store.decryptJSON(encrypted), legacy);
});
