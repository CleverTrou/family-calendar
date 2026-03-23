# Family Calendar Display

Always-on wall-mounted calendar and reminders display for a Raspberry Pi 5 connected to a 21"+ LCD monitor. Unifies **Google Calendar**, **iCloud Calendar**, and **Apple Reminders** into a single at-a-glance view.

```
┌──────────────────────────────────────────────────────────────────┐
│  12:34 PM   Sunday, February 22         Family Calendar  ● ● ●  │
├─────────────────────────────────────────────┬────────────────────┤
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun   │   REMINDERS        │
│  This Week                                  │                    │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬────┐│   ○ Groceries      │
│  │ 16  │ 17  │ 18  │ 19  │ 20  │ 21  │ 22 ││   ○ Fix shelf      │
│  │     │ Pull│     │ Legs│ Push│     │    ▐││   ○ Call dentist   │
│  │7p Q │3p T │7p S │11a J│     │     │7p Q ││                    │
│  └─────┴─────┴─────┴─────┴─────┴─────┴────┘│                    │
│  Next Week                                  │                    │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬────┐│                    │
│  │ 23  │ 24  │ 25  │ 26  │ 27  │ 28  │  1 ││                    │
│  │     │ Pull│     │ Legs│ Push│     │ Mar ││                    │
│  │     │3p T │     │5p J │4p M │     │     ││                    │
│  └─────┴─────┴─────┴─────┴─────┴─────┴────┘│                    │
├─────────────────────────────────────────────┴────────────────────┤
│  Last synced 2 min ago                              /admin ⚙     │
└──────────────────────────────────────────────────────────────────┘
```

## Features

- **Two-week calendar grid** — Monday through Sunday, this week and next
- **All-day events** as colored chips inside each day cell
- **Timed events** with colored dots, time, and title
- **Reminders sidebar** from Apple Reminders via Shortcuts webhook
- **Multi-source sync** — Google Calendar API + iCloud CalDAV, every 5 minutes
- **Admin panel** at `/admin` — GUI setup wizard for connecting accounts + display settings
- **Light/dark themes** with per-person event colors
- **Raspberry Pi kiosk mode** — boots directly into fullscreen Chromium

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20+, [Fastify](https://fastify.dev) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Google Calendar | [googleapis](https://www.npmjs.com/package/googleapis) OAuth2 |
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

See **[SHORTCUTS-SETUP.md](SHORTCUTS-SETUP.md)** for step-by-step instructions with diagrams.

## Raspberry Pi Deployment

The `deploy/` directory contains everything needed to set up a Raspberry Pi 5 as a dedicated calendar display:

```bash
# On a fresh Raspberry Pi OS Lite (64-bit Bookworm):
chmod +x deploy/pi-setup.sh
sudo ./deploy/pi-setup.sh
```

This installs a minimal X11 stack, Chromium, Node.js, and configures:
- **Auto-start** — Calendar launches at boot in fullscreen kiosk mode
- **Display schedule** — Screen turns off at night, back on in the morning (configurable via systemd timers)
- **Cursor hiding** — Mouse cursor hidden after idle
- **Crash recovery** — Chromium auto-restarts if it crashes

## Project Structure

```
family-calendar/
├── src/
│   ├── server.js              # Fastify server entry point
│   ├── config.js              # Environment config with defaults
│   ├── routes/
│   │   ├── api.js             # GET /api/calendar, /api/health, /api/settings
│   │   ├── auth.js            # OAuth2 callback routes (Google)
│   │   ├── accounts.js        # Account CRUD (connect, test, disconnect)
│   │   └── webhooks.js        # POST /api/reminders/sync
│   └── services/
│       ├── admin-auth.js      # PIN-based admin authentication
│       ├── calendar-store.js  # Event cache + sync orchestration
│       ├── credential-store.js # Encrypted credential storage (AES-256-GCM)
│       ├── google-calendar.js # Google Calendar API client
│       ├── icloud-calendar.js # iCloud CalDAV client
│       ├── reminders.js       # Reminders webhook store
│       ├── settings.js        # User preferences (JSON file)
│       └── sync-scheduler.js  # Cron-based sync loop
├── data/                      # Runtime data (gitignored)
│   └── credentials.enc        # Encrypted provider credentials
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
│       └── utils.js           # Date parsing, formatting, color mapping
├── deploy/                    # Raspberry Pi setup scripts + systemd units
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
| `SYNC_INTERVAL_MINUTES` | `5` | How often to re-fetch calendars |
| `DISPLAY_TIMEZONE` | `America/New_York` | Timezone for date display |
| `CALENDAR_DAYS_BACK` | `7` | Days in the past to fetch events |
| `CALENDAR_DAYS_FORWARD` | `14` | Days in the future to fetch events |
| `ADMIN_PIN` | *(none)* | Optional numeric PIN to protect `/admin` |
| `CREDENTIAL_SECRET` | *(auto)* | Encryption key for credential store (auto-generated) |

## License

MIT
