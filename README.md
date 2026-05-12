# Bot Arena

A public demo site at [bot-arena.jhero.app](https://bot-arena.jhero.app) that showcases where stock browser automation (Playwright, Puppeteer, Selenium) gets caught — or cannot even attempt the task. Built as a sales-demo asset for the AIVA automation product.

## What it demonstrates

**13 levels, two sections.** Each level is a working "Sign in" target. Every level is built so that a plain Playwright test (`getByLabel('Email').fill(...)`, `click('Sign in')`, `expect('Access granted')`) fails — for a different, named reason.

### Section 1 — Bot detection (5 levels)

The site detects automation through fingerprinting, behavioural signals, or third-party challenge.

1. **The honest tell** — `navigator.webdriver`, `navigator.plugins`, headless UA hints.
2. **CDP attached** — `window.chrome` surface, browser-chrome height, screen taskbar, driver-shim artefacts, toString integrity.
3. **Mouse trajectory** — `mousemove` density and curvature, keystroke cadence.
4. **Fingerprint battery** — canvas, audio, WebGL renderer, font set.
5. **Cloudflare Turnstile** — real managed-mode widget + server-side verification.

A **Detection Log** panel on every page reports each signal in real time, colour-coded. Reset button re-arms the detections.

### Section 2 — Selector resistance (8 levels)

The DOM that selector-based automation depends on is absent, randomised, sealed, in a different frame, or unreachable without vision.

1. **Canvas-rendered login** — no DOM form; only pixels on a `<canvas>`. Real-world: Figma, Google Sheets, Photoshop Web, web games.
2. **Dynamic selectors** — real form, but every `id`/`name`/`class` rerolls per request. Real-world: CSS-in-JS frameworks, anti-bot WAFs, ticketing sites.
3. **Closed Shadow DOM** — form inside a custom element with `attachShadow({ mode: 'closed' })`. Real-world: Salesforce LWC, ServiceNow, SAP UI5.
4. **Iframe-embedded form (same-origin)** — page-scoped locators don't traverse into frames.
5. **Slider verification** — drag-to-align CAPTCHA whose target position is only visible in pixels. Real-world: GeeTest, Alibaba, AWS WAF Bot Control, Ticketmaster.
6. **Image-only labels** — every visible label rendered as an SVG image with empty alt. Real-world: bank PIN keypads, legacy brokerage portals, anti-scrape pricing.
7. **Cross-origin iframe** — form on a `data:` URI; browser security blocks all DOM access from the parent. Real-world: Stripe Elements, Auth0 Universal Login, Turnstile widget.
8. **Virtual scrolling** — 1,000-row account list with windowed rendering; off-screen items are not in the DOM. Real-world: AG Grid, TanStack Virtual, Slack history, Gmail, Notion databases.

The site is **target-only** — it does not run any automation itself. During a sales call the presenter points two browser sessions at the same level page (one driven by Playwright/CDP, one driven by AIVA over VNC + image recognition) and the audience watches the difference: detection logs diverge in Section 1, selectors find nothing in Section 2.

## The failure report

A static dashboard at [`/report/`](https://bot-arena.jhero.app/report/) breaks down each level's failure mode with:

- The exact Playwright code that runs (one shared shape per test)
- The error message Playwright surfaces when it fails
- A plain-English explanation of why selector-based automation fails here
- A **"Playwright context"** block — what it would take to fix the test inside Playwright, and the verdict (mostly: impossible, or maintenance nightmare)
- An **"AIVA context"** block — whether AIVA currently passes natively, or what specific configuration / code change would close the gap (with a 1–5 complexity meter)

## Stack

- **Astro 5** — static-first MPA, one Preact island for the Detection Log
- **Tailwind CSS v4** — Vite plugin, zero config
- **TypeScript** strict mode
- **Cloudflare Pages** + one Pages Function (`src/pages/api/turnstile/verify.ts`) for Turnstile token verification
- **Vitest + happy-dom** for unit tests (37 unit tests)
- **Playwright Test** for the end-to-end "every test fails" suite (13 tests)

## Routes

```
/                                       Landing page
/about                                  Plain-English explanation
/report                                 Failure dashboard with TOC
/bot-detection/level-{1..5}             Bot-detection level pages
/selector-resistance/level-{1..8}       Selector-resistance level pages
/api/turnstile/verify                   SSR endpoint (Pages Function) for L5
```

## Development

```bash
npm install
npm run dev         # http://localhost:4321
npm run build       # static build to dist/, plus a Cloudflare worker for the SSR endpoint
npm run check       # astro check (typecheck)
npm test            # vitest run (unit tests)

npx playwright test                 # run the e2e suite against bot-arena.jhero.app
npx playwright test --reporter=html # then `npx playwright show-report` for traces
```

The Playwright suite is intentionally a "negative" test suite: every test fails by design when run against this site. A test passing means a detection or selector-resistance technique stopped working.

## Environment variables

For local Level 5 (Turnstile) testing, copy `.env.example` to `.env`:

```bash
PUBLIC_TURNSTILE_SITE_KEY=...   # public site key
TURNSTILE_SECRET_KEY=...        # encrypted server-side secret
```

The repo's `.env.example` ships the always-passes test pair so the level works locally without a real Cloudflare account.

## Design

See [`docs/superpowers/specs/2026-05-12-bot-arena-design.md`](docs/superpowers/specs/2026-05-12-bot-arena-design.md) for the original design spec, and [`docs/superpowers/plans/2026-05-12-bot-arena-implementation.md`](docs/superpowers/plans/2026-05-12-bot-arena-implementation.md) for the implementation plan.
