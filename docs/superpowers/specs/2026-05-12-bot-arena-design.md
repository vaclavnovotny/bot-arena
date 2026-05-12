# Bot Arena — anti-bot demo — Design

**Status:** Design approved
**Date:** 2026-05-12
**Author:** vaclav.novotny@ysoft.com (with Claude)
**Companion to:** the `agentic-aiva` project (private internal repo at Y Soft)

## 1. Summary

A small public web app whose only job is to be a **realistic target for browser automation**, with five layered anti-bot detections that visibly fire as automation interacts with the page. Used in **sales conversations** to demonstrate that **agentic-aiva (Playwright + CDP)** gets caught where the **classic AIVA (Linux Chrome + VNC clicks)** sails through.

The demo experience is **target-only**: the app does not orchestrate or run the automation tools. During a sales call, the presenter manually points both tools at the same level page and the audience watches the on-page **Detection Log** light up red/green in real time.

Hosted at `jhero.app` (Cloudflare-registered, already owned). Deployed via **Cloudflare Pages**, built with **Astro** (static-first MPA, minimal JS overhead, one page per level). Lives in a **public** GitHub repo under the `vaclavnovotny` account — separate from the private enterprise `agentic-aiva` repo.

## 2. Goals & non-goals

### Goals
- Showcase **five increasing levels** of bot detection on five separate pages.
- Each page has a realistic interaction target (a login-style form, a "Continue" button) the automation needs to click.
- Each page has a **Detection Log** panel that reports, in real time, every signal the page captured — passed signals in green, failed signals in red.
- Each page is **self-resetting** (a "Reset demo" button re-arms the detections so the demo can be re-run).
- Levels 1–4 are pure client-side detection (no backend needed). Level 5 (Cloudflare Turnstile) requires server-side token verification — handled by a single Pages Function.

### Non-goals
- **No automation orchestration.** No "Run with Playwright" buttons, no server-side automation runners. The presenter runs the tools themselves.
- **No persistence of telemetry.** Each page run is ephemeral; the Detection Log lives in browser memory and resets on reload.
- **No user accounts, no real auth.** The "login" forms are decoration — submitting them just toggles a success/failure state.
- **No analytics / tracking / cookies** beyond what Turnstile requires.
- **No mobile design** — the demo is desktop only, evaluated at 1280×800+.
- **No CI / e2e tests** for the demo app itself in v1. (We can add them later if useful.)

## 3. Hosting and repo layout

### Repo
- **Public GitHub repo** under user `vaclavnovotny`. Name: `bot-arena`.
- Lives locally at `C:\Users\ganz\github\bot-arena` (sibling of the private `agentic-aiva` repo, not nested inside it).
- Created via `gh repo create vaclavnovotny/bot-arena --public` (CLI already configured for that account).
- This spec lives in `bot-arena/docs/superpowers/specs/` so the design history travels with the code.

### Hosting
- **Cloudflare Pages** project connected to this repo.
- Custom domain: `jhero.app` (already on Cloudflare DNS). Apex + `www`.
- Auto-deploy on push to `main`.
- Pages Functions (Cloudflare Workers runtime) used **only** for Level 5's `/api/turnstile/verify` endpoint.
- Cloudflare Turnstile site key + secret stored as Pages environment variables.

## 4. App shape

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing page. Short pitch, list of the 5 levels with one-line descriptions, "Start at Level 1" CTA. |
| `/level/1` … `/level/5` | One page per detection level. |
| `/about` | One-pager explaining the demo's purpose, what each signal means, and how to interpret the log. Linked from the footer. |

Each level page contains:
- **Header**: level number, name, one-sentence description of what's being tested.
- **Target interaction**: a plausible-looking login form (email + password + "Sign in") or a "Continue" button. The target is what the automation needs to click; on success the page shows a "✓ Access granted" state.
- **Detection Log panel** (right side, ~360 px wide, sticky): live-updating list of signals as they fire. Each entry shows timestamp + signal name + `PASS` (green) / `FAIL` (red) + short tooltip explaining what was checked.
- **"What's measured" info button**: opens a small popover with plain-language explanation of the detections on this page.
- **"Reset demo" button**: clears the log, re-arms all detections, returns the form to its pre-submit state.
- **Footer nav**: previous / next level.

