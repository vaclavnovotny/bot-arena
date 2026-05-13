# Comparison Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/comparison`, a static page comparing Playwright vs agentic-AIVA across the 13 arena levels, grouped by failure family. All AIVA values derive from `/report`'s existing level data — no new claims are made about AIVA.

**Architecture:** Extract `/report`'s inline level array into `src/data/levels.ts` (single source of truth). Add `src/data/surfaces.ts` describing 13 real-world surfaces, each referencing one level via a small derive helper. Render `src/pages/comparison.astro` as a static grouped table at build time, with ~25 lines of inline JS for row click-to-expand. Add a "Comparison" link to the existing nav on every page.

**Tech Stack:** Astro 5 (static MPA) · Tailwind CSS v4 · TypeScript strict · Vitest + happy-dom for unit tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-13-comparison-page-design.md`.

---

## File map

**New files**

| Path | Responsibility |
|---|---|
| `src/data/levels.ts` | Authoritative level data extracted from `report.astro`: `Signal` and `LevelReport` interfaces, `sharedTest`/`sharedFailure`/`selectorFailure` constants, the `levels: LevelReport[]` array. |
| `src/data/surfaces.ts` | `Family` and `LevelRef` types, `Surface` interface, `deriveVerdicts(level)` helper, the `surfaces: Surface[]` array (13 entries). |
| `src/data/surfaces.test.ts` | Vitest covering (1) every `LevelRef` resolves to an existing level, (2) `deriveVerdicts` is non-throwing and well-typed for every referenced level. |
| `src/pages/comparison.astro` | The new page. Static HTML at build time + ~25 lines inline JS for row expand. |

**Modified files**

| Path | Change |
|---|---|
| `src/pages/report.astro` | Replace inline types/constants/array with imports from `src/data/levels.ts`. No behaviour change. |
| `src/components/LevelLayout.astro` | Add "Comparison" link to the header nav. |
| `src/pages/index.astro` | Add "Comparison" to header nav + new landing CTA card. |
| `src/pages/about.astro` | Add "Comparison" to header nav. |
| `src/pages/other-usecases.astro` | Add "Comparison" to header nav. |

---

## Task 1: Extract `/report`'s level array into `src/data/levels.ts`

Mechanical refactor — move code, no behaviour change. Verify the page still renders identically.

**Files:**
- Create: `src/data/levels.ts`
- Modify: `src/pages/report.astro:1-75` (frontmatter top) and `src/pages/report.astro:77-729` (the `levels` array)

- [ ] **Step 1.1: Create the new data file with the extracted types and constants**

Create `src/data/levels.ts` with this exact content:

```ts
export interface Signal {
  status: 'fail' | 'pass' | 'info';
  id: string;
  detail: string;
}

export interface LevelReport {
  n: number;
  section: 'Bot detection' | 'Selector resistance';
  title: string;
  family: string;
  testCode: string;
  failureMessage: string;
  signals: Signal[];
  layman: {
    problem: string;
    workaround: string;
  };
  playwright:
    | {
        kind: 'fixable';
        difficulty: 1 | 2 | 3 | 4 | 5;
        label: string;
        notes: string; // HTML allowed
      }
    | {
        kind: 'impossible';
        label: string;
        notes: string; // HTML allowed
      };
  aiva: {
    passes: boolean;
    fixes?: Array<
      | {
          kind: 'fixable';
          difficulty: 1 | 2 | 3 | 4 | 5;
          label: string;
          tags: string[];
          estimate: string;
        }
      | {
          kind: 'impossible';
          label: string;
          tags: string[];
          estimate: string;
        }
    >;
    notes: string; // HTML allowed
  };
}

export const sharedTest = (localN: number, urlPath: string) => `test('Level ${localN} sign in', async ({ page }) => {
  await page.goto('${urlPath}');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});`;

export const sharedFailure = `Error: expect(locator).toBeVisible() failed

Locator:  getByText('Access granted')
Expected: visible
Received: hidden
Timeout:  5000ms`;

export const selectorFailure = `Error: locator.fill: Test timeout of 30000ms exceeded.

Call log:
  - waiting for getByLabel('Email')
  - locator resolved to <no element matched>`;

