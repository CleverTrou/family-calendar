# Design System

This document captures the visual vocabulary of the family-calendar kiosk display: the design tokens, the components built from them, and the conventions that keep them consistent across light/dark modes and 9 color palettes.

It serves three purposes:

1. **Reference** — what tokens exist, what they mean, where they live.
2. **Specification** — how the existing components use those tokens, including states, variants, and accessibility notes.
3. **Constraint** — the contract that any *new* component must respect. The AirPlay audio widget at the bottom of this doc is the first such component to be designed under this system.

> **Audience.** Anyone touching `frontend/css/` or building a new visual component in `frontend/js/`. If you find yourself typing a hex value or a raw `px` while editing UI, this doc tells you what to type instead.

---

## 1. System Overview

### Context

The display is a **wall-mounted, always-on, non-interactive kiosk**:

- **Reference resolution:** 1920×1080 (Pi HDMI out via Chromium kiosk; LG webOS TV is a secondary target via `deploy/webos-app/`).
- **Viewing distance:** ~2–4 meters. Legibility at distance dictates type sizes and contrast.
- **Input model:** none. The display is read-only — no hover, focus, or click behaviors. The `/admin` surface (separate document) is the only interactive surface and follows different rules.
- **Refresh cadence:** server-pushed sync every `SYNC_INTERVAL_MINUTES` (default 5); client polls and re-renders. Components must tolerate full re-renders, not in-place updates.

### Two-dimensional theming

Two HTML attributes compose to determine the active visual style:

