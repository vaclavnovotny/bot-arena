# External-demo Playwright suite — Design

**Status:** Awaiting user review
**Date:** 2026-05-14
**Author:** vaclav.novotny@ysoft.com (with Claude)
**Companion to:** `2026-05-13-comparison-page-design.md`

## 1. Summary

A new `/external` page and a separate Playwright suite that target three public third-party SaaS demos — **Grafana Play**, **Onshape Free**, and **Odoo demo** — and demonstrate that stock Playwright cannot drive the canvas-rendered parts of those apps even when given the strongest workaround a Playwright test can express. Mirrors the visual idiom of `/report`, but adds a category of evidence the arena itself does not provide: failures observed against *real* enterprise SaaS the team did not build.

Each app gets two tests: a naïve locator-based attempt (the same shape as `playwright/levels.spec.ts`), and a best-effort attempt that uses the strongest in-process workaround a Playwright test can run — `page.evaluate` for canvas pixels, in-process Tesseract.js OCR, computed coordinates from CSS variables. Both tests fail by design.

## 2. Goals & non-goals

### Goals
- Demonstrate Playwright's structural limits against real enterprise SaaS, not arena demos.
- Cover three distinct canvas-failure subtypes — *read* (Grafana), *click* (Onshape), *drag* (Odoo) — so the suite doesn't look like one failure repeated three times.
- Use only Playwright-runtime workarounds in the "best-effort" tests. No remote LLM, no OS-level vision, no extra processes. Proves the failure is in the tool, not in the script author's effort.
- Keep CI behaviour unchanged: the new tests must be opt-in only.
- Publish the same prose/code pattern as `/report` so a reader can compare arena and real-world evidence side-by-side.

### Non-goals (v1)
- **No CI gating.** External demos churn; turning their flakiness into pipeline reds would invert the failure model.
- **No deep per-app coverage.** Two tests per app, not three or more. We accepted the "hybrid: one naive + one best-effort per app" scope and will not expand beyond it in v1.
- **No remote vision/LLM workarounds.** Adding a model call to the best-effort path turns the demonstration from "PW + clever script fails" into "PW + agentic harness sometimes succeeds, sometimes hallucinates" — a different question already covered by the `/comparison` open-question on hallucinations.
- **No new tooling additions to the default `chromium` project.** The existing 13 arena tests must keep running identically.
- **v1 ships only `vision-only` entries.** The three picks all target canvas-rendering failures. The data model reuses the `Family` type from `surfaces.ts`, so adding `streamed-desktop` (e.g. a Kasm Workspaces test) or any other family in a later iteration is a data-only change — no schema rewrite, no page-template rewrite. The door is left open.
- **No bypass of any demo's auth, rate limits, or ToS.** This is documented in the README; tests use realistic user agents, conservative `workers: 1` parallelism, and a dedicated Onshape test account.

## 3. Page contract

### Route
- `/external` (singular, matches `/about`, `/report`, `/comparison`, `/other-usecases`).

### Nav placement
- Header nav order, applied to every page that has a nav: **Comparison · Failure report · Other use-cases · External demos · About · GitHub**.
- No landing-page CTA in v1 — the page is supporting evidence, not a primary entry point.

### Page structure (top to bottom)
1. **Shared header** (existing nav, with the new "External demos" link added).
2. **Hero**:
   - H1: *"External demos — where Playwright runs out of road in public SaaS"*
   - One-sentence pitch: *"Three real enterprise demos, not arena pages. For each one: a naïve Playwright test, the strongest workaround a Playwright test can express, and the structural reason both fail."*
   - Legend: short inline guide repeating `/report`'s pill scheme so the page can be read standalone.
3. **TOC** — three anchors (Grafana Play, Onshape Free, Odoo demo) for jump-to.
4. **Per-app section** (×3) — see §4.
5. **Footer block**:
   - Heading: *"How to read this"*
   - Note that all three apps are out-of-arena public demos with their own terms; we run tests against them sparingly and never bypass auth or rate limits.
   - Inline link: *"For the in-arena equivalents, see the failure report →"* → `/report`.
6. **Site footer** (shared).

## 4. Per-app section template

Each app gets one section, with the same template:

1. **App title + category pill** (e.g. *Grafana Play — Enterprise observability*).
2. **Free-demo URL** (anchor link out to the public demo).
3. **Use case** — one sentence describing the realistic automation scenario (e.g. *"Verify the latest p95 latency stays below threshold after a deploy"*).
4. **Naïve Playwright test** — a code block with the literal test from `playwright/external/{app}.spec.ts`, followed by the error Playwright surfaces when it runs.
5. **Best-effort Playwright test** — a second code block with the in-process workaround attempt, followed by *its* error or wrong-result.
6. **Why it fails** — 100–150 words of plain-English explanation of the structural reason. Same tone as `/report`'s level entries.
7. **AIVA context** — a parallel block to `/report`'s AIVA section, with no new claims (uses the same `passes` / `fixes[]` shape if extended in future; v1 prose-only).

## 5. Failure shapes (the three picks)

### Grafana Play — read

- **Demo URL:** a specific public Grafana Play dashboard URL with a time-series panel; pinned during implementation. Likely `https://play.grafana.org/d/<uid>/<slug>` of a panel that always has data.
- **Use case:** "Verify the latest p95 response time displayed on the API Latency panel is under 500 ms."
- **Naïve test:** `page.getByText(/^\d{1,4}\s?ms$/i)` — fails because the visible value is rendered into the panel `<canvas>` by uPlot, not into any DOM text node.
- **Best-effort test:** crop the panel via `locator.screenshot()`, feed the PNG to in-process Tesseract.js, regex out the digits + unit. Fails because: (a) the cursor-tooltip value lives on a separate canvas overlay that disappears on mouse move; (b) OCR can return *a* number but cannot bind it to a timestamp without parsing the x-axis (also pixels); (c) the panel's stat-value rendering and the time-series line's last point are different numbers and OCR cannot tell which it captured. Test asserts the OCR match but cannot verify correctness — the proof.
- **Family:** `vision-only`. Failure shape: `read`.

### Onshape Free — click

- **Demo URL:** a public Onshape part-studio URL (a shared, anonymously viewable model). Test account credentials in `.env`.
- **Use case:** "After loading the part, click on the front face of the cube and verify it's selected before measuring."
- **Naïve test:** `page.getByRole('button', { name: /front face/i }).click()` — fails because the 3D viewport has no DOM children; faces, edges, and vertices exist only as WebGL geometry.
- **Best-effort test:** locate the WebGL `<canvas>`, take its bounding box, click the geometric centre. Fails because: (a) "the front face" is defined relative to the camera, which can be in any orientation when the page loads; (b) the centre of the viewport is not necessarily the front face; (c) the test cannot verify which face it actually selected without reading the Properties panel — which may or may not be DOM, depending on whether the demo part exposes named faces.
- **Family:** `vision-only`. Failure shape: `click`.

### Odoo demo — drag

- **Demo URL:** `https://demo.odoo.com/` → Project module → a Gantt view URL captured after the demo-instance redirect. Pinned during implementation since Odoo's demo provisions a fresh subdomain per visit; the test must handle the redirect or invoke an idempotent start URL.
- **Use case:** "Reschedule the *Design mockups* task two days right in the Gantt view to model a delay."
- **Naïve test:** locate the task pill and the target cell with `data-` attributes; `task.dragTo(target)`. Fails because the demo bundle's Gantt cells are SVG `<rect>` siblings rendered inside one transformed `<g>` — the target "cell for 2026-06-12" is not a separate element, just a computed pixel offset.
- **Best-effort test:** read the CSS variable for day-column width, multiply by 2, manual `mouse.down`/`move`/`up` from the task's bounding box. Fails because: (a) the CSS variable is not exposed on a queryable element on the demo bundle; (b) zoom level (which the demo auto-sets based on viewport size) changes the effective pixel-per-day; (c) Odoo's drag handler uses internal data offsets, not raw pixel deltas, so even a pixel-correct drop snaps to the wrong date.
- **Family:** `vision-only` (with a `windowed-dom` undertone — the Gantt also virtualises off-screen rows). Failure shape: `drag`.

## 6. Data model

### `src/data/externalDemos.ts`

```ts
import type { Family } from './surfaces';

export type FailureShape = 'read' | 'click' | 'drag';

export interface ExternalDemo {
  id: 'grafana' | 'onshape' | 'odoo';
  title: string;                            // "Grafana Play — read p95 from a canvas panel"
  category: string;                         // "Enterprise observability"
  demoUrl: string;                          // public URL
  useCase: string;                          // one-sentence scenario
  family: Family;                           // 'vision-only' for all three v1 entries
  failureShape: FailureShape;
  naive: {
    code: string;                           // verbatim from grafana.spec.ts
    error: string;                          // PW error text when run
  };
  bestEffort: {
    code: string;
    error: string;                          // PW error OR "wrong result" string
    reasonItStillFails: string;             // 1–2 sentence summary
  };
  whyItFails: string;                       // HTML, ~150 words
  aivaContext: string;                      // HTML, parallel to /report's AIVA block
}

export const externalDemos: ExternalDemo[];
```