export const levels: LevelReport[] = [
  // PASTE THE EXACT ARRAY FROM report.astro LINES 77-729 HERE
];
```

Then open `src/pages/report.astro` and copy the entire contents of the `const levels: LevelReport[] = [...]` array literal (lines 77–729 inclusive — from the opening `[` to the closing `];`) into the placeholder above. Do **not** modify any entry.

- [ ] **Step 1.2: Update `report.astro` to import from the new module**

Edit `src/pages/report.astro`. Replace lines 1–75 (everything from the first `---` line through the end of the `selectorFailure` declaration) with:

```ts
---
import '../styles/global.css';
import { Code } from 'astro:components';
import {
  type Signal,
  type LevelReport,
  sharedTest,
  sharedFailure,
  selectorFailure,
  levels,
} from '../data/levels';
```

Then delete the entire `const levels: LevelReport[] = [...];` declaration (lines that were 77–729 before this edit). The frontmatter should continue with `const totalFails = ...` immediately after the imports.

Leave `totalFails`, `fixStyles`, `TEST_SPEC_PATH`, and `TEST_SPEC_BLOB_URL` untouched — they're page-specific.

- [ ] **Step 1.3: Typecheck**

Run: `npm run check`
Expected: zero errors.

- [ ] **Step 1.4: Build**

Run: `npm run build`
Expected: build succeeds; `dist/report/index.html` exists.

- [ ] **Step 1.5: Visual smoke check**

Run: `npm run dev`
Open: `http://localhost:4321/report`
Confirm: page renders identically to before — same 13 level cards, same Playwright/AIVA copy, same pill colours.

- [ ] **Step 1.6: Commit**

```bash
git add src/data/levels.ts src/pages/report.astro
git commit -m "refactor(report): extract level data into src/data/levels.ts

No behaviour change. Prepares the level array for reuse by the
upcoming /comparison page."
```

---

## Task 2: Set up `src/data/surfaces.ts` with types + helper + empty array

TDD scaffolding — write the data module and its test, both expecting an empty array. Tests pass trivially; next task fills the array.

**Files:**
- Create: `src/data/surfaces.ts`
- Create: `src/data/surfaces.test.ts`

- [ ] **Step 2.1: Create `src/data/surfaces.ts` with types, helper, and empty array**

```ts
import { type LevelReport, levels } from './levels';

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
  id: string;
  title: string;
  family: Family;
  examples: string;
  levels: LevelRef[];
  expanded: string;
  playwright: {
    verdict: 'impossible' | 'possible';
    effort: 1 | 2 | 3 | 4 | 5;
  };
  aiva: {
    verdict: 'native' | 'needs-fix';
    effort: 1 | 2 | 3 | 4 | 5;
  };
}

/** Look up a level by its LevelRef. */
export function resolveLevel(ref: LevelRef): LevelReport {
  const sectionName: LevelReport['section'] =
    ref.section === 'bd' ? 'Bot detection' : 'Selector resistance';
  const level = levels.find((l) => l.section === sectionName && l.n === ref.n);
  if (!level) {
    throw new Error(`Surface references unknown level: ${ref.section.toUpperCase()}-${ref.n}`);
  }
  return level;
}

/** Map a LevelReport to the playwright/aiva slice of a Surface. */
export function deriveVerdicts(level: LevelReport): Pick<Surface, 'playwright' | 'aiva'> {
  const pwEffort: 1 | 2 | 3 | 4 | 5 =
    level.playwright.kind === 'fixable' ? level.playwright.difficulty : 5;

  if (level.aiva.passes) {
    return {
      playwright: {
        verdict: level.playwright.kind === 'impossible' ? 'impossible' : 'possible',
        effort: pwEffort,
      },
      aiva: { verdict: 'native', effort: 1 },
    };
  }

  const fixes = level.aiva.fixes ?? [];
  if (fixes.length === 0) {
    throw new Error(`Level ${level.section} ${level.n} has passes=false but no fixes`);
  }
  const minEffort = Math.min(
    ...fixes.map((f) => (f.kind === 'fixable' ? f.difficulty : 5)),
  ) as 1 | 2 | 3 | 4 | 5;

  return {
    playwright: {
      verdict: level.playwright.kind === 'impossible' ? 'impossible' : 'possible',
      effort: pwEffort,
    },
    aiva: { verdict: 'needs-fix', effort: minEffort },
  };
}

export const surfaces: Surface[] = [];
```

- [ ] **Step 2.2: Create `src/data/surfaces.test.ts` with both invariants**

```ts
import { describe, it, expect } from 'vitest';
import { surfaces, resolveLevel, deriveVerdicts } from './surfaces';

describe('surfaces data module', () => {
  it('every LevelRef resolves to a real level', () => {
    for (const surface of surfaces) {
      for (const ref of surface.levels) {
        expect(() => resolveLevel(ref)).not.toThrow();
      }
    }
  });

  it('deriveVerdicts produces well-typed output for every referenced level', () => {
    for (const surface of surfaces) {
      for (const ref of surface.levels) {
        const level = resolveLevel(ref);
        const result = deriveVerdicts(level);

        expect(['impossible', 'possible']).toContain(result.playwright.verdict);
        expect([1, 2, 3, 4, 5]).toContain(result.playwright.effort);
        expect(['native', 'needs-fix']).toContain(result.aiva.verdict);
        expect([1, 2, 3, 4, 5]).toContain(result.aiva.effort);
      }
    }
  });
});
```

- [ ] **Step 2.3: Run tests — confirm both pass trivially with empty array**

