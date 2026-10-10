import { cp, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Run in a disposable app copy: production stores resolve relative to src/.
// Never copy .env, settings, or data, and never inherit provider credentials.
export async function sandbox() {
  const dir = await mkdtemp(path.join(tmpdir(), 'family-calendar-test-'));
  const previous = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (/^(GOOGLE_|ICLOUD_|MICROSOFT_|WEATHER_|ADMIN_PIN$|CREDENTIAL_SECRET$|REMINDERS_|ALLOWED_NETWORKS$|ALLOW_LOCAL_ICS_FEEDS$|DOTENV_CONFIG_)/.test(key)) delete process.env[key];
  }
  Object.assign(process.env, {
    ADMIN_PIN: '739126', CREDENTIAL_SECRET: randomBytes(32).toString('hex'),
    REMINDERS_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
    ALLOWED_NETWORKS: '127.0.0.1,::1', DISPLAY_TIMEZONE: 'UTC',
    NODE_ENV: 'production', DOTENV_CONFIG_PATH: path.join(dir, '.env'),
  });
  try {
    for (const name of ['src', 'frontend', 'package.json']) await cp(path.join(root, name), path.join(dir, name), { recursive: true });
    await mkdir(path.join(dir, 'data'));
    await symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  } catch (error) {
    await cleanup();
    throw error;
  }
  async function cleanup() {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(dir, { recursive: true, force: true });
  }
  return { dir, cleanup, import: (name) => import(pathToFileURL(path.join(dir, 'src', name)).href) };
}
