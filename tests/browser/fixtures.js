import { test as base } from '@playwright/test';
import { sandbox } from '../helpers/sandbox.js';

// Each test gets fresh route state (including rate limits) and a random port.
export const test = base.extend({
  baseURL: async ({}, use) => {
    const box = await sandbox();
    let app;
    try {
      app = await (await box.import('app.js')).buildApp();
      const address = await app.listen({ host: '127.0.0.1', port: 0 });
      await use(address);
    } finally {
      await app?.close();
      await box.cleanup();
    }
  },
});
