# Comparison page — Playwright vs AIVA — Design

**Status:** Awaiting user review
**Date:** 2026-05-13
**Author:** vaclav.novotny@ysoft.com (with Claude)
**Companion to:** `2026-05-12-bot-arena-design.md`

## 1. Summary

A new static page at `/comparison` that surfaces, in a single grouped table, where stock Playwright runs out of road and what agentic-AIVA does in the same spot. Rows are derived from the 13 arena levels and use the same `aiva.passes` / `fixes[].difficulty` data the existing `/report` page already publishes — no new claims are made about AIVA. The page is an executive summary that sits alongside `/report` (per-level deep dive) and `/other-usecases` (production-app case studies).

## 2. Goals & non-goals

### Goals
- One scannable table that lets a reader see, per real-world surface: Playwright's verdict (Possible / Impossible + 1–5 effort meter) and agentic-AIVA's verdict (Native / Needs fix + 1–5 fix-effort meter).
- Group rows by failure family so the page reads as a taxonomy, not a flat list.
- Honest values throughout: every AIVA cell traces back to the `levels: LevelReport[]` data in `/report`.
- Each row links back to the arena level that demoes it.
- Click-to-expand row reveals a 2–3 sentence explanation of the failure mode and AIVA's response.

### Non-goals (v1)
- **No new AIVA claims.** Every AIVA verdict / effort number is copied from `/report`. If `/report` doesn't say AIVA passes, neither does this page.
- **No coverage beyond the arena.** Every row maps to ≥1 existing arena level. Rows like "WebAuthn / passkey" or "GraphQL XHR-only login" are out of scope for v1.
- **No filter chips, no sort toggle.** The grouping is the navigation. With 13 rows, interactivity is unnecessary; revisit if the table grows past ~25 rows.
- **No new framework code.** Plain Astro + ~25 lines of inline vanilla JS for row expand. No Preact island, no Pages Function, no env vars.
- **No comparison against visual / classic AIVA** (VNC + image recognition). The arena does not currently publish data for that variant; representing it would mean authoring new claims. Out of scope for v1, possible future expansion.

## 3. Page contract

### Route
- `/comparison` (singular, matches `/about`, `/report`, `/other-usecases`).

### Nav placement
- Header nav order, applied to every page that has a nav: **Comparison · Failure report · Other use-cases · About · GitHub**.
- Landing page (`/`) gets a new CTA card alongside the existing two: *"See the Playwright vs AIVA comparison →"*.

### Page structure (top to bottom)
1. **Shared header** (existing nav, with the new "Comparison" link added).
2. **Hero**:
   - H1: *"Playwright vs AIVA — where each one breaks"*
   - One-sentence pitch: *"13 real-world surfaces from the arena, side-by-side. Pulled directly from <code>/report</code>'s data, grouped by failure family, ordered by severity."*
   - Verdict legend: small inline guide explaining the 4 pill values (Possible / Impossible / Native / Needs fix) + the 1–5 effort meter.
3. **Table** — see §4.
4. **Footer block**:
   - Heading: *"How to read this"*
   - 2–3 sentences explaining the verdict scheme, the fact that AIVA values come from `/report`, and what "Needs fix" effort means (i.e. the lowest-difficulty fix in `fixes[]`).
   - Inline link: *"For per-level Playwright code, errors, and AIVA fix narrative, see the full failure report →"* → `/report`.
5. **Site footer** (shared).

## 4. Table

### Shape
- Single table.
- 4 columns: **Surface**, **Playwright**, **AIVA (agentic, /report)**, **Demo**.
- Rows grouped under a family section header (full-width row with the family pill, surface count, and a one-line blurb).

