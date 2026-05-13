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

/** Look up a level by its LevelRef. `ref.n` is local-within-section (BD: 1..5, SR: 1..8). */
export function resolveLevel(ref: LevelRef): LevelReport {
  const sectionName: LevelReport['section'] =
    ref.section === 'bd' ? 'Bot detection' : 'Selector resistance';
  const sectionLevels = levels
    .filter((l) => l.section === sectionName)
    .sort((a, b) => a.n - b.n);
  const level = sectionLevels[ref.n - 1];
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
  // fixes.length > 0 is guaranteed by the guard above; Math.min is safe.
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

/**
 * Builds a Surface by deriving playwright/aiva verdicts from its first (primary) level.
 * v1 has exactly one level per surface; multi-level aggregation is reserved for future use,
 * and additional entries in `partial.levels` are currently ignored.
 */
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
    title: 'Cross-origin iframe (Stripe Elements / embedded widgets)',
    family: 'cross-origin',
    examples: 'embedded third-party iframes &mdash; Stripe Elements card fields, YouTube / Vimeo players, social embeds',
    levels: [{ section: 'sr', n: 7 }],
    expanded:
      'Playwright operates outside the page\'s JS sandbox, so <code>frameLocator</code> reaches into cross-origin iframes routinely &mdash; Stripe even ships official Playwright testing patterns for filling card fields. The friction is real but not categorical: test authors must know which iframe holds the target and need stable inner selectors. The arena\'s <code>data:</code> URI demo is a corner case (opaque origins defeat URL-based frame matching) but selector-based matching still works. Auth0 Universal Login is <em>not</em> an iframe in production (X-Frame-Options blocks embedding, it is a top-level redirect); Cloudflare Turnstile is a separate vendor-challenge problem covered in BD-5, not an iframe-boundary problem. AIVA reads pixels, so frame boundaries are invisible to it.',
  }),
  build({
    id: 'closed-shadow-dom',
    title: 'Web-component shadow DOM (Salesforce LWC / SAP UI5 / ServiceNow)',
    family: 'cross-origin',
    examples: 'enterprise apps built on web components; closed-mode is the demo worst case, open shadow is the production norm',
    levels: [{ section: 'sr', n: 3 }],
    expanded:
      'The arena demos <code>attachShadow({ mode: \'closed\' })</code> directly, but in production this is rare: Salesforce LWC uses synthetic or open shadow, SAP UI5 and ServiceNow Now Experience both use open shadow. Playwright can pierce closed shadow by monkey-patching <code>Element.prototype.attachShadow</code> in an <code>addInitScript</code> hook so subsequent shadow roots open &mdash; but timing is brittle and not the default. The real production friction is deep shadow nesting and framework-specific selector conventions, not the seal itself. AIVA reads pixels, so the shadow mode is invisible to it.',
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