Run: `npm test`
Expected: 2 passing tests (`surfaces data module > every LevelRef resolves to a real level`, `surfaces data module > deriveVerdicts produces well-typed output for every referenced level`). They pass because the for-loops never execute.

- [ ] **Step 2.4: Typecheck**

Run: `npm run check`
Expected: zero errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/data/surfaces.ts src/data/surfaces.test.ts
git commit -m "feat(comparison): scaffold surfaces data module with helper and tests

Empty array; rows added in the next commit. The deriveVerdicts helper
maps LevelReport into the playwright/aiva slice of a Surface, with
fallbacks for impossible-kind levels and impossible-kind fixes."
```

---

## Task 3: Populate the 13 surfaces

Add all 13 surface entries to `surfaces.ts`, ordered as the spec's family ordering and within-family severity. Each row uses `deriveVerdicts(resolveLevel(...))` so verdicts can't drift from `/report`.

**Files:**
- Modify: `src/data/surfaces.ts:55` (the `export const surfaces: Surface[] = [];` line)

- [ ] **Step 3.1: Replace the empty `surfaces` array with the 13 entries**

In `src/data/surfaces.ts`, replace `export const surfaces: Surface[] = [];` with the block below. Each entry calls `deriveVerdicts(resolveLevel(...))` so verdicts/effort are always sourced from `levels.ts`.

```ts
function build(
  partial: Omit<Surface, 'playwright' | 'aiva'>,
): Surface {
  const primary = resolveLevel(partial.levels[0]);
  return { ...partial, ...deriveVerdicts(primary) };
}