### Families and order
Family ordering is by worst-cell severity (combined Playwright effort + AIVA fix effort across the family's rows), descending:

| # | Family | Member levels | Worst cell |
|---|---|---|---|
| 1 | Vendor challenge | BD-5, SR-5 | BD-5 (PW Impossible ★5 + AIVA Needs fix ★4) |
| 2 | Cross-origin / sealed | SR-7, SR-3, SR-4 | SR-7 (PW Impossible ★5 + AIVA Needs fix ★1) |
| 3 | Fingerprinting | BD-4, BD-2, BD-1 | BD-4 (PW Impossible ★4 + AIVA Native) |
| 4 | Vision-only | SR-1, SR-6 | SR-1 (PW Impossible ★5 + AIVA Native) |
| 5 | Windowed DOM | SR-8 | SR-8 (PW Possible ★4 + AIVA Native) |
| 6 | Dynamic selectors | SR-2 | SR-2 (PW Possible ★4 + AIVA Native) |
| 7 | Behavioural | BD-3 | BD-3 (PW Possible ★3 + AIVA Native) |

Within each family, rows are sorted by combined severity (PW effort + AIVA fix effort) descending. Ties broken by AIVA effort descending (so rows where AIVA also struggles surface above rows where it passes natively).

### Family blurbs (one line each, shown in the section header)
- **Vendor challenge** — third-party challenges with server-side verification; the hardest cells on the page.
- **Cross-origin / sealed** — surfaces the browser refuses to let scripts reach into.
- **Fingerprinting** — browser identity and driver-shim tells; the baseline of every commercial bot screen.
- **Vision-only** — labels and form fields rendered as pixels, not text; no DOM to query.
- **Windowed DOM** — virtualised lists; off-screen rows are absent from the DOM.
- **Dynamic selectors** — `id` / `name` / `class` rerolls per request.
- **Behavioural** — mouse trajectory, keystroke cadence, dwell timing.

### Pill scheme
- **Playwright** verdict pills: **Impossible** (red) or **Possible** (orange). Effort meter: ●●●●○ (Tailwind-coloured monospace dots, 1–5).
- **AIVA** verdict pills: **Native** (green) or **Needs fix** (blue). Effort meter on the same 1–5 scale; for **Native** rows, render as ●○○○○ (single filled dot, signifying "trivial / no work").
- Family pill colour per family (closed enum).

### Row content
- **Surface** cell: bold title + one-line examples (real-world apps).
- **Playwright** cell: verdict pill + effort meter.
- **AIVA** cell: verdict pill + effort meter.
- **Demo** cell: short level tag (e.g. `BD-5`, `SR-7`), linking to `/{section}/level-{n}/`.
- Collapsed by default. Click anywhere on the row to expand a hidden description block (2–3 sentences) that explains the failure mode and AIVA's response in plain English. Re-click to collapse. The demo-link `<a>` inside the row uses `event.stopPropagation()` so navigating to the level does not also toggle the row.

## 5. Data model

### `src/data/surfaces.ts`

```ts
export type Family =
  | 'cross-origin'
  | 'vendor-challenge'
  | 'fingerprinting'
  | 'behavioural'
  | 'vision-only'
  | 'dynamic-selectors'
  | 'windowed-dom';

export type LevelRef = { section: 'bd' | 'sr'; n: number };

export interface Surface {
  id: string;                          // kebab-case stable slug
  title: string;                       // bold row title
  family: Family;
  examples: string;                    // one-line real-world apps
  levels: LevelRef[];                  // arena levels that reproduce this (≥1)
  expanded: string;                    // HTML, 2–3 sentences for the expand block
  playwright: {
    verdict: 'impossible' | 'possible';
    effort: 1 | 2 | 3 | 4 | 5;
  };
  aiva: {
    verdict: 'native' | 'needs-fix';
    effort: 1 | 2 | 3 | 4 | 5;         // 1 when verdict='native'
  };
}

export const surfaces: Surface[];      // 13 entries, ordered by family then severity
```

### Source of truth for the AIVA values

The `Surface` values for `playwright.verdict`, `playwright.effort`, `aiva.verdict`, and `aiva.effort` are **derived at build time from `/report`'s level data, not authored independently**. To avoid drift, we extract `/report`'s level array out of `src/pages/report.astro` into a new `src/data/levels.ts` module first (see §6); both `report.astro` and `surfaces.ts` then import from it.

`surfaces.ts` exposes an authored array of surface descriptors (id, title, family, examples, levels, expanded copy) and a small inline helper `deriveVerdicts(level: LevelReport)` that returns the playwright/aiva fields:

```ts
// Inside surfaces.ts, used to build each Surface from its LevelRef:
function deriveVerdicts(level: LevelReport): Pick<Surface, 'playwright' | 'aiva'> {
  return {
    playwright: {
      verdict: level.playwright.kind === 'impossible' ? 'impossible' : 'possible',
      effort: (level.playwright.difficulty ?? 5) as 1|2|3|4|5,
    },
    aiva: level.aiva.passes
      ? { verdict: 'native', effort: 1 }
      : { verdict: 'needs-fix', effort: Math.min(...level.aiva.fixes!.map(f => f.difficulty)) as 1|2|3|4|5 },
  };
}
```

Notes on the helper:
- `level.playwright.difficulty` is omitted from `report.astro` for some `kind: 'impossible'` rows; the default of 5 represents "fully impossible".
- `level.aiva.fixes` is non-empty whenever `passes` is false (verified across all 13 current entries); the non-null assertion is safe today and would be caught by the §7 Vitest if it ever became unsafe.

For multi-level surfaces, the author would aggregate inline rather than via the helper. **In v1 every surface has exactly one level**, so aggregation logic is unnecessary; the data model permits it for future expansion.

### Initial 13 surfaces

Listed below in render order (family then severity). Values pulled from `report.astro` as of this spec's date.

| Family | Surface title | Examples (one-liner) | Level | PW | AIVA |
|---|---|---|---|---|---|
| Vendor challenge | Cloudflare Turnstile (managed mode) | Cloudflare-fronted sign-ins, hCaptcha managed, Arkose Labs | BD-5 | Impossible ★5 | Needs fix ★4 |
| Vendor challenge | Slider / drag CAPTCHA | GeeTest, AWS WAF Bot Control, Ticketmaster, Alibaba | SR-5 | Impossible ★5 | Needs fix ★3 |
| Cross-origin / sealed | Cross-origin iframe (Stripe / Auth0 / Turnstile widget) | Stripe Elements, Auth0 Universal Login, sandboxed payment & SSO | SR-7 | Impossible ★5 | Needs fix ★1 |
| Cross-origin / sealed | Closed Shadow DOM (Salesforce LWC / SAP UI5 / ServiceNow) | enterprise apps built on sealed web components | SR-3 | Impossible ★5 | Native |
| Cross-origin / sealed | Same-origin embedded widget | older same-origin payment & SSO iframes | SR-4 | Possible ★3 | Native |
| Fingerprinting | Fingerprint battery (canvas / audio / WebGL / fonts) | Akamai, DataDome, PerimeterX — every commercial bot screen | BD-4 | Impossible ★4 | Native |
| Fingerprinting | CDP-attached browser tells | chrome.app/csi gone, browser-chrome height anomalies, Puppeteer artefacts | BD-2 | Possible ★3 | Needs fix ★2 |
| Fingerprinting | Passive webdriver / headless tells | navigator.webdriver, HeadlessChrome UA, missing plugins | BD-1 | Possible ★2 | Needs fix ★1 |
| Vision-only | Canvas-rendered UI (Figma / Sheets / Photoshop Web) | no DOM form — pixels only on a `<canvas>` | SR-1 | Impossible ★5 | Native |
| Vision-only | Image-only labels (bank PIN / brokerage) | SVG-image labels with empty alt; no DOM text | SR-6 | Possible ★4 | Native |
| Windowed DOM | Virtual scrolling / windowed list | AG Grid, TanStack Virtual, Slack history, Gmail, Notion databases | SR-8 | Possible ★4 | Native |
| Dynamic selectors | Dynamic / randomised selectors | CSS-in-JS apps, anti-bot WAFs, ticketing / sneaker drops | SR-2 | Possible ★4 | Native |
| Behavioural | Behavioural (mouse trajectory / keystroke cadence) | Cloudflare bot management, PerimeterX, DataDome behavioural mode | BD-3 | Possible ★3 | Native |

The `expanded` HTML for each row is authored fresh — 2–3 sentences focused on the comparison angle, not a copy of `/report`'s layman text.

## 6. File-level architecture

### New files
- **`src/data/surfaces.ts`** — exports the `Surface` type and the `surfaces: Surface[]` array. ~250 lines (13 entries × ~15 lines each + helper).
- **`src/data/levels.ts`** — extracted from `report.astro`. Exports the `LevelReport` interface, the `Signal` interface, the `sharedTest` / `sharedFailure` / `selectorFailure` constants, and the `levels: LevelReport[]` array. ~1000 lines (mechanical move).
- **`src/pages/comparison.astro`** — the page. Imports both data modules, renders the grouped table at build time. ~250 lines of Astro/HTML + ~25 lines inline `<script>` for row expand.

### Modified files
- **`src/pages/report.astro`** — replace the inline `levels` array and its supporting types/constants with an `import { levels, ... } from '../data/levels'`. No behaviour change.
- **`src/components/LevelLayout.astro`** — add "Comparison" link to the header nav, first position.
- **`src/pages/index.astro`** — add "Comparison" link to nav + landing CTA card.
- **`src/pages/about.astro`** — add "Comparison" link to nav.
- **`src/pages/other-usecases.astro`** — add "Comparison" link to nav.

### Inline JS in `comparison.astro`
~25 lines of vanilla JS that:
- Finds every `[data-row]` element.
- Adds a click listener that toggles a `data-expanded` attribute on the row and shows/hides the sibling `[data-detail]` block.
- No keyboard handling for v1 (the row is not interactive content; the demo link inside is its own focusable target).

### Build vs runtime
- **Build time (Astro):** all rows, pills, dots, and section headers rendered as static HTML. No conditional logic at runtime.
- **Runtime:** the row-expand toggle only.
- **No Preact island, no Pages Function, no env vars, no Turnstile.** This is the simplest page in the site.

## 7. Testing

- **No new Playwright tests.** The negative-suite contract is "every level page fails to sign in"; the comparison page has no sign-in form and doesn't fit that pattern.
- **One Vitest test** in `src/data/surfaces.test.ts` covering two invariants:
  1. **Every `LevelRef` resolves.** For each surface, each `{section, n}` in `levels` corresponds to a real entry in `levels.ts`. Guards against typos and against levels being deleted from `/report`.
  2. **`deriveVerdicts` is non-throwing for every referenced level.** Covers the `level.aiva.fixes!` non-null assertion and the `playwright.difficulty ?? 5` fallback by running the helper across all referenced levels and asserting the output is a well-typed `Surface` slice.
- **`npm run check`** must pass (TypeScript strict).
- **Manual smoke check**: open `/comparison`, click each row to confirm expand/collapse, click each demo link to confirm it lands on the right level page.

## 8. Out of scope (and what would change to add it)

- **Visual / classic AIVA column** — would require a new field on either `Surface` or `LevelReport` (`visualAiva: { verdict, effort, notes }`) and per-row authoring + sign-off.
- **Rows beyond the arena** — would require `levels: LevelRef[]` to be optional, plus first-party content on the row itself (Playwright code, error, AIVA stance) authored fresh, not derived.
- **Filter chips / sort toggle** — add when the table grows past ~25 rows. Implementation: a small client-side state machine; data attributes already in place from grouping.
- **Translation / localisation** — none; the site is English-only.

## 9. Risk and review

- **One-way door risk:** none. The page is additive; reverting is `git revert`. The `levels.ts` extraction is mechanical and equivalent.
- **Drift risk:** AIVA values in `/report` could be updated and `surfaces.ts` could fall behind. The Vitest in §7 mitigates by failing the build when a surface's derived values don't match the source.
- **Content risk:** the `expanded` 2–3 sentences per row are first-party copy. They go through PR review like any other content change.

## 10. References

- The arena: 13 levels in two sections — see `2026-05-12-bot-arena-design.md`.
- The deep-dive failure report: `src/pages/report.astro` (after this work, sourcing from `src/data/levels.ts`).
- Production-app case studies: `src/pages/other-usecases.astro`.
