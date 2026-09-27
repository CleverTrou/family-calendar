<!-- markdownlint-configure-file { "MD024": { "siblings_only": true } } -->

# Changelog

All notable changes to Family Calendar are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 2026-09-27 were first tagged `v0.0.1` to `v0.0.7`. Each of them
added features, so under SemVer each is a minor release. They were renumbered
`v0.1.0` to `v0.7.0`, on the same commits.

## [Unreleased]

### Changed

- **Breaking:** Node.js 20.18.1 or later is required (`engines` previously said
  18). The Pi setup scripts install a supported Node.js for the architecture:
  NodeSource 22 or 24 on arm64, and Debian's Node 20 on 32-bit armhf, where
  NodeSource has no maintained build.
  ([#71](https://github.com/CleverTrou/family-calendar/pull/71))
- Dependencies updated: fastify 5.12, @fastify/static 10.1 (exact pin), undici
  7.30, dotenv 18, and minor updates to @fastify/cors, @fastify/rate-limit,
  node-cron, and tsdav. ([#72](https://github.com/CleverTrou/family-calendar/pull/72))
- The README matches the code and the Pi: dual-stack `HOST` default, the real
  typeface pairings, display styles, the IPv6 Tailscale allowlist prefix, and
  corrected Pi companion setup.
  ([#70](https://github.com/CleverTrou/family-calendar/pull/70))

### Fixed

- The Pi Zero's heap cap is really 128 MB. On Node 22 and later,
  `--max-old-space-size=128` alone allowed a 320 MB heap.
  ([#71](https://github.com/CleverTrou/family-calendar/pull/71))

### Security

- All 24 open Dependabot alerts (15 high, 9 moderate) resolved, including path
  traversal in @fastify/static. `npm audit` reports 0.
  ([#72](https://github.com/CleverTrou/family-calendar/pull/72))

## [0.7.0] - 2026-07-04

Mostly security, privacy, and accessibility.

### Added

- A weekly nvm/npm update checker that sends an ntfy notification including the
  update commands. ([#9](https://github.com/CleverTrou/family-calendar/pull/9),
  [#10](https://github.com/CleverTrou/family-calendar/pull/10))
- The docs and admin page explain Google OAuth redirect URI requirements.
  ([#29](https://github.com/CleverTrou/family-calendar/pull/29))

### Changed

- The server binds dual-stack (`::`), and the IP allowlist understands IPv6.
  ([#19](https://github.com/CleverTrou/family-calendar/pull/19))
- Dependencies updated: fastify, tsdav, googleapis, node-cron,
  @fastify/rate-limit, dotenv.

### Fixed

- The Display and System admin tabs didn't load data when a PIN was set.
  ([#24](https://github.com/CleverTrou/family-calendar/pull/24))
- Stale cached OAuth2 clients after reconnecting Google or Microsoft.
  ([#28](https://github.com/CleverTrou/family-calendar/pull/28))

### Security

- Hardening: auth gates, CORS, a Content Security Policy, an SSRF guard, and
  timing-safe PIN comparison.
  ([#8](https://github.com/CleverTrou/family-calendar/pull/8),
  [#11](https://github.com/CleverTrou/family-calendar/pull/11),
  [#22](https://github.com/CleverTrou/family-calendar/pull/22))
- Security, privacy, and accessibility gaps from a full audit.
  ([#33](https://github.com/CleverTrou/family-calendar/pull/33))
- Gitleaks and TruffleHog secret scanning in CI, and Dependabot.

## [0.6.0] - 2026-04-27

### Added

- Japandi display style: minimal, with sharper corners and finer outlines, but
  more intentional accents than Default.
- Hover thumbnails for the Style, Palette, and Typeface options in the admin
  page.
- A "View Display" button in the floating save bar after changes are saved.

### Changed

- Design options are split into Style (Default, Kitchen Paper, Japandi), Palette
  (the color sets previously called "Themes"), and Typeface. Kitchen Paper is
  now both a Style and a Palette.

### Fixed

- Position of the HDMI-CEC control in admin settings.

## [0.5.0] - 2026-04-26

### Added

- Kitchen Paper theme, with more design accents than the standard themes, and
  new font choices.
- Calendars from an ICS link, with no developer account or app setup needed.
- Automatic light/dark switching at local sunrise and sunset, with a "use my
  location" button.
- Weather: daily forecasts in the calendar grid and current conditions in the
  header.
- Option to start the week on Sunday or Monday.
- HDMI-CEC TV control for the display schedule: wake the TV and switch input,
  including after the Pi reboots.
- Samsung Tizen smart TV app instructions (untested).
- Design documentation, and a "Recommended Raspberry Pi companion" README
  section.

### Changed

- Scaling is resolution-independent.

## [0.4.0] - 2026-04-02

### Added

- A lightweight mode for Raspberry Pi Zero 2 W and Pi 3B+.
  ([#5](https://github.com/CleverTrou/family-calendar/pull/5))

## [0.3.0] - 2026-04-01

### Added

- Microsoft account support (untested, as it needs an Azure developer
  account).
- A display scale setting in Admin > Display for low- and high-resolution
  screens.

## [0.2.0] - 2026-03-31

### Added

- The display schedule can be set from the admin page.
- Google calendars are discovered automatically on each sync.

### Fixed

- Raspberry Pi setup on Debian Trixie: Chromium package detection, and a
  self-bootstrapping `pi-setup.sh`.
- Refreshing the calendar list.

### Security

- Removed a real hostname and IP addresses from public files.

## [0.1.0] - 2026-03-25

The repository as it was when first made public.

### Added

- Two-week calendar grid, with all-day events as colored chips and timed events
  with dots, times, and titles.
- Reminders sidebar, from Apple Reminders via a Shortcuts webhook.
- Sync from Google Calendar and iCloud CalDAV every 5 minutes.
- Admin panel at `/admin`, with a setup wizard for connecting accounts and
  display settings.
- Light and dark themes with per-person event colors.
- Raspberry Pi kiosk mode that boots straight into fullscreen Chromium.
- LG webOS app.

[Unreleased]: https://github.com/CleverTrou/family-calendar/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/CleverTrou/family-calendar/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/CleverTrou/family-calendar/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/CleverTrou/family-calendar/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/CleverTrou/family-calendar/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/CleverTrou/family-calendar/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/CleverTrou/family-calendar/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/CleverTrou/family-calendar/releases/tag/v0.1.0