export const surfaces: Surface[] = [
  // ─── Vendor challenge ────────────────────────────────────────────────
  build({
    id: 'cloudflare-turnstile',
    title: 'Cloudflare Turnstile (managed mode)',
    family: 'vendor-challenge',
    examples: 'Cloudflare-fronted sign-ins, hCaptcha managed, Arkose Labs',
    levels: [{ section: 'bd', n: 5 }],
    expanded:
      'Third-party challenges run in a sandboxed iframe with server-side verification — the browser can render the widget, but only a real interactive user can pass it. Playwright cannot solve the challenge; agentic-AIVA can drive the challenge UI from the OS side but still needs configuration to avoid being scored as a bot.',
  }),
  build({
    id: 'slider-captcha',
    title: 'Slider / drag CAPTCHA',
    family: 'vendor-challenge',
    examples: 'GeeTest, AWS WAF Bot Control, Ticketmaster, Alibaba',
    levels: [{ section: 'sr', n: 5 }],
    expanded:
      'The target position is a pixel offset visible only in the rendered image. Selector-based tools can find the slider element but cannot see where to drop it. AIVA\'s vision loop measures the gap and drags by the right number of pixels — same as a human — but the geometry needs tuning per vendor.',
  }),

  // ─── Cross-origin / sealed ───────────────────────────────────────────
  build({
    id: 'cross-origin-iframe',
    title: 'Cross-origin iframe (Stripe / Auth0 / Turnstile widget)',
    family: 'cross-origin',
    examples: 'Stripe Elements, Auth0 Universal Login, sandboxed payment & SSO',
    levels: [{ section: 'sr', n: 7 }],
    expanded:
      'The form lives on a different origin from the host page. Browser security blocks every selector from reaching into the iframe — <code>frameLocator</code> works for same-origin frames, but cross-origin (Stripe, Auth0) and sandboxed widgets are firmly off-limits. AIVA drives at the OS level, so frame boundaries are invisible to it; the small fix is a routing tweak so the recogniser scopes to the iframe region.',
  }),
  build({
    id: 'closed-shadow-dom',
    title: 'Closed Shadow DOM (Salesforce LWC / SAP UI5 / ServiceNow)',
    family: 'cross-origin',
    examples: 'enterprise apps built on sealed web components',
    levels: [{ section: 'sr', n: 3 }],
    expanded:
      'A web component declared with <code>attachShadow({ mode: \'closed\' })</code> walls off its inner DOM from any outside script. No selector — <code>querySelector</code>, <code>getByLabel</code>, <code>evaluate</code> — can cross the boundary. Visual automation reads pixels, so the seal is irrelevant; AIVA passes natively.',
  }),
  build({
    id: 'same-origin-iframe',
    title: 'Same-origin embedded widget',
    family: 'cross-origin',
    examples: 'older same-origin payment & SSO iframes',
    levels: [{ section: 'sr', n: 4 }],
    expanded:
      'Older payment and SSO forms commonly live inside same-origin iframes. Page-scoped locators do not traverse frames, so the default <code>getByLabel(\'Email\')</code> call misses entirely. Playwright can recover with <code>page.frameLocator(...)</code>, but every test that touches the widget needs to be frame-aware. AIVA does not see frames at all.',
  }),

  // ─── Fingerprinting ──────────────────────────────────────────────────
  build({
    id: 'fingerprint-battery',
    title: 'Fingerprint battery (canvas / audio / WebGL / fonts)',
    family: 'fingerprinting',
    examples: 'Akamai, DataDome, PerimeterX — every commercial bot screen',
    levels: [{ section: 'bd', n: 4 }],
    expanded:
      'Bot screens fingerprint the browser through canvas rendering, audio context, WebGL renderer string, and installed fonts. Faking all four consistently from inside the browser is essentially impossible without a real GPU and font set. AIVA runs in a regular desktop Chrome on a real Linux machine, so the fingerprint is genuinely a human\'s.',
  }),
  build({
    id: 'cdp-attached',
    title: 'CDP-attached browser tells',
    family: 'fingerprinting',
    examples: 'chrome.app / chrome.csi gone, browser-chrome height anomalies, Puppeteer artefacts',
    levels: [{ section: 'bd', n: 2 }],
    expanded:
      'Attaching to a browser over the Chrome DevTools Protocol leaves subtle traces: <code>chrome.app</code> and <code>chrome.csi</code> are missing, browser-chrome height is off, the Puppeteer driver-shim leaves a few global flags. Each tell is a yes/no question a site can ask. AIVA shares this surface today because it also uses Puppeteer + CDP; a small init-script patch closes most of the gap.',
  }),
  build({
    id: 'passive-webdriver',
    title: 'Passive webdriver / headless tells',
    family: 'fingerprinting',
    examples: 'navigator.webdriver, HeadlessChrome UA, missing plugins',
    levels: [{ section: 'bd', n: 1 }],
    expanded:
      'Stock automation honestly admits itself: <code>navigator.webdriver === true</code>, <code>navigator.plugins.length === 0</code>, and a <code>HeadlessChrome</code> substring in the user agent. Every passive bot screen checks at least one of these. AIVA inherits the same flags via CDP, but a single <code>evaluateOnNewDocument</code> patch fixes all three.',
  }),

  // ─── Vision-only ─────────────────────────────────────────────────────
  build({
    id: 'canvas-ui',
    title: 'Canvas-rendered UI (Figma / Sheets / Photoshop Web)',
    family: 'vision-only',
    examples: 'no DOM form — pixels only on a <code>&lt;canvas&gt;</code>',
    levels: [{ section: 'sr', n: 1 }],
    expanded:
      'Apps like Figma, Google Sheets, and Photoshop Web paint their entire UI onto a <code>&lt;canvas&gt;</code> element — there is no DOM form, no <code>&lt;input&gt;</code>, no labelled field. Selectors return nothing because there is nothing to select. AIVA reads pixels, so the canvas is just a normal interface to it.',
  }),
  build({
    id: 'image-labels',
    title: 'Image-only labels (bank PIN / brokerage)',
    family: 'vision-only',
    examples: 'SVG-image labels with empty alt; no DOM text',
    levels: [{ section: 'sr', n: 6 }],
    expanded:
      'Bank PIN keypads and brokerage portals render every label as an inline SVG image with empty <code>alt</code> text — the label "8" is a tiny image, not a <code>&lt;text&gt;</code> node or accessible-name attribute. Playwright\'s <code>getByLabel</code> and <code>getByText</code> find nothing; only brittle structural selectors are left. AIVA reads the rendered label as a human would.',
  }),

  // ─── Windowed DOM ────────────────────────────────────────────────────
  build({
    id: 'virtual-scrolling',
    title: 'Virtual scrolling / windowed list',
    family: 'windowed-dom',
    examples: 'AG Grid, TanStack Virtual, Slack history, Gmail, Notion databases',
    levels: [{ section: 'sr', n: 8 }],
    expanded:
      'Modern data-grids (AG Grid, TanStack Virtual, Slack history, Notion databases) render only the rows currently in the viewport. A test that wants the 500th row has to know the list is virtualised, know the row height, and dispatch programmatic scrolls. AIVA\'s vision loop already scrolls-and-looks the way a human does — no list-specific code.',
  }),

  // ─── Dynamic selectors ───────────────────────────────────────────────
  build({
    id: 'dynamic-selectors',
    title: 'Dynamic / randomised selectors',
    family: 'dynamic-selectors',
    examples: 'CSS-in-JS apps, anti-bot WAFs, ticketing / sneaker drops',
    levels: [{ section: 'sr', n: 2 }],
    expanded:
      'CSS-in-JS frameworks and anti-bot WAFs rotate every <code>id</code>, <code>name</code>, and <code>class</code> per request, so the locator that worked yesterday is dead today. Tests fall back to structural anchors that break the moment the page is refactored. AIVA does not depend on selectors at all — labels and positions on screen are stable across rerolls.',
  }),

  // ─── Behavioural ─────────────────────────────────────────────────────
  build({
    id: 'behavioural',
    title: 'Behavioural (mouse trajectory / keystroke cadence)',
    family: 'behavioural',
    examples: 'Cloudflare bot management, PerimeterX, DataDome behavioural mode',
    levels: [{ section: 'bd', n: 3 }],
    expanded:
      'Cloudflare and PerimeterX behavioural mode score the mouse path, click curvature, and keystroke cadence. Playwright moves the mouse in a straight line and types instantly — both are red flags. Plug-ins like <code>puppeteer-extra-plugin-mouse-helper</code> add jitter but stay one step behind detection logic. AIVA\'s input is real mouse motion through the OS — it looks like a human because it is one.',
  }),
];
```

- [ ] **Step 3.2: Run tests — both invariants should still pass, now with 13 surfaces**

Run: `npm test`
Expected: 2 passing tests, no errors. If either fails, a typo in a `LevelRef` or a level missing from `levels.ts` is the cause.

- [ ] **Step 3.3: Typecheck**

Run: `npm run check`
Expected: zero errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/data/surfaces.ts
git commit -m "feat(comparison): populate 13 surfaces grouped by family

Each surface references one arena level; playwright/aiva verdicts
are derived at build time from src/data/levels.ts, so they cannot
drift from /report."
```

