import dotenv from 'dotenv';
dotenv.config();

import { getGoogleCredentials, getICloudCredentials } from './services/credential-store.js';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  timezone: process.env.DISPLAY_TIMEZONE || 'America/New_York',
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '5'),
  calendarDaysBack: parseInt(process.env.CALENDAR_DAYS_BACK || '7'),
  calendarDaysForward: parseInt(process.env.CALENDAR_DAYS_FORWARD || '14'),

  // Legacy .env fields — kept for backward compat but credential store is preferred
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    calendarIds: (process.env.GOOGLE_CALENDAR_IDS || 'primary')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  },

  icloud: {
    username: process.env.ICLOUD_USERNAME || '',
    appPassword: process.env.ICLOUD_APP_PASSWORD || '',
    calendarNames: (process.env.ICLOUD_CALENDAR_NAMES || '')
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean),
  },

  reminders: {
    webhookSecret: process.env.REMINDERS_WEBHOOK_SECRET || '',
  },

  adminPin: process.env.ADMIN_PIN || '',
};

/**
 * Check which integrations have credentials configured.
 * Checks the credential store first, then falls back to .env.
 */
export function getEnabledSources() {
  return {
    google: !!getGoogleCredentials(),
    icloud: !!getICloudCredentials(),
    reminders: !!config.reminders.webhookSecret,
  };
}
