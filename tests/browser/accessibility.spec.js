import { expect } from '@playwright/test';
import { test } from './fixtures.js';
import AxeBuilder from '@axe-core/playwright';

async function audit(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
}
async function unlock(page) {
  await page.goto('/admin');
  await page.getByRole('textbox', { name: 'PIN', exact: true }).fill('739126');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.locator('#pin-overlay')).toBeHidden();
  await expect(page.locator('#accounts-list')).not.toContainText('Loading');
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px admin`, () => {
    test.use({ viewport });
    test('PIN dialog, errors, settings tabs and connection forms meet axe rules', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.locator('#pin-input')).toBeFocused();
      await audit(page);
      await page.locator('#pin-input').fill('wrong');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('alert')).toHaveText('Incorrect PIN');
      await audit(page);
      await page.locator('#pin-input').fill('739126');
      await page.keyboard.press('Enter');
      await expect(page.locator('#pin-overlay')).toBeHidden();
      for (const tab of ['Accounts', 'Display', 'System']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await audit(page);
      }
      await page.getByRole('tab', { name: 'Accounts', exact: true }).click();
      for (const provider of ['google', 'icloud', 'microsoft', 'ics']) {
        await page.locator(`#btn-connect-${provider}`).click();
        await expect(page.locator(`#${provider}-setup`)).toBeVisible();
        await audit(page);
        await page.locator(`#btn-${provider}-cancel`).click();
      }
    });
  });
}

test('PIN focus stays in the dialog; settings tabs support keyboard navigation', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('#pin-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#pin-input')).toBeFocused();
  await page.locator('#pin-input').fill('739126');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Accounts', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Display', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Display', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'System', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Accounts', exact: true })).toBeFocused();
});

test('admin token is session-only and absent from URLs, persistent storage and cookies', async ({ page, context }) => {
  const requests = [];
  page.on('request', req => requests.push(req.url()));
  await unlock(page);
  const token = await page.evaluate(() => sessionStorage.getItem('adminToken'));
  expect(token).toBeTruthy();
  expect(await page.evaluate(() => Object.values(localStorage))).not.toContain(token);
  expect(await context.cookies()).toEqual([]);
  expect(requests.some(url => url.includes(token))).toBe(false);
  const separate = await context.newPage();
  await separate.goto('/admin');
  await expect(separate.locator('#pin-overlay')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`populated ${theme} calendar: accessibility, literal untrusted text and no third-party requests`, async ({ page, baseURL }) => {
    await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
    const outbound = [];
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin !== baseURL) { outbound.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    const attack = '<img src=x onerror="window.__xss=1">';
    await page.route('**/api/calendar', async route => {
      const response = await route.fetch();
      const data = await response.json();
      const date = '2026-10-07';
      data.settings.display.theme = theme;
      data.events = [{ title: attack, start: `${date}T10:00:00Z`, end: `${date}T11:00:00Z`, allDay: false, source: 'google', calendarName: 'Synthetic family' }];
      data.reminders = { items: [{ title: attack, notes: attack, list: 'Synthetic list', isCompleted: false, priority: 0 }], lastSyncedAt: new Date().toISOString(), syncedBy: 'Test' };
      data.lastSyncTime = new Date().toISOString();
      await route.fulfill({ response, json: data });
    });
    await page.goto('/');
    await expect(page.locator('.day-cell')).toHaveCount(14);
    await expect(page.locator('.timed-event-title')).toHaveText(attack);
    await expect(page.locator('.reminder-title')).toHaveText(attack);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('#calendar-grid img, #reminders-list img')).toHaveCount(0);
    await audit(page);
    expect(outbound).toEqual([]);
  });
}

test('calendar respects all-day exclusive ends, time order, overflow and reminder completion order', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
  await page.route('**/api/calendar', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.settings.display.weekStart = 'sunday';
    data.events = [
      { title: 'Two-day event', start: '2026-10-06', end: '2026-10-08', allDay: true },
      ...[14, 10, 13, 11, 12].map(hour => ({ title: `Meeting ${hour}`, start: `2026-10-07T${hour}:00:00Z`, end: `2026-10-07T${hour}:30:00Z`, allDay: false })),
    ];
    data.reminders = { items: [
      { title: 'Done', isCompleted: true },
      { title: 'Later', isCompleted: false, dueDate: '2026-10-09' },
      { title: 'Earlier', isCompleted: false, dueDate: '2026-10-08' },
    ] };
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await expect(page.locator('.week-header-cell').first()).toHaveText('Sun');
  await expect(page.locator('.allday-event')).toHaveCount(2);
  await expect(page.locator('.timed-event-title')).toHaveText(['Meeting 10', 'Meeting 11', 'Meeting 12', 'Meeting 13']);
  await expect(page.locator('.day-events-more')).toHaveText('+1 more');
  await expect(page.locator('.reminder-title')).toHaveText(['Earlier', 'Later', 'Done']);
});

test('empty calendar and failed refresh remain usable with accessible status', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.day-cell')).toHaveCount(14);
  await audit(page);
  await page.route('**/api/calendar', route => route.fulfill({ status: 503, json: { error: 'Synthetic outage' } }));
  await page.evaluate(() => fetchData());
  await expect(page.locator('#sync-status')).toHaveClass(/is-error/);
  await expect(page.locator('#sync-status-text')).not.toBeEmpty();
  await expect(page.locator('.day-cell')).toHaveCount(14);
  await audit(page);
});