---

## Task 4: Comparison page skeleton (header, hero, footer — no table yet)

Get a routable page rendering with shared nav, hero, and footer. Confirm `/comparison` loads. Table comes next task.

**Files:**
- Create: `src/pages/comparison.astro`

- [ ] **Step 4.1: Create `src/pages/comparison.astro` with header / hero / footer block / site footer**

```astro
---
import '../styles/global.css';
import { surfaces, type Family } from '../data/surfaces';

const familyLabels: Record<Family, string> = {
  'vendor-challenge': 'Vendor challenge',
  'cross-origin': 'Cross-origin / sealed',
  'fingerprinting': 'Fingerprinting',
  'vision-only': 'Vision-only',
  'windowed-dom': 'Windowed DOM',
  'dynamic-selectors': 'Dynamic selectors',
  'behavioural': 'Behavioural',
};

const familyBlurbs: Record<Family, string> = {
  'vendor-challenge': 'third-party challenges with server-side verification — the hardest cells on the page',
  'cross-origin': 'surfaces the browser refuses to let scripts reach into',
  'fingerprinting': 'browser identity and driver-shim tells — the baseline of every commercial bot screen',
  'vision-only': 'labels and form fields rendered as pixels, not text — no DOM to query',
  'windowed-dom': 'virtualised lists; off-screen rows are absent from the DOM',
  'dynamic-selectors': 'id / name / class rerolls per request',
  'behavioural': 'mouse trajectory, keystroke cadence, dwell timing',
};

const familyOrder: Family[] = [
  'vendor-challenge',
  'cross-origin',
  'fingerprinting',
  'vision-only',
  'windowed-dom',
  'dynamic-selectors',
  'behavioural',
];

const familyToSurfaces: Record<Family, typeof surfaces> = familyOrder.reduce(
  (acc, f) => ({ ...acc, [f]: surfaces.filter((s) => s.family === f) }),
  {} as Record<Family, typeof surfaces>,
);
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Comparison — Playwright vs AIVA · Bot Arena</title>
    <meta
      name="description"
      content="13 real-world automation surfaces from the Bot Arena, with Playwright and agentic-AIVA verdicts side by side. Grouped by failure family, ordered by severity."
    />
  </head>
  <body class="min-h-screen bg-slate-50 text-slate-900">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" class="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" class="h-6 w-6" />
          <span>Bot Arena</span>
        </a>
        <nav class="flex gap-4 text-sm text-slate-600">
          <a href="/comparison" class="hover:text-slate-900">Comparison</a>
          <a href="/report" class="hover:text-slate-900">Failure report</a>
          <a href="/other-usecases" class="hover:text-slate-900">Other use-cases</a>
          <a href="/about" class="hover:text-slate-900">About</a>
          <a href="https://github.com/vaclavnovotny/bot-arena" class="hover:text-slate-900">GitHub</a>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-12">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Side-by-side</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        Playwright vs AIVA — where each one breaks
      </h1>
      <p class="mt-3 max-w-3xl text-slate-600">
        13 real-world automation surfaces from the arena, grouped by failure family and ordered by severity. Every AIVA verdict is pulled directly from the
        <a href="/report" class="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-900">failure report</a>'s
        existing data — this page makes no new claims about either tool.
      </p>

      {/* Verdict legend */}
      <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        <span class="font-semibold uppercase tracking-wide text-slate-500">Legend</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">Impossible</span> stock Playwright cannot do this
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">Possible</span> with custom code; effort 1–5
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Native</span> AIVA passes as-is
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">Needs fix</span> AIVA needs a configuration / patch
        </span>
      </div>

      {/* Table goes here in Task 5 */}
      <p class="mt-10 text-sm text-slate-400">[table renders here in Task 5]</p>

      <section class="mt-14 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <h2 class="text-base font-semibold text-slate-900">How to read this</h2>
        <p class="mt-2 text-slate-600">
          The verdict pill answers "can this tool do it at all?" The 1–5 dot meter answers "how much work?" For AIVA "Needs fix" rows, the effort is the lowest-difficulty fix in
          <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">aiva.fixes[]</code>
          for that level.
        </p>
        <p class="mt-3 text-slate-600">
          For per-level Playwright code, exact errors, and the AIVA fix narrative, see the
          <a href="/report" class="text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-900">full failure report</a>.
        </p>
      </section>
    </main>

    <footer class="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
      Demo target only. No analytics, no tracking.
    </footer>
  </body>
</html>
```

