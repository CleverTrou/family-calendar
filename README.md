# Family Calendar Display

![Social Preview](social-preview.png)

Always-on wall-mounted calendar and reminders display for a Raspberry Pi 5 connected to a 21"+ LCD monitor. Unifies **Google Calendar**, **iCloud Calendar**, **Apple Reminders**, and **Google Tasks** into a single at-a-glance view.

## Features

- **Two-week calendar grid** — Monday through Sunday, this week and next
- **All-day events** as colored chips inside each day cell
- **Timed events** with colored dots, time, and title
- **Reminders sidebar** — Apple Reminders (via Shortcuts webhook) + Google Tasks (via API)
- **Multi-source sync** — Google Calendar API + iCloud CalDAV, every 5 minutes
- **Persistent cache** — Reminders survive server restarts
- **Admin panel** at `/admin` — GUI setup wizard for connecting accounts + display settings
- **Light/dark themes** with per-person event colors
- **Network security** — IP allowlist, rate limiting, security headers
- **Raspberry Pi kiosk mode** — boots directly into fullscreen Chromium
- **macOS launcher apps** — double-click to start/stop the server
- **LG webOS app** — sideloadable package for LG smart TVs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20+, [Fastify 5](https://fastify.dev) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Google Calendar | [googleapis](https://www.npmjs.com/package/googleapis) OAuth2 |
| Google Tasks | [googleapis](https://www.npmjs.com/package/googleapis) Tasks API |
| iCloud Calendar | [tsdav](https://www.npmjs.com/package/tsdav) CalDAV + [ical.js](https://www.npmjs.com/package/ical.js) |
| Apple Reminders | Webhook from [Apple Shortcuts](https://support.apple.com/guide/shortcuts/welcome/ios) |
| Scheduling | [node-cron](https://www.npmjs.com/package/node-cron) |
| Display | Chromium kiosk mode on Raspberry Pi OS |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

**Option A: GUI Setup (recommended)**

Start the server (`npm start`) and visit [http://localhost:3000/admin](http://localhost:3000/admin). The **Accounts** tab walks you through connecting Google and iCloud calendars. Credentials are stored encrypted on disk.

**Option B: Manual .env Setup**

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

- **Google Calendar** — Create OAuth2 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), then run `npm run auth:google` to get a refresh token
- **iCloud Calendar** — Generate an [app-specific password](https://appleid.apple.com) (Sign-In and Security > App-Specific Passwords)
- **Apple Reminders** — Set any shared secret; you'll use it when creating the Shortcut

### 3. Run

```bash
npm start
# or with auto-reload for development:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the calendar display and [http://localhost:3000/admin](http://localhost:3000/admin) for settings.

## Apple Reminders Setup

Apple Reminders don't have a public API. This project uses an Apple Shortcut that runs on your iPhone to push reminders to the server via webhook.

See **[SHORTCUTS-SETUP.md](SHORTCUTS-SETUP.md)** for step-by-step instructions.

## Deployment Options

### Raspberry Pi (recommended for always-on display)

The `deploy/` directory contains everything needed to set up a Raspberry Pi 5 as a dedicated calendar display:

```bash
# On a fresh Raspberry Pi OS Lite (64-bit Bookworm):
chmod +x deploy/pi-setup.sh
sudo ./deploy/pi-setup.sh
```

This installs a minimal X11 stack, Chromium, Node.js, and configures:
- **Auto-start** — Calendar launches at boot in fullscreen kiosk mode
- **Display schedule** — Screen turns off at night, back on in the morning (configurable from the admin GUI, per day-of-week)
- **Cursor hiding** — Mouse cursor hidden after idle
- **Crash recovery** — Chromium auto-restarts if it crashes

### macOS (development or temporary display)

Double-click launcher apps in `deploy/`:
- **Family Calendar.app** — Starts the server and opens the calendar in your browser
- **Stop Calendar.app** — Stops the running server

Generate the apps with `deploy/generate-mac-icon.sh`.

### LG Smart TVs (webOS)

A lightweight webOS app package is available in `deploy/webos-app/` for LG smart TVs. The TV connects to your calendar server over the local network.

See **[deploy/webos-app/README.md](deploy/webos-app/README.md)** for setup instructions.

> **Note:** OLED TVs are not recommended for always-on display due to burn-in risk. Best used as an on-demand display.

## Project Structure

```
family-calendar/
├── src/
│   ├── server.js              # Fastify server entry point
│   ├── config.js              # Environment config with defaults
│   ├── routes/
│   │   ├── api.js             # GET /api/calendar, /api/health, /api/settings, /api/display/status
│   │   ├── auth.js            # OAuth2 callback routes (Google)
│   │   ├── accounts.js        # Account CRUD (connect, test, disconnect)
│   │   └── webhooks.js        # POST /api/reminders/sync
│   └── services/
│       ├── admin-auth.js      # PIN-based admin authentication
│       ├── calendar-store.js  # Event cache + sync orchestration
│       ├── credential-store.js # Encrypted credential storage (AES-256-GCM)
│       ├── google-calendar.js # Google Calendar API client
│       ├── google-tasks.js    # Google Tasks API client
│       ├── icloud-calendar.js # iCloud CalDAV client
│       ├── reminders.js       # Unified reminders store (Apple + Google Tasks)
│       ├── settings.js        # User preferences (JSON file)
│       └── sync-scheduler.js  # Cron-based sync loop
├── data/                      # Runtime data (gitignored)
│   ├── credentials.enc        # Encrypted provider credentials
│   └── reminders-cache.json   # Persisted reminders across restarts
├── frontend/
│   ├── index.html             # Main calendar display
│   ├── admin.html             # Settings panel
│   ├── css/
│   │   ├── styles.css         # Calendar + reminders styles
│   │   └── admin.css          # Admin panel styles
│   └── js/
│       ├── app.js             # Main loop: fetch data, render, update clock
│       ├── calendar-view.js   # Two-week grid renderer
│       ├── reminders-view.js  # Reminders sidebar renderer
│       ├── admin.js           # Admin panel logic
│       └── utils.js           # Date parsing, formatting, color mapping
├── deploy/
│   ├── pi-setup.sh            # Raspberry Pi kiosk setup script
│   ├── display-agent.sh       # Screen on/off agent (polls server schedule)
│   ├── display-agent.service  # Systemd service for display agent
│   ├── generate-mac-icon.sh   # Generate macOS .app launchers
│   └── webos-app/             # LG smart TV app package
├── scripts/
│   └── google-auth.js         # One-time Google OAuth2 token helper
├── .env.example               # Template for credentials
└── SHORTCUTS-SETUP.md         # Apple Shortcuts setup guide
```

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address (`127.0.0.1` for localhost only) |
| `SYNC_INTERVAL_MINUTES` | `5` | How often to re-fetch calendars |
| `DISPLAY_TIMEZONE` | `America/New_York` | Timezone for date display |
| `CALENDAR_DAYS_BACK` | `7` | Days in the past to fetch events |
| `CALENDAR_DAYS_FORWARD` | `14` | Days in the future to fetch events |
| `ADMIN_PIN` | *(none)* | Optional numeric PIN to protect `/admin` |
| `CREDENTIAL_SECRET` | *(auto)* | Encryption key for credential store (auto-generated) |

### Network Security

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_NETWORKS` | *(none)* | Comma-separated CIDR ranges to allow (e.g., `10.0.0.0/24,127.0.0.1`) |

When `ALLOWED_NETWORKS` is set, requests from IPs outside those ranges receive `403 Forbidden`. The admin PIN endpoint is also rate-limited to 5 attempts per minute.

**Recommended `.env` for a home network:**

```bash
ALLOWED_NETWORKS=192.168.1.0/24,127.0.0.1
# or for 10.x networks:
ALLOWED_NETWORKS=10.0.0.0/24,127.0.0.1
# add Tailscale if you use it:
ALLOWED_NETWORKS=10.0.0.0/24,127.0.0.1,100.64.0.0/10
```

## License

MIT