The verbatim code and error fields are kept in the data file so the page renders deterministically without parsing test logs at build time. They are updated by hand when the spec file changes — explicit drift between the data file and the test code is acceptable v1 behaviour and called out in the implementation plan.

### `src/pages/external.astro`

Iterates `externalDemos` and renders the §4 template. Reuses the row-expand JS pattern from `comparison.astro` only if a section needs collapsible blocks; v1 renders everything open by default since there are only three sections.

## 7. Playwright config & repo layout

### Directory
```
playwright/
  levels.spec.ts                            unchanged
  external/
    helpers.ts                              ocr(), canvasCentre(), readCssVar()
    grafana.spec.ts                         2 tests
    onshape.spec.ts                         2 tests
    odoo.spec.ts                            2 tests
```

### `playwright.config.ts`
- Default project `chromium` gains `testIgnore: ['external/**']` so the existing 13-test behaviour is untouched.
- New project `external`:
  - `testMatch: 'external/**'`
  - `use.baseURL: undefined` (each spec navigates to its own SUT URL)
  - inherits `headless`, `trace`, `screenshot` from the top-level `use`
  - `workers: 1` (already set), `fullyParallel: false` (already set) — kept to be polite to public demos
- Run with `npx playwright test --project external`. The default `npx playwright test` keeps running the arena suite only.

### `package.json`
- Add `"test:external": "playwright test --project external"`.
- No new dependencies in v1 except `tesseract.js` (added as a `devDependency` for the best-effort OCR test).

### `.env.example`
- Add commented lines:
  ```
  # Required only for playwright/external/onshape.spec.ts
  ONSHAPE_TEST_EMAIL=
  ONSHAPE_TEST_PASSWORD=
  ```

## 8. Helpers (`playwright/external/helpers.ts`)

Three small utilities, each ~10–15 lines:

- `ocr(buffer: Buffer): Promise<string>` — wraps Tesseract.js. Loads the English model from local `node_modules` (no network call on each test). Returns raw text.
- `canvasCentre(locator: Locator): Promise<{x: number; y: number}>` — bounding-box midpoint of any `<canvas>` locator. Used by Onshape best-effort.
- `readCssVar(page: Page, varName: string, selector = 'html'): Promise<number | null>` — runs `getComputedStyle().getPropertyValue()` in the page. Used by Odoo best-effort to attempt to read day-column width. Returns `null` if the variable is unset (the realistic failure path).

Helpers are stateless and have no external network dependencies.

## 9. ToS, ethics, and operational notes

- README gets a new "Running external-demo tests" section that:
  - Documents the opt-in run command.
  - States explicitly: "We run these tests against third-party public demos in good faith. We do not bypass auth, defeat rate limits, or use these demos for load testing. Use a dedicated test account where signup is required (Onshape). If a demo's terms change, retire the corresponding test."
  - Notes that Odoo's demo provisions a fresh instance per visit and the test re-acquires that URL on each run.
- Tests set a realistic user-agent via `use.userAgent` in the `external` project (e.g. a current Chrome string), since the default Playwright UA contains "HeadlessChrome" and some public demos rate-limit it.
- Per-spec timeouts are kept generous (15–30 s navigation, 10 s actions) so slow demo cold-starts are not mistaken for failures.

## 10. Implementation order

This is enough to write a plan against:

1. Add `tesseract.js` to `devDependencies`; verify the English model loads in a smoke test.
2. Author `playwright/external/helpers.ts`; unit-test `readCssVar` against the existing arena pages locally.
3. Author each spec one at a time — Grafana first (no auth), Odoo second (auto-provisioned), Onshape last (signup wall, needs `.env` plumbing).
4. Update `playwright.config.ts` with the new project + `testIgnore` on the default project.
5. Add `test:external` to `package.json`.
6. Write `src/data/externalDemos.ts` with verbatim code/error fields from the now-stable specs.
7. Build `src/pages/external.astro`.
8. Update nav on `comparison.astro`, `report.astro`, `other-usecases.astro`, `about.astro`, `index.astro` (the existing pages that share the header pattern).
9. Update README — "Running external-demo tests" section + ToS note.
10. Update `.env.example`.
11. Verify `npm run check`, `npm test`, `npx playwright test` all still pass; verify `npx playwright test --project external` runs and the 6 new tests *fail* as designed.
