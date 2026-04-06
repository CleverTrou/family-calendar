# CLAUDE.md

## Overview
Always-on wall-mounted calendar display for Raspberry Pi 5 (and 4K TV via webOS).
Unifies Google Calendar, iCloud Calendar, Apple Reminders, Microsoft Calendar, and Microsoft To Do.

## Stack
- **Backend:** Node.js 20+, Fastify 5, ES modules (`"type": "module"`)
- **Frontend:** Vanilla HTML/CSS/JS in `frontend/` — no bundler, served as static files
- **No tests** — manual verification via browser and Pi display

## Commands
- `npm start` / `npm run dev` — run server (dev uses `node --watch`)
- `npm run auth:google` — one-time Google OAuth2 setup
- `deploy/pi-setup.sh` — Raspberry Pi kiosk bootstrap

## Architecture
- **Entry:** `src/server.js` → routes in `src/routes/`, services in `src/services/`
- **Config:** `.env` file (see `.env.example`), runtime settings in `settings.json`
- **Credentials:** Encrypted store in `data/credentials.enc`, GUI at `/admin` → Accounts
- **Sync:** `sync-scheduler.js` runs on `SYNC_INTERVAL_MINUTES` (default 5)

## Key Services
- `google-calendar.js` / `google-tasks.js` — Google Calendar + Tasks via googleapis
- `icloud-calendar.js` — iCloud CalDAV via tsdav
- `microsoft-calendar.js` / `microsoft-tasks.js` — Microsoft Graph API
- `calendar-store.js` — in-memory unified event store
- `reminders.js` — Apple Reminders via webhook

## Conventions
- No TypeScript, no build step — keep it simple
- Frontend CSS uses custom properties for theming
- `DISPLAY_TIMEZONE` in `.env` controls all time rendering (default: America/New_York)
- Settings changes via `/admin` GUI persist to `settings.json`
- Deploy targets: Raspberry Pi (Chromium kiosk) and LG webOS TV (`deploy/webos-app/`)
