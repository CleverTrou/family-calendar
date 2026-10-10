# Automated tests

## Run locally

Use Node 20.18.1 or later (24 recommended) and npm:

```sh
npm ci
npm test                         # Node unit and HTTP integration tests
npx playwright install chromium # once per Playwright/browser update
npm run test:browser             # Chromium, axe and keyboard/UI tests
npm run test:security            # npm audit; fails on high/critical advisories
npm run test:all                 # Node and browser suites
```

On supported Linux distributions, `npx playwright install --with-deps chromium`
also installs browser system dependencies. GitHub Actions uses this command on
Ubuntu. `npx playwright show-report` opens the most recent local browser report.

Tests copy `src`, `frontend`, and `package.json` into temporary directories and
share only installed `node_modules`. They never copy your `.env`, `settings.json`,
or `data`. Provider environment variables are cleared in each test process;
credentials and reminder/event contents are synthetic. The HTTP factory does not
start the sync scheduler. OAuth exchanges and DNS rebinding use controlled mocks;
no real calendar provider account is needed. Browser tests use fresh app instances,
random loopback ports, a single worker, and no retries, keeping rate limiting active.
Temporary files and servers are cleaned up after each fixture.

## Coverage

| Area | Checks |
| --- | --- |
| Admin access | All sensitive route families reject missing/invalid tokens; correct PIN grants access; malformed, tampered, expired and future tokens fail; five-attempt PIN limit |
| OAuth | Admin-only start; unknown/expired/cross-provider states fail before exchange; valid state is consumed once; client secrets stay out of consent URLs |
| Network security | IPv4/IPv6 allowlist boundaries; spoofed forwarding headers; literal, encoded, mapped and DNS-rebound private feed addresses; explicit local-feed opt-in; CORS and security headers; static-file isolation |
| Privacy | Authenticated randomized encryption, tamper/wrong-key rejection, mode 0600 files, atomic replacement, metadata-only account listings, deletion, plaintext cache migration, webhook log redaction, API `no-store` headers |
| Data integrity | Valid JSON/Shortcuts webhooks, invalid/oversized bodies, independent reminder sources, settings validation/persistence, calendar order/overflow and exclusive all-day end dates |
| Accessibility | axe WCAG 2.0/2.1/2.2 A/AA rules plus best practices, without rule exclusions; PIN/error states, all admin tabs and provider forms at 1280px and 390px; default palette and style in light/dark display modes; empty/error states |
| Browser security/privacy | Event/reminder HTML payloads render as text; session-only admin token; no token in URLs/cookies/localStorage; no third-party requests for the default system-font display |
| Interaction | Modal focus containment/restoration; tab arrow/Home/End navigation; screen-reader names/statuses; calendar and reminder rendering |

These are regression checks, not a complete security audit or accessibility
certification. Manual screen-reader, zoom/reflow, TV/Pi device, other browser,
custom palette/color and opt-in web-font checks remain useful. The display API is
intentionally unauthenticated and includes family data and display settings;
protect it with `ALLOWED_NETWORKS`. Optional Google Fonts and weather services
contact third parties; the no-third-party assertion covers the default system
font without configured weather. Live provider consent and sync are not covered.

## GitHub

`Tests` runs on pull requests, pushes to `main`, weekly, and manual dispatch:

- **Security, privacy and API (Node 20.18.1 / 22 / 24)**
- **Accessibility and browser privacy**
- **Dependency vulnerability audit** (production and development packages)

Browser HTML reports, screenshots and traces contain only synthetic fixture data
and are retained for seven days. Test failures fail the job; no allowed failures,
retries, or baseline accessibility violations are configured.

`CodeQL` runs the JavaScript/TypeScript `security-extended` queries on the same
events. Findings appear under GitHub's Security → Code scanning. Public repos
can use CodeQL; private repos need GitHub Code Security enabled. Configure a code
scanning ruleset to block merges on the desired alert severity: a successful
analysis job alone does not mean it found no alerts.

The existing Gitleaks and TruffleHog workflows continue scanning secrets, and
Dependabot covers npm packages and GitHub Actions. New action references are
pinned to commit SHAs. Jobs use read-only contents access, except CodeQL's scoped
permission to upload security results; tests need no repository secrets and use
`pull_request`, never `pull_request_target`.

After the workflows first run on GitHub, make the listed checks required in the
repository's branch protection/ruleset. Workflow files cannot enable that setting.