| Attribute | Values | Source |
|-----------|--------|--------|
| `data-theme` | `light`, `dark` | Set on `<html>` based on time of day or sun-calc ([sun-calc.js](frontend/js/sun-calc.js), [themes.js](frontend/js/themes.js)) |
| `data-color-theme` | `default`, `nord`, `ocean`, `forest`, `sunset`, `rose`, `slate`, `mocha`, `kitchen-paper` | User-configured in `/admin` → Display ([themes.js:270](frontend/js/themes.js#L270)) |

Color themes override **neutral** tokens only (`--bg-*`, `--text-*`, `--border`, `--shadow`, `--reminder-done`). Brand accent tokens (`--color-primary`, `--color-secondary`, `--color-family`) are deliberately *excluded* from theming — those represent calendar identity and are configured separately per calendar source.

**Implication for new components:** If a component needs a neutral surface (background, border, text), it must use a token that themes are allowed to override. If it needs to express identity (which calendar an event belongs to), it uses a brand token. Mixing the two leaks identity into the palette swap.

### Sizing convention

All sizes use **viewport-relative units** (`vw`/`vh`) so the layout scales identically across kiosk and webOS. Reference: `1920×1080 → 1px ≈ 0.0521vw / 0.0926vh` ([styles.css:38-40](frontend/css/styles.css#L38)).

A frequent pattern is computed sizes like `1.875vw` (font-size of the clock) — these are *intentional* magic numbers anchored to the reference. Do not alias them to named tokens; their meaning is positional, not semantic.

---

## 2. Design Tokens

All tokens are CSS custom properties declared in [`frontend/css/styles.css`](frontend/css/styles.css#L1-L35). The `:root` block holds brand accents; `:root[data-theme="light"]` and `:root[data-theme="dark"]` hold the neutral palette per mode.

### 2.1 Brand accents (theme-invariant)

| Token | Value | Purpose |
|---|---|---|
| `--color-primary` | `#4285f4` (Google blue) | Primary calendar accent (typically Google Calendar). Today-cell highlight, reminder checkboxes for Google Tasks. |
| `--color-secondary` | `#e91e8c` | Secondary calendar accent (typically iCloud or partner). |
| `--color-family` | `#0f9d58` | Family/shared calendar accent. Default reminder checkbox border. |
| `--color-default` | `#78909c` | Fallback for events with no assigned color. |

> Users can override these in `/admin` → Accounts. The defaults represent the most common assignment but should not be hardcoded into component CSS — always reference via `var(--color-primary)` etc.

### 2.2 Neutral palette — light theme

[styles.css:9-21](frontend/css/styles.css#L9)

| Token | Light value | Used for |
|---|---|---|
| `--bg-body` | `#f0f2f5` | App background, calendar panel, reminders panel, `is-today` shade base |
| `--bg-card` | `#ffffff` | Header bar, footer, raised surfaces |
| `--bg-panel-header` | `#fafafa` | Panel section headers (`.panel-header`, `.week-header`) |
| `--bg-day-header` | `#f5f7fa` | Reserved for day-cell header backgrounds (currently unused but defined) |
| `--text-primary` | `#111118` | Headings, day numbers, event titles |
| `--text-secondary` | `#374151` | Subdued labels (date, week-label, panel headers) |
| `--text-muted` | `#4b5563` | Tertiary text (no-events, footer, weather lows) |
| `--border` | `#e5e7eb` | All hairlines and panel separators |
| `--shadow` | `rgba(0, 0, 0, 0.06)` | Elevation (currently used sparingly; reserved for overlays) |
| `--event-bg-opacity` | `0.12` | Translucent fill multiplier for event chips |
| `--reminder-done` | `#d1d5db` | Filled checkbox color when reminder is completed |

### 2.3 Neutral palette — dark theme

[styles.css:23-35](frontend/css/styles.css#L23)

| Token | Dark value | Notes |
|---|---|---|
| `--bg-body` | `#0f0f14` | Slightly blue-black (not pure `#000`) |
| `--bg-card` | `#1a1a24` | First elevation step |
| `--bg-panel-header` | `#1e1e2a` | Section dividers |
| `--bg-day-header` | `#16161f` | Reserved |
| `--text-primary` | `#f0f1f5` | Off-white for legibility |
| `--text-secondary` | `#c9cdd5` | |
| `--text-muted` | `#a0a7b4` | |
| `--border` | `#2a2a3a` | |
| `--shadow` | `rgba(0, 0, 0, 0.3)` | Stronger than light to read on dark surfaces |
| `--event-bg-opacity` | `0.18` | Higher than light — translucent fills need more saturation against dark |
| `--reminder-done` | `#4b5563` | |

### 2.4 Color themes

Beyond `default` (which uses the values above), 8 named palettes override the neutral tokens. See [themes.js](frontend/js/themes.js) for full definitions. Each palette declares both `light` and `dark` variants. Brand accents are not overridden.

### 2.5 Typography

- **Font stack:** `var(--display-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)` ([styles.css:52](frontend/css/styles.css#L52)). The `--display-font` variable can be set externally to switch fonts; default falls through to system fonts.
- **Numerics:** time and weather values use `font-variant-numeric: tabular-nums` so digits align in a fixed grid. Apply to any new numeric display.
- **Scale:** there is no named type scale. Sizes are computed against the 1920×1080 reference (e.g. `1.875vw` for the clock, `1.667vw` for date numbers, `0.833vw` for body text). When in doubt, match a similar-purpose component rather than picking a new value.

### 2.6 Spacing

Spacing is also viewport-relative. Common patterns:

- Inter-element gap inside a header row: `0.833vw`
- Cell padding: `0.556vh 0.417vw`
- Panel header padding: `0.926vh 1.042vw`

There is no spacing scale. Match neighbors rather than inventing values.

### 2.7 Borders & radii

- **Hairline:** `1px solid var(--border)` for separators between panels, headers, day cells.
- **Heavy divider:** `2px solid var(--border)` for week-row separation.
- **Radii:** `0.208vw` for event chips, `50%` for circular dots/checkboxes, `999px` for pill shapes (sync error). No `--radius-*` tokens — the values are positional.

---

## 3. Component Specifications

Each component below follows: **Description → Variants → States → Tokens → Accessibility → Do's & Don'ts**. References point to the CSS selector and the JS that renders it.

### 3.1 Header

**Selector root:** `.header` ([styles.css:64](frontend/css/styles.css#L64), [index.html:10-26](frontend/index.html#L10))

**Description.** The top bar of the kiosk display. Always visible. Houses three regions: left (clock, date, current weather), center (app title), right (calendar legend, sync status indicator).

| Variant | Use when |
|---|---|
| Single variant | Always rendered the same; populated dynamically |

| State | Visual | Behavior |
|---|---|---|
| Default | Bottom border via `--border`, surface `--bg-card` | None (non-interactive) |

**Sub-elements & tokens used:**

| Element | Selector | Tokens |
|---|---|---|
| Surface | `.header` | `--bg-card`, `--border` |
| Clock | `.clock` | `--text-primary` (inherited), `1.875vw` size, `tabular-nums` |
| Date | `.date` | `--text-secondary`, `0.833vw` |
| Title | `.header-title` | `--text-secondary`, `0.938vw`, uppercase, letter-spacing `0.04em` |
| Weather | `.header-weather` | `--text-primary`, `1.25vw` |
| Legend | `.legend` + `.legend-dot` | Brand accents (`--color-primary` etc.) per dot, `--text-secondary` for labels |

**Accessibility.** No interactive elements. Title is a `<h1>` for document outline. Sync status (see 3.2) carries the live region.

**Do / Don't.**

| ✅ Do | ❌ Don't |
|---|---|
| Keep the three regions balanced — left/right have `min-width: 16.667vw` to prevent center drift | Add interactive elements; the kiosk is read-only |
| Use `tabular-nums` for any new numeric content (counters, durations) | Hardcode font sizes; copy from a sibling element instead |

---

### 3.2 Sync status indicator

**Selector root:** `.sync-status` ([styles.css:129-172](frontend/css/styles.css#L129), [index.html:21-24](frontend/index.html#L21))

**Description.** A small icon-plus-text pill in the header right that reflects the most recent sync attempt. Healthy state is a quiet hourglass/checkmark; error/stale state expands into a high-contrast amber pill that's readable from across the room.

| Variant | Use when |
|---|---|
| Default (healthy) | Most recent sync succeeded |
| `.is-error` | Most recent sync failed or no sync in last interval |
| `.is-stale` (defined but rare) | Sync hasn't completed in an extended window |

| State | Visual | Tokens |
|---|---|---|
| Healthy | Icon-only, green dot | `#0f9d58` (hardcoded — see audit §4.1), `--text-muted` for any text |
| Error | Pill: amber bg + dark amber text | Hardcoded `#fff3cd` / `#92400e` (light), `rgba(217,119,6,0.18)` / `#fbbf24` (dark) |

**Accessibility.** Should carry `role="status"` with `aria-live="polite"` so screen readers (if attached) announce sync failures. **Currently missing — TODO for follow-up.**

**Do / Don't.**

| ✅ Do | ❌ Don't |
|---|---|
| Keep the error variant prominent — it's the only failure signal a household member sees | Use red for sync errors; amber distinguishes "retryable" from "broken" |
| Match new "alert"-style indicators to this pattern (icon-plus-text, pill at error level) | Add a third color level; collapse to healthy/alert binary |

> **Audit note.** This component currently uses hardcoded hex values. After §4.1 promotes them to `--color-warning-*` tokens, this spec will resolve. Until then: **do not** copy these hex values into other components — use `--color-secondary` or wait for the migration.

---

### 3.3 Calendar grid

**Selectors:** `.calendar-panel` > `.calendar-grid` > [`.week-label`, `.week-header`, `.week-row`] > `.week-days` > `.day-cell` ([styles.css:213-444](frontend/css/styles.css#L213), [calendar-view.js](frontend/js/calendar-view.js))

**Description.** The dominant visual surface — a two-week grid (current + next), each week a row of 7 day cells. Each day cell shows: date number, optional month indicator (when crossing months), weather badge, all-day event chips, timed event list, and an overflow "+N more" tail.

| Sub-component | Selector | Tokens |
|---|---|---|
| Week label ("This Week", "Next Week") | `.week-label` | `--text-secondary`, `--bg-body` |
| Day-of-week header (Mon–Sun) | `.week-header` + `.week-header-cell` | `--bg-panel-header`, `--text-secondary`, `--border` |
| Day cell | `.day-cell` | `--border` for cell separators |
| Today cell | `.day-cell.is-today` | `color-mix(in srgb, var(--color-primary) 6%, var(--bg-body))` — **uses brand accent intentionally** |
| Past cell | `.day-cell.is-past` | `opacity: 0.55` |
| Date number | `.day-cell-date` | `--text-primary` (default), `--color-primary` (today) |
| Month chip | `.day-cell-month` | `--text-secondary` |
| Weather hi/lo | `.day-weather-hi`, `.day-weather-lo` | `--text-primary`, `--text-muted` |

**States by day-cell modifier:**

| Class | Behavior |
|---|---|
| `.is-today` | Tinted background using `color-mix` against `--color-primary` at 6% in light, perceptibly higher contrast in dark |
| `.is-past` | Reduced opacity to de-emphasize but stay readable |

**Accessibility.** No keyboard interaction. Day numbers should ideally have `aria-label` with full date for screen readers — **currently unmarked, TODO**.

**Do / Don't.**

| ✅ Do | ❌ Don't |
|---|---|
| Use `color-mix` against tokens for tinted states | Stack semi-transparent overlays on `--bg-body` — `color-mix` plays better with palette swaps |
| Preserve the 7-column grid even when a week starts mid-month | Special-case month boundaries; the `.day-cell-month` chip handles transitions |

---

### 3.4 Event chip (all-day & timed)

**Selectors:** `.allday-event` ([styles.css:378-388](frontend/css/styles.css#L378)), `.timed-event` family ([styles.css:399-437](frontend/css/styles.css#L399))

**Description.** Two related forms for showing a calendar event inside a day cell.

- **All-day chip:** colored rectangle, white text, runs the cell width.
- **Timed event:** dot + start time on one row, title wrapping to a second row indented to align under the time.

| Variant | Use when |
|---|---|
| `.allday-event` | Event has no specific start time |
| `.timed-event` | Event has a start time |

**Color scheme.** Both forms encode source via the dot/background color. The actual color comes from a calendar's configured accent — typically `--color-primary` (Google), `--color-secondary` (iCloud), `--color-family` (shared), `--color-default` (fallback). The translucent fill uses `--event-bg-opacity` so light/dark modes can re-tune the visibility.

| Element | Tokens |
|---|---|
| All-day surface | Calendar color background, `#fff` text (intentionally hardcoded for chip readability over saturated brand colors) |
| Timed dot | Calendar color, `0.521vw` square, `border-radius: 50%` |
| Timed time | `--text-secondary`, `tabular-nums` |
| Timed title | `--text-primary` |

**Accessibility.** Color is a primary signal. Dot + time + title is also semantic, so colorblind users still parse the event. Do not rely on color alone for *new* event distinctions; pair with a glyph or text.

**Do / Don't.**

| ✅ Do | ❌ Don't |
|---|---|
| Reuse `--event-bg-opacity` for any future translucent overlay against `--bg-body` | Pick a hex for an event color; it must come from calendar settings via brand tokens |
| Keep the indented-title pattern (`padding-left: calc(0.521vw + 0.313vw)`) for any "label + body" layout in narrow cells | Wrap timed events to three lines; truncate or rely on the `.day-events-more` overflow |

---

### 3.5 Reminders panel

**Selectors:** `.reminders-panel` > `.panel-header` + `.reminders-list` > `.reminder-item` > [`.reminder-checkbox`, `.reminder-content`] > [`.reminder-title`, `.reminder-due`, `.reminder-list-label`, `.reminder-notes`] ([styles.css:191-535](frontend/css/styles.css#L191), [reminders-view.js](frontend/js/reminders-view.js))

**Description.** Right-side panel listing tasks/reminders aggregated from Apple Reminders and Google Tasks. Visual cues distinguish source (circular vs square checkbox), state (completed via opacity + strikethrough), and urgency (priority colors, overdue red).

| Variant | Use when |
|---|---|
| Apple Reminder | Default — circular checkbox with `--color-family` border |
| Google Task | `.reminder-checkbox.google-task` — square-ish (`0.208vw` radius) with `--color-primary` border |

| State | Selector | Visual |
|---|---|---|
| Default | `.reminder-item` | Full opacity |
| Completed | `.reminder-item.is-completed` | Opacity `0.45`, strikethrough title, checkbox filled with `--reminder-done` |
| Overdue | `.reminder-due.is-overdue` | Hardcoded `#ef4444` red — see audit §4.1 |
| High priority | `.priority-high` | Hardcoded `#ef4444` |
| Medium priority | `.priority-medium` | Hardcoded `#f59e0b` |

**Tokens used:**

| Element | Tokens |
|---|---|
| Item separator | `--border` |
| Title | `--text-primary` (inherited) |
| Due | `--text-secondary` (default), `#ef4444` (overdue — pending audit) |
| List label | `--text-muted` |
| Notes | `--text-secondary` |
| Done checkbox fill | `--reminder-done` |

**Accessibility.** Strikethrough alone is insufficient for completion. Pair with the opacity reduction (current implementation does this) and ideally `aria-checked="true"` on the checkbox (TODO).

**Do / Don't.**

| ✅ Do | ❌ Don't |
|---|---|
| Use the source-distinguishing checkbox shape pattern (circle vs square) for any future multi-source list | Rely on color alone to distinguish source — shape carries the signal too |
| Migrate priority colors to semantic tokens once §4.1 lands | Add new priority levels; the medium/high binary is intentional |

---

## 4. Audit Findings

The current system is consistent and theme-aware on the kiosk surface (`styles.css`). Two systematic gaps deserve attention before they entrench.

### 4.1 Missing semantic-color tokens

Six hardcoded hex values across `styles.css` form an implicit success/warning/error palette:

| Hex | Usage | File reference |
|---|---|---|
| `#0f9d58` | Healthy sync icon | [styles.css:140](frontend/css/styles.css#L140) |
| `#fff3cd` / `#92400e` | Sync error pill (light) | [styles.css:149-150](frontend/css/styles.css#L149) |
| `#d97706` | Sync error icon (light) | [styles.css:158](frontend/css/styles.css#L158) |
| `#fbbf24` | Sync error (dark) | [styles.css:167, 171](frontend/css/styles.css#L167) |
| `#ef4444` | Overdue, high priority | [styles.css:510, 558](frontend/css/styles.css#L510) |
| `#f59e0b` | Medium priority | [styles.css:562](frontend/css/styles.css#L562) |

**Recommendation.** Promote to a six-token semantic palette under `:root[data-theme="*"]`:

```css
--color-success-fg
--color-warning-fg
--color-warning-bg
--color-error-fg
--color-priority-high
--color-priority-medium
```

Color themes can then opt to override these (e.g. `kitchen-paper` may want softer error tones to match its aesthetic). **Do not migrate now** — that's a follow-up changeset. Calling it out here so new components don't add a seventh hardcoded warning color.

### 4.2 Admin surface drift

[admin.css](frontend/css/admin.css) is the second-largest stylesheet (1077 lines) and exhibits two systemic gaps:

- **Zero `data-theme` selectors** — the admin UI has only one palette (light). On a dark kiosk theme, the admin surface jarringly inverts. Confirmed: `grep "data-theme" frontend/css/admin.css` returns nothing.
- **15+ hardcoded grays** — `#f3f4f6`, `#e9ebf0`, `#c0c7d0`, `#d1d5db`, `#fecaca`, `#fef2f2`, `#fff` etc. duplicate concepts already in the neutral palette (`--bg-panel-header`, `--border`, `--bg-card`).

The file does use `var(--...)` 99 times, so it's partially tokenized — the gap is largely in form controls, modals, and the danger-zone styling.

**Recommendation.** Treat the admin surface as a separate downstream consumer of the kiosk token system. The fix is incremental, not wholesale: each time a control is touched in admin.css, replace its hardcoded grays with the kiosk equivalent and add a `:root[data-theme="dark"]` override pair. This is documentation, not a mandate to refactor — but it captures the asymmetry so it doesn't surprise future contributors.

### 4.3 Accessibility gaps (low-priority for kiosk)

The kiosk is non-interactive, so most a11y concerns are downgraded — but two should still ship:

- `role="status"` + `aria-live="polite"` on `.sync-status` so screen-reader-equipped accessibility tools surface sync failures.
- `aria-label` on day-cell numbers carrying full ISO date for any future audio-tour or screen-share scenario.

---

## 5. New Component: AirPlay Audio Widget

This component does not exist yet. It is designed here under the constraints documented above so its implementation can proceed without re-deriving conventions.

### 5.1 Problem

UxPlay 1.73.6 runs on the Pi and writes two files to tmpfs whenever AirPlay audio is active:

- `/tmp/uxplay-cover.jpg` — current track cover art (overwritten per track)
- `/tmp/uxplay-meta.txt` — artist/title text

When a household member casts audio to the Pi (Spotify, Apple Music, podcasts), the calendar display should surface a now-playing card so anyone glancing at the wall can see what's playing. The card must:

- **Appear automatically** when audio starts; **disappear automatically** when it stops.
- **Not disrupt** the calendar grid or reminders panel — overlay, not reflow.
- **Cede the screen** when AirPlay *video* is active (UxPlay opens its own full-screen window in that case; the widget is moot).

### 5.2 Existing patterns considered

| Pattern | What it shares | Why it doesn't fit alone |
|---|---|---|
| `.sync-status.is-error` (§3.2) | Small overlay-style indicator that appears conditionally | Inline in header, not a free-floating overlay; no media content |
| `.allday-event` (§3.4) | Card-like surface with text | Lives inside the grid, not over it |
| `.panel-header` (§3.5) | Reusable card surface idiom | No image content, no transitions |

The widget composes the surface idiom of the reminders panel header with the conditional-visibility pattern of the sync indicator.

### 5.3 Visual contract

**Position.** Bottom-right corner of the viewport. Offset from edges by `1.042vw` (matches header padding).

**Size.** Width `~22vw` (about 422px on the reference 1920×1080). Height auto from content.

**Layout.** Two-column flex: square cover art (`~5.5vw × 5.5vw`) on the left, text stack on the right (title on top in `--text-primary`, artist below in `--text-secondary`). Vertical padding `0.741vh`, horizontal `1.042vw`.

```
┌───────────────────────────────────────────┐
│  ┌──────┐  Track Title                    │
│  │ cover│  Artist Name                    │
│  └──────┘                                  │
└───────────────────────────────────────────┘
```

**Surface.** Card on `--bg-card` with 1px `--border` and a soft `--shadow` for elevation. Rounded corners `0.208vw` (matches event chip radius).

### 5.4 Tokens used

| Purpose | Token |
|---|---|
| Surface | `--bg-card` |
| Border | `--border` |
| Elevation | `--shadow` |
| Title | `--text-primary` |
| Artist | `--text-secondary` |
| Title font-size | `1.146vw` (matches `.reminder-title`) |
| Artist font-size | `0.938vw` (matches `.reminder-due`) |
| Padding | `0.741vh 1.042vw` (matches `.reminders-meta`) |
| Border radius | `0.208vw` |

**No new tokens are introduced.** This is the key check — if the implementer finds themselves wanting a new value, the answer is to match an existing component (per §2.5–2.7 conventions) or to flag a missing token in this doc.

### 5.5 States

| State | Behavior | Animation |
|---|---|---|
| `hidden` (default) | `display: none` or `opacity: 0; pointer-events: none` | — |
| `entering` | Becomes visible on first `playing=true` poll | Fade-in + slight rise (12px → 0) over 200ms ease-out |
| `playing` | Steady-state visible | Cover/text crossfade (200ms) when track changes |
| `exiting` | Fades out when `playing` flips to `false` | Fade-out + slight drop over 200ms ease-in |

There is no hover, focus, or click state — kiosk is non-interactive. There is no error state at the visual level: if cover art fails to load, fall back to a tokenized placeholder block (`--bg-panel-header` solid square). If meta is empty, omit the text rows but keep the cover.

### 5.6 Data source contract

The widget polls a server endpoint, **not** the tmpfs files directly (browser can't read `/tmp` without help). Add a Fastify route:

```
GET /api/airplay/now-playing
→ { playing: boolean, title?: string, artist?: string, coverUrl?: string, mtime?: number }
```

**Liveness rule.** `playing` is `true` iff `/tmp/uxplay-meta.txt` was modified within the last `N` seconds (suggested: 10). Polling cadence on the client: 2 seconds when hidden (cheap), 5 seconds when playing (sufficient for crossfades).

`coverUrl` should resolve to a separate route that streams the JPEG with cache-busting based on mtime, e.g. `/api/airplay/cover?v={mtime}`.

The implementation of the route is out of scope for this design doc; what's specified here is the **visual contract** the route enables.

### 5.7 Accessibility

- `role="status"` on the widget root — non-interactive informational live region.
- `aria-live="polite"` so a screen reader announces track changes once without preempting other speech.
- Cover image: `<img alt="Album art for {title}">`, or `alt=""` if no metadata to avoid noise.
- No keyboard interaction; widget is not focusable.

### 5.8 Theming behavior

The widget inherits all neutral tokens, so palette swaps (default → nord → ocean → kitchen-paper) recolor it automatically. **Verify** at implementation time by switching every named theme via `/admin` → Display and confirming no values look broken — no re-spec'ing needed; if it breaks, the broken token is the bug.

### 5.9 Open questions

1. **AirPlay video coexistence.** Per [global CLAUDE.md](.claude/CLAUDE.md), UxPlay opens a full-screen window over the calendar when video casts. The widget should hide automatically in that case — but how do we *detect* it? Possibilities: detect via window-list X11 query, or treat any rapid mtime churn on `/tmp/uxplay-cover.jpg` as a "video might be coming" signal. **Decision needed before implementation.**
2. **Crossfade vs hard cut on track change.** Crossfade (200ms image-swap) is more polished but more complex. Hard cut is trivial. Recommend hard cut for v1; promote to crossfade if the simple version feels jarring on the wall display.
3. **Cover-art fallback shape.** When art is missing, render a tokenized placeholder. Should it carry a glyph (♪) or stay blank? Recommend blank for v1 — less visual noise from across the room.

### 5.10 Do / Don't (forward-looking)

| ✅ Do | ❌ Don't |
|---|---|
| Reuse this contract for any future "transient overlay" (e.g., doorbell event, weather alert) | Repurpose the widget's exact position for unrelated content; bottom-right is now "audio surface" |
| Keep the widget under `~22vw` so the calendar grid below remains the primary signal | Make the widget interactive to "skip track" or similar — admin-style controls belong in `/admin`, not on the wall |

---

## 6. Glossary & Conventions

- **Kiosk surface** — `index.html` + `styles.css`. The wall display.
- **Admin surface** — `admin.html` + `admin.css`. The configuration UI. Documented separately (TODO).
- **Brand token** — a token representing identity (calendar source). Themes do not override.
- **Neutral token** — a token representing layout/structure. Themes override.
- **Reference resolution** — 1920×1080. All `vw`/`vh` values implicitly anchored here.

---

*Last updated when this document was created. See [git log](https://github.com/) for revision history.*
