import dotenv from 'dotenv';
dotenv.config();

import { getGoogleCredentials, getICloudCredentials, getMicrosoftCredentials } from './services/credential-store.js';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  timezone: process.env.DISPLAY_TIMEZONE || 'America/New_York',
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '5'),
  calendarDaysBack: parseInt(process.env.CALENDAR_DAYS_BACK || '7'),
  calendarDaysForward: parseInt(process.env.CALENDAR_DAYS_FORWARD || '14'),
  // Comma-separated list of allowed IP ranges (empty = allow all)
  // e.g., "10.0.0.0/24,127.0.0.1" to restrict to local network
  allowedNetworks: (process.env.ALLOWED_NETWORKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

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
    microsoft: !!getMicrosoftCredentials(),
    reminders: !!config.reminders.webhookSecret,
  };
}