### Visual style
- Clean, neutral "professional SaaS" look. Tailwind for styling. No dark mode in v1.
- The detection log is the visual centerpiece — it should be high-contrast, monospace, and immediately legible from across a meeting room.

## 5. The five detection levels

Each level targets a different signal class. Ordered by increasing difficulty for automation to bypass. VNC AIVA (real headed Chrome, real OS-level mouse events) is expected to pass every level by virtue of being a real browser; Playwright/CDP-driven agentic-aiva is expected to fail at least levels 1, 2, 3 reliably, and to be uncertain on 4 and 5.

### Level 1 — "The honest tell"
**What it checks (client-side):**
- `navigator.webdriver` (must be `false`/`undefined`)
- Presence of `window.chrome.runtime` (real Chrome has it; some automation contexts strip it)
- `navigator.plugins.length` > 0 (headless Chromes often have 0)
- `navigator.languages` non-empty
- User-Agent does not contain `HeadlessChrome`
- `Notification.permission` not `denied` while `navigator.permissions.query({name:'notifications'}).state` says `granted` (the classic Selenium/Playwright inconsistency)

**Why VNC passes:** real headed Chrome — none of these are tripped.

### Level 2 — "CDP attached"
**What it checks (client-side):**
- `Error.stack` length / formatting trick — accessing `(new Error()).stack` on a `get` of a special property triggers debugger; if DevTools/CDP is attached, the call takes measurably longer.
- `Function.prototype.toString` integrity check — if Playwright/Puppeteer have monkey-patched `toString` on built-ins to hide themselves, the toString of `toString` itself leaks.
- `console.debug` hijack heuristic (Chromium-specific: when DevTools is open or CDP is attached, certain `console.debug` calls with a getter argument behave differently).
- Existence of `window.cdc_*` and other known driver artefacts (legacy Selenium, but cheap to check).

**Why VNC passes:** no CDP attached; no driver shim.

### Level 3 — "Mouse trajectory"
**What it checks (client-side):**
- The page records every `mousemove` event from page load until the target button is clicked.
- On click, it scores the trajectory: number of intermediate points, total distance, curvature, dwell time. Zero intermediate points or a single straight-line segment with zero curvature → `FAIL`.
- Also records keystroke cadence on form inputs: simultaneous keydowns or identical inter-key intervals → suspicious.

**Why VNC passes:** the operator moves a real mouse across the VNC session; the trajectory looks human. Playwright's `dispatchMouseEvent` via CDP jumps straight to coords with no intermediate moves.

### Level 4 — "Fingerprint battery"
**What it checks (client-side):**
- **Canvas fingerprint**: render a known string with a specific font and emoji to a canvas, hash the pixel data, compare against a small denylist of hashes known to come from headless/automated Chromes (we collect a couple by running Playwright against ourselves once during dev).
- **AudioContext fingerprint**: oscillator-into-analyser hash, same denylist approach.
- **Font enumeration**: probe for a couple of fonts that ship with a real desktop Chrome install but not with headless/CI runners (`Arial Black`, `Comic Sans MS`, `Segoe UI Emoji` on Windows, `Noto Color Emoji` on Linux). Mismatched font set for the claimed UA → `FAIL`.
- **WebGL renderer string**: extract `UNMASKED_RENDERER_WEBGL`; flag `SwiftShader` / `Mesa OffScreen` (software rasteriser → headless).

**Why VNC passes:** the Linux Chrome behind VNC has a real (software or hardware) GPU stack, real fonts, and produces consistent fingerprints — not on our denylist.