- [ ] **Step 4.2: Run dev server and visit the page**

Run: `npm run dev`
Open: `http://localhost:4321/comparison`
Confirm: page renders with header, hero, legend, "[table renders here in Task 5]" placeholder, and footer block. No console errors.

- [ ] **Step 4.3: Typecheck**

Run: `npm run check`
Expected: zero errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/pages/comparison.astro
git commit -m "feat(comparison): scaffold /comparison page

Header, hero, verdict legend, and footer block. Table is rendered
in the next commit."
```

---

## Task 5: Render the family-grouped table

Replace the placeholder with the full grouped table. 7 family sections, 13 rows total, each row with title + examples line + verdict pills + effort dots + demo link. Click-to-expand wiring is added in Task 6.

**Files:**
- Modify: `src/pages/comparison.astro` (replace the `[table renders here…]` placeholder)

- [ ] **Step 5.1: Add a pill-style helper map and a dot-rendering helper to the frontmatter**

Insert this block in the frontmatter of `src/pages/comparison.astro`, immediately after the `const familyToSurfaces = ...` block:

```ts
const familyPillClass: Record<Family, string> = {
  'vendor-challenge': 'bg-indigo-100 text-indigo-800',
  'cross-origin': 'bg-amber-100 text-amber-800',
  'fingerprinting': 'bg-cyan-100 text-cyan-800',
  'vision-only': 'bg-pink-100 text-pink-800',
  'windowed-dom': 'bg-orange-100 text-orange-900',
  'dynamic-selectors': 'bg-green-100 text-green-800',
  'behavioural': 'bg-violet-100 text-violet-800',
};

function dotRow(effort: number, tone: 'pw' | 'aiva'): string {
  const onColor = tone === 'pw' ? 'bg-rose-600' : 'bg-emerald-600';
  return [1, 2, 3, 4, 5]
    .map((i) =>
      i <= effort
        ? `<span class="inline-block h-1.5 w-1.5 rounded-full ${onColor}"></span>`
        : `<span class="inline-block h-1.5 w-1.5 rounded-full bg-slate-200"></span>`,
    )
    .join('');
}

