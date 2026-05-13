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
    title: 'Managed CAPTCHA (Turnstile / hCaptcha / Arkose)',
    family: 'vendor-challenge',
    examples: 'Cloudflare-fronted sign-ins, hCaptcha managed mode, Arkose FunCaptcha &mdash; closed-source client challenge + server-side token verification',
    levels: [{ section: 'bd', n: 5 }],
    expanded:
      'Third-party challenges run in a sandboxed iframe with server-side verification &mdash; the browser can render the widget, but only a real interactive user can pass it. Cloudflare Turnstile is the arena\'s specific demo; hCaptcha managed and Arkose FunCaptcha share the same architecture. Playwright cannot solve the production challenge on its own; paid solver services (Capsolver, 2Captcha, CapMonster) offer endpoints for all three vendors at a few cents per solve, which moves the problem from "impossible" to "outsourced to a third-party human-or-stealth farm". Agentic-AIVA can drive the challenge UI but still needs configuration to avoid being scored as a bot.',
  }),
  build({
    id: 'slider-captcha',
    title: 'Slider / drag CAPTCHA',
    family: 'vendor-challenge',
    examples: 'GeeTest, AWS WAF Bot Control (one of several challenge types), Ticketmaster, Alibaba',
    levels: [{ section: 'sr', n: 5 }],
    expanded:
      'The mechanical drag is trivial in Playwright &mdash; <code>page.mouse.down/move/up</code> with jittered tracks, plus <code>page.screenshot()</code> + OpenCV template matching for gap detection, is documented in several open-source GeeTest solvers. What\'s actually blocking is the server-side scoring: GeeTest, AWS WAF, Ticketmaster, and Alibaba layer mouse-event entropy, browser fingerprint, and TLS JA3 on top of the puzzle, so solving the visual gap alone returns a stale or invalid token. Paid solver services (Capsolver, 2Captcha, SadCaptcha) sell GeeTest v3/v4 and AWS WAF endpoints. AIVA\'s vision loop measures the gap and drags by the right number of pixels &mdash; same as a human &mdash; but the geometry needs tuning per vendor.',
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
    examples: 'legacy WYSIWYG editors (TinyMCE / CKEditor classic), web-mail composers (Gmail, Outlook Web), legacy intranet portals served from the same parent domain',
    levels: [{ section: 'sr', n: 4 }],
    expanded:
      'Page-scoped locators do not traverse frames, so the default <code>getByLabel(\'Email\')</code> call misses entirely. Playwright recovers with one <code>page.frameLocator(...)</code> call at the top of each test that touches the widget &mdash; <code>FrameLocator</code> supports the full <code>getBy*</code> API as a first-class chainable locator. Note that the payment / SSO iframes the page used to cite (Stripe Elements, Adyen, Braintree, Auth0) are <em>cross-origin by design</em> for PCI isolation; that\'s a different problem covered in the cross-origin iframe row. Genuine same-origin iframe surfaces in 2026 are mostly legacy editors and web-mail composers. AIVA does not see frames at all.',
  }),

  // ─── Fingerprinting ──────────────────────────────────────────────────
  build({
    id: 'fingerprint-battery',
    title: 'Fingerprint battery (canvas / audio / WebGL / fonts)',
    family: 'fingerprinting',
    examples: 'DataDome, PerimeterX, Imperva, Kasada &mdash; the headline signals every commercial bot screen samples (Akamai has shifted primarily to TLS-level fingerprinting)',
    levels: [{ section: 'bd', n: 4 }],
    expanded:
      'Bot screens fingerprint the browser through canvas rendering, audio context, WebGL renderer string, and installed fonts. Stealth-class plugins (<code>puppeteer-extra-plugin-stealth</code>, <code>rebrowser-patches</code>, Camoufox) handle the headline signals as their core competency &mdash; drop one in and stock Playwright passes the basic checks. The friction lives in the cat-and-mouse: detection vendors publish writeups identifying new tells (DataDome documents stealth\'s iframe-contentWindow leak), and staying current means tracking continuous package updates. AIVA runs in a regular desktop Chrome on a real Linux machine, so the fingerprint is genuinely a human\'s with no maintenance overhead.',
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
    title: 'Canvas-rendered UI (Photoshop Web / Photopea / tldraw / Miro / WASM games)',
    family: 'vision-only',
    examples: 'fully WASM-rendered apps; Figma and Google Sheets paint to canvas too but expose a parallel accessibility-tree DOM that Playwright can reach',
    levels: [{ section: 'sr', n: 1 }],
    expanded:
      'The arena demos the worst case: a single <code>&lt;canvas&gt;</code> with no DOM at all. In production the picture is more mixed. Figma ships a parallel accessibility-tree HTML layer for screen readers, and Playwright\'s <code>getByRole</code> / <code>page.accessibility.snapshot()</code> read exactly that tree. Google Sheets renders the grid to canvas but the cell editor, formula bar, toolbar, sidebars, and menus are real DOM. The genuinely opaque cases are fully-WebAssembly apps &mdash; Photoshop Web, Photopea, tldraw, Excalidraw, Miro\'s board surface, Unity/Unreal WASM games &mdash; where Playwright is reduced to <code>page.mouse.click(x, y)</code> driven by an external OCR or template-matching pipeline. AIVA reads pixels, so the split between "has accessibility tree" and "WASM-opaque" does not matter to it.',
  }),
  build({
    id: 'image-labels',
    title: 'Image-only labels (legacy PIN keypads / brokerage MFA)',
    family: 'vision-only',
    examples: 'legacy bank PIN keypads, brokerage MFA dialogs, occasional CAPTCHA-style number pads; major banks targeting WCAG 2.1/2.2 AA have largely moved away from this pattern',
    levels: [{ section: 'sr', n: 6 }],
    expanded:
      'Some legacy PIN entry surfaces render every digit as an inline SVG or PNG image with empty <code>alt</code> text &mdash; the label "8" is a tiny image, not a <code>&lt;text&gt;</code> node or accessible-name attribute. Playwright\'s <code>getByLabel</code> and <code>getByText</code> find nothing; only brittle structural selectors are left. The workaround (<code>page.screenshot()</code> + OCR + coordinate clicks) is documented but brittle. Note: WCAG-AA compliance has pushed most major banks (HSBC, Barclays, Lloyds) toward hardware card readers, biometric mobile PINs, or text inputs with client-side masking, so the "every bank does this" framing is dated. AIVA reads the rendered label the same way a human would.',
  }),

  // ─── Windowed DOM ────────────────────────────────────────────────────
  build({
    id: 'virtual-scrolling',
    title: 'Virtual scrolling / windowed list',
    family: 'windowed-dom',
    examples: 'AG Grid, TanStack Virtual, Slack history, Gmail, Notion databases',
    levels: [{ section: 'sr', n: 8 }],
    expanded:
      'Modern data-grids render only the rows currently in the viewport, so a test that wants the 500th row has to scroll the container and wait for the row to mount. The recipe is well-documented: AG Grid publishes an <a href="https://blog.ag-grid.com/writing-e2e-tests-for-ag-grid-react-tables-with-playwright/" class="text-sky-700 underline hover:text-sky-900">official Playwright E2E guide</a> with a <code>setupAgTestIds</code> helper, and LSEG maintains an open-source <code>ag-grid-playwright</code> bridge. The rough edges (per-library scroll APIs, <code>locator.count()</code> reporting only mounted rows, row+column virtualisation) keep this above 2/5 but well below "essentially impossible". AIVA\'s vision loop already scrolls-and-looks the way a human does &mdash; no list-specific code.',
  }),

  // ─── Dynamic selectors ───────────────────────────────────────────────
  build({
    id: 'dynamic-selectors',
    title: 'Dynamic / randomised selectors',
    family: 'dynamic-selectors',
    examples: 'apps with stripped accessibility metadata; some ticketing UIs (Ticketmaster) have occasional selector churn but lean on queue + fingerprinting',
    levels: [{ section: 'sr', n: 2 }],
    expanded:
      'When the app ships proper accessibility metadata, Playwright\'s <code>getByRole</code> / <code>getByLabel</code> / <code>getByText</code> are immune to id/name/class rerolling and this surface is close to 2/5. The arena\'s demo deliberately strips both the attributes and the accessibility tree, which forces brittle structural locators and pushes it closer to 4/5. CSS-in-JS framing (Tailwind, Emotion, styled-components) overstates the problem &mdash; Tailwind classes are stable utility strings and Emotion hashes are stable per style definition, not per request. AIVA does not depend on selectors at all &mdash; labels and positions on screen are stable across rerolls.',
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
