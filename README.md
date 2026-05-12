# Bot Arena

A public demo site at [jhero.app](https://jhero.app) that showcases five layered anti-bot detections firing in real time as browser automation interacts with the page. Built as a sales-demo asset for the AIVA automation product.

## What it demonstrates

The site has five level pages, each exercising a different detection technique:

1. **Webdriver tells** — `navigator.webdriver`, missing `chrome.runtime`, headless UA hints.
2. **CDP attached** — Function/`Error.stack` integrity, driver-shim artefacts.
3. **Mouse trajectory** — `mousemove` density and curvature, keystroke cadence.
4. **Fingerprint battery** — canvas, audio, font, and WebGL signals.
5. **Cloudflare Turnstile** — managed-mode widget + server-side verification.

On every page a **Detection Log panel** reports each signal as it fires, color-coded. A "Reset demo" button re-arms the detections so the demo can be run repeatedly.

The site is **target-only** — it does not run any automation itself. During a sales call the presenter points two browser sessions at the same level page (one driven by Playwright/CDP, one driven by VNC over a real headed Chrome) and the audience watches the Detection Log diverge.

## Stack

- Astro 5 (static-first MPA, one Preact island for the Detection Log)
- Tailwind CSS v4
- TypeScript
- Cloudflare Pages + one Pages Function for Turnstile token verification
- Vitest + happy-dom for unit tests

## Development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build
npm test
```

## Design

See [`docs/superpowers/specs/2026-05-12-bot-arena-design.md`](docs/superpowers/specs/2026-05-12-bot-arena-design.md) for the full design.