### Level 5 — "Cloudflare Turnstile"
**What it checks:**
- Embeds the `cf-turnstile` widget in **managed** mode (it will show an interactive checkbox if it's suspicious of you, invisible otherwise).
- On form submit, the page POSTs the Turnstile token to `/api/turnstile/verify` (a Pages Function), which calls Cloudflare's `siteverify` endpoint with the secret and returns pass/fail.
- The Detection Log shows: `[INFO] Turnstile widget mode: managed/interactive`, then `[PASS]` or `[FAIL] Turnstile verification`.

**Why VNC passes (typically):** Turnstile uses behavioural and fingerprint signals very similar to levels 3 and 4 plus its own private checks. Real-user-shaped traffic from a real Chrome usually passes silently; CDP-driven automation often gets the interactive variant and fails the challenge.

## 6. Detection Log panel

A single component reused on every level page.

### Behaviour
- Mounted on page load. Subscribes to a per-page event bus.
- Each detection check (sync or async) emits an event: `{ id, name, status: 'pass' | 'fail' | 'info', detail, ts }`.
- Renders as an append-only list (newest at bottom, auto-scroll), with a fixed-height frame.
- Each entry: `[HH:MM:SS.mmm] [PASS|FAIL|INFO] <signal name>` with the `detail` available on hover.
- Top of the panel: an aggregate "verdict" pill — `Bot suspected: X signals`, `Looks human: all signals passed`. The pill updates live.

### Reset
- "Reset demo" clears the event log and re-runs the initial detections (the passive ones like `navigator.webdriver` will fire again immediately; behavioural ones like mouse trajectory rearm and wait for the next click).

### Implementation note
Pure client-side state — no SSE, no WebSocket. A small `EventTarget` per page is plenty; no global state library needed.

## 7. Stack and packages

- **Astro 5+** — MPA, file-based routes, partial hydration only where needed (Detection Log panel uses Preact island; everything else is static).
- **TypeScript** throughout.
- **Tailwind v4** — same major as agentic-aiva, easy to copy patterns.
- **Preact** (Astro's lightest island option) for the Detection Log.
- **Cloudflare Pages** — adapter `@astrojs/cloudflare` for the single Pages Function.
- **`@marsidev/react-turnstile`** equivalent for Preact (or hand-rolled — Turnstile's widget is dead simple, no SDK strictly needed).
- **No state library, no UI library beyond Tailwind.** The app is small enough that those would be overkill.

## 8. Repository structure

```
bot-arena/
├─ README.md                       # design summary + link to this spec
├─ astro.config.mjs
├─ tailwind.config.ts
├─ package.json
├─ docs/
│  └─ superpowers/
│     ├─ specs/                    # this spec lives here
│     └─ plans/                    # implementation plan (next step)
├─ src/
│  ├─ pages/
│  │  ├─ index.astro               # landing
│  │  ├─ about.astro
│  │  ├─ level/
│  │  │  ├─ 1.astro … 5.astro
│  │  └─ api/turnstile/
│  │     └─ verify.ts              # Astro server endpoint (runs on Cloudflare Workers)
│  ├─ components/
│  │  ├─ DetectionLog.tsx          # Preact island
│  │  ├─ LoginForm.astro
│  │  ├─ LevelLayout.astro
│  │  └─ ...
│  └─ detections/
│     ├─ level1.ts                 # one module per level's checks
│     ├─ level2.ts
│     ├─ level3.ts
│     ├─ level4.ts
│     └─ level5.ts
└─ .github/workflows/              # (optional, Pages auto-deploys from push)
```

## 9. Out of scope (deferred or rejected)

- Mobile / responsive layout.
- Dark mode.
- Real user accounts, real auth, real backend beyond the Turnstile endpoint.
- Persisting Detection Log across reloads or sharing it (e.g., "send me the log").
- A/B running automation tools from the app itself.
- Additional anti-bot vendors (Akamai Bot Manager, Radware Bot Defender, DataDome, PerimeterX): real integration requires enterprise contracts and a more involved proxy setup. Out of scope for v1; can be added later as new levels if needed.
- CI / e2e test suite for the demo.
- i18n.

## 10. Open questions

None at design time. Implementation may surface choices (exact Astro version, exact font list for Level 4 denylist, specific Turnstile mode flags) that the implementation plan will resolve.