function demoTag(ref: { section: 'bd' | 'sr'; n: number }): { label: string; href: string } {
  const section = ref.section === 'bd' ? 'bot-detection' : 'selector-resistance';
  const label = `${ref.section.toUpperCase()}-${ref.n}`;
  return { label, href: `/${section}/level-${ref.n}/` };
}
```

- [ ] **Step 5.2: Replace the table placeholder with the rendered table**

In `src/pages/comparison.astro`, replace the line `<p class="mt-10 text-sm text-slate-400">[table renders here in Task 5]</p>` with this block:

```astro
<div class="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
  <table class="w-full text-sm">
    <thead class="bg-slate-100 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      <tr>
        <th class="px-4 py-2.5 w-1/2">Surface</th>
        <th class="px-4 py-2.5">Playwright</th>
        <th class="px-4 py-2.5">AIVA <span class="font-normal normal-case text-slate-400">(agentic, from /report)</span></th>
        <th class="px-4 py-2.5">Demo</th>
      </tr>
    </thead>
    <tbody>
      {familyOrder.map((family) => (
        familyToSurfaces[family].length === 0 ? null : (
          <Fragment>
            <tr class="bg-slate-900 text-slate-100">
              <td colspan="4" class="px-4 py-2">
                <span class={`rounded-full ${familyPillClass[family]} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide`}>
                  {familyLabels[family]}
                </span>
                <span class="ml-2 text-[11px] text-slate-400">{familyToSurfaces[family].length} surface{familyToSurfaces[family].length === 1 ? '' : 's'}</span>
                <span class="ml-3 text-[11px] text-slate-400">{familyBlurbs[family]}</span>
              </td>
            </tr>
            {familyToSurfaces[family].map((s) => {
              const demo = demoTag(s.levels[0]);
              return (
                <Fragment>
                  <tr class="border-t border-slate-200 cursor-pointer hover:bg-slate-50" data-row={s.id}>
                    <td class="px-4 py-3 align-top">
                      <div class="font-semibold text-slate-900">{s.title}</div>
                      <div class="mt-1 text-xs text-slate-500" set:html={s.examples} />
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span class={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.playwright.verdict === 'impossible' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'}`}>
                        {s.playwright.verdict === 'impossible' ? 'Impossible' : 'Possible'}
                      </span>
                      <div class="mt-1.5 flex gap-0.5" set:html={dotRow(s.playwright.effort, 'pw')} />
                    </td>
                    <td class="px-4 py-3 align-top">
                      <span class={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.aiva.verdict === 'native' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {s.aiva.verdict === 'native' ? 'Native' : 'Needs fix'}
                      </span>
                      <div class="mt-1.5 flex gap-0.5" set:html={dotRow(s.aiva.effort, 'aiva')} />
                    </td>
                    <td class="px-4 py-3 align-top">
                      <a
                        href={demo.href}
                        class="font-mono text-[11px] text-sky-700 hover:text-sky-900"
                        data-demo-link
                      >{demo.label} ↗</a>
                    </td>
                  </tr>
                  <tr class="hidden border-t border-slate-100 bg-slate-50" data-detail={s.id}>
                    <td colspan="4" class="px-4 py-3 text-xs leading-relaxed text-slate-600" set:html={s.expanded} />
                  </tr>
                </Fragment>
              );
            })}
          </Fragment>
        )
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 5.3: Run dev server and visit the page**

Run: `npm run dev`
Open: `http://localhost:4321/comparison`
Confirm: full grouped table renders with 7 family sections, 13 rows. Each row shows title + examples + Playwright pill + dots + AIVA pill + dots + demo link. Detail rows are hidden (we wire click-to-expand in Task 6).

- [ ] **Step 5.4: Typecheck and build**

Run: `npm run check && npm run build`
Expected: zero errors; build succeeds.

- [ ] **Step 5.5: Commit**

```bash
git add src/pages/comparison.astro
git commit -m "feat(comparison): render grouped table with 13 surfaces

Family sections in spec order, rows ordered by severity within.
Detail rows present in the DOM but hidden — click-to-expand wiring
added in the next commit."
```

---

## Task 6: Row click-to-expand interactivity

Add the ~20 lines of inline vanilla JS that toggle a row's detail visibility on click. Demo links inside the row stop propagation so they navigate without triggering expand.

**Files:**
- Modify: `src/pages/comparison.astro` (add a `<script>` block before `</body>`)

- [ ] **Step 6.1: Add the inline expand-script before `</body>`**

In `src/pages/comparison.astro`, immediately before the closing `</body>` tag (after the `<footer>` element), insert:

```astro
    <script is:inline>
      document.querySelectorAll('[data-row]').forEach((row) => {
        const id = row.getAttribute('data-row');
        const detail = document.querySelector(`[data-detail="${id}"]`);
        if (!detail) return;

        row.addEventListener('click', () => {
          const isOpen = !detail.classList.contains('hidden');
          if (isOpen) {
            detail.classList.add('hidden');
            row.removeAttribute('data-expanded');
          } else {
            detail.classList.remove('hidden');
            row.setAttribute('data-expanded', '');
          }
        });
      });

      document.querySelectorAll('[data-demo-link]').forEach((link) => {
        link.addEventListener('click', (e) => e.stopPropagation());
      });
    </script>
```

- [ ] **Step 6.2: Run dev server and test interactivity**

Run: `npm run dev`
Open: `http://localhost:4321/comparison`
Confirm:
- Clicking any row reveals its detail block (the `expanded` HTML).
- Re-clicking the same row hides it.
- Clicking the demo link (e.g. `BD-5 ↗`) navigates to the level page **without** also expanding the row.
- All 13 rows expand/collapse independently.

- [ ] **Step 6.3: Build**

Run: `npm run build`
Expected: build succeeds; `dist/comparison/index.html` exists.

- [ ] **Step 6.4: Commit**

```bash
git add src/pages/comparison.astro
git commit -m "feat(comparison): row click-to-expand toggles detail block

Demo links use stopPropagation so navigating to the level page
does not also toggle the row."
```

---

## Task 7: Add the "Comparison" nav link to every page that has a nav

Header nav order: **Comparison · Failure report · Other use-cases · About · GitHub**. Five files touch the same pattern. Identical insertion in each.

**Files:**
- Modify: `src/components/LevelLayout.astro:85-90` (nav block)
- Modify: `src/pages/index.astro:46-52` (nav block)
- Modify: `src/pages/about.astro` (nav block — find and modify)
- Modify: `src/pages/report.astro` (nav block — find and modify)
- Modify: `src/pages/other-usecases.astro` (nav block — find and modify)

- [ ] **Step 7.1: Add Comparison link to `LevelLayout.astro`**

In `src/components/LevelLayout.astro`, find the block:

```astro
<nav class="flex gap-4 text-sm text-slate-600">
  <a href="/report" class="hover:text-slate-900">Failure report</a>
```

Replace with:

```astro
<nav class="flex gap-4 text-sm text-slate-600">
  <a href="/comparison" class="hover:text-slate-900">Comparison</a>
  <a href="/report" class="hover:text-slate-900">Failure report</a>
```

- [ ] **Step 7.2: Add Comparison link to `index.astro`**

In `src/pages/index.astro`, find the same block (same nav pattern) and apply the same change.

- [ ] **Step 7.3: Add Comparison link to `about.astro`**

In `src/pages/about.astro`, find the nav block (it has the same shape) and apply the same change.

- [ ] **Step 7.4: Add Comparison link to `report.astro`**

In `src/pages/report.astro`, find the nav block (it has the same shape) and apply the same change.

- [ ] **Step 7.5: Add Comparison link to `other-usecases.astro`**

In `src/pages/other-usecases.astro`, find the nav block (it has the same shape) and apply the same change.

- [ ] **Step 7.6: Verify each nav renders**

Run: `npm run dev`
Open in turn: `/`, `/about`, `/report`, `/other-usecases`, `/bot-detection/level-1/`.
Confirm: each page shows "Comparison" as the first nav link, and clicking it lands on `/comparison`.

- [ ] **Step 7.7: Typecheck and build**

Run: `npm run check && npm run build`
Expected: zero errors; build succeeds.

- [ ] **Step 7.8: Commit**

```bash
git add src/components/LevelLayout.astro src/pages/index.astro src/pages/about.astro src/pages/report.astro src/pages/other-usecases.astro
git commit -m "feat(nav): add /comparison link to every page's header nav

Nav order: Comparison · Failure report · Other use-cases · About · GitHub."
```

---

## Task 8: Add a landing-page CTA card for `/comparison`

Add a third CTA next to the existing "Start at Level 1" and "See the Playwright failure report" buttons.

**Files:**
- Modify: `src/pages/index.astro:64-83` (the CTA block)

- [ ] **Step 8.1: Add the new CTA button**

In `src/pages/index.astro`, find this block:

```astro
<div class="mt-8 flex flex-wrap gap-3">
  <a
    href="/bot-detection/level-1/"
    class="inline-block rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
  >
    Start at Level 1 →
  </a>
  <a
    href="/report"
    class="inline-block rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
  >
    See the Playwright failure report
  </a>
```

Immediately after the second `</a>` (the "Playwright failure report" one), insert:

```astro
  <a
    href="/comparison"
    class="inline-block rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
  >
    Compare Playwright vs AIVA →
  </a>
```

- [ ] **Step 8.2: Verify the landing page shows the new CTA**

Run: `npm run dev`
Open: `http://localhost:4321/`
Confirm: three CTAs in a row — "Start at Level 1 →", "See the Playwright failure report", "Compare Playwright vs AIVA →". The new one links to `/comparison`.

- [ ] **Step 8.3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(landing): add CTA card linking to /comparison"
```

---

## Task 9: Final verification

Full smoke pass over the new page, the refactored report page, and the nav across the site.

- [ ] **Step 9.1: Typecheck + tests + build pass**

Run: `npm run check && npm test && npm run build`
Expected: zero TS errors, all Vitest tests pass (including the two `surfaces.test.ts` invariants), build succeeds.

- [ ] **Step 9.2: Manual smoke check**

Run: `npm run dev`

For each of the following, open the page and confirm the listed expectations:

- `/` — three CTAs visible; "Compare Playwright vs AIVA →" goes to `/comparison`.
- `/comparison` — 7 family section headers, 13 rows ordered as per spec. Clicking any row expands its detail; re-clicking collapses. Clicking a demo link (e.g. `BD-5`) navigates to the level page without expanding the row.
- `/report` — page renders identically to before the refactor; same 13 level cards, same copy.
- `/about`, `/other-usecases`, `/bot-detection/level-1/`, `/selector-resistance/level-1/` — all show "Comparison" as the first nav link.

- [ ] **Step 9.3: No additional commit needed**

This task is verification only. If any step fails, return to the relevant earlier task, fix, and re-commit.

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. Page contract → Tasks 4–6 and 7–8 (nav + CTA); Data model → Tasks 2–3; File-level architecture → Tasks 1–8 collectively; Testing → Task 2/3 (Vitest) and Task 9 (manual + build).
- **Drift safety:** all AIVA values are computed at build time via `deriveVerdicts(resolveLevel(...))` in `surfaces.ts`. Changing a value in `/report`'s data flows to `/comparison` automatically. The Vitest in Task 2 enforces both invariants the spec calls out.
- **`Fragment` import:** Astro's `<Fragment>` is a built-in component — no import needed.
- **No new dependencies:** Vitest, happy-dom, Tailwind, Astro, Preact are all already in `package.json`.
