import type { Family } from './surfaces';

export type FailureShape = 'read' | 'click' | 'drag';

export interface ExternalDemo {
  id: 'grafana' | 'onshape' | 'odoo';
  title: string;
  category: string;
  demoUrl: string;
  useCase: string;
  family: Family;
  failureShape: FailureShape;
  naive: {
    code: string;
    error: string;
  };
  bestEffort: {
    code: string;
    error: string;
    reasonItStillFails: string;
  };
  whyItFails: string;
  aivaContext: string;
}

export const externalDemos: ExternalDemo[] = [
  {
    id: 'grafana',
    title: 'Grafana Play — read a canvas-rendered panel value',
    category: 'Enterprise observability',
    demoUrl: 'https://play.grafana.org/d/hxne1Hm4z/1-time-series-features-detailed-overview',
    useCase:
      'Verify the latest p95 response time displayed on the API Latency panel is under 500 ms after a deploy.',
    family: 'vision-only',
    failureShape: 'read',
    naive: {
      code: `await page.goto(DASHBOARD_URL);
// The panel renders its value into a <canvas> via uPlot. There is no DOM
// text node containing the number that the human sees on the chart.
await expect(page.getByText(/^\\d{1,4}\\s?ms$/i)).toBeVisible({ timeout: 10_000 });`,
      error:
        'Error: expect(locator).toBeVisible() failed\n\nLocator: getByText(/^\\d{1,4}\\s?ms$/i)\nExpected: visible\nTimeout: 10000ms\nError: element(s) not found',
    },
    bestEffort: {
      code: `const panel = page.locator(\`[data-testid="data-testid Panel header \${PANEL_NAME}"]\`).first();
await expect(panel).toBeVisible({ timeout: 15_000 });

const buf = await panel.screenshot();
const text = await ocr(buf);

expect(text, \`OCR returned empty string\`).toBeTruthy();
const m = text.match(/(\\d{1,4})/);
if (m) {
  expect(Number(m[1])).toBeLessThan(10_000);
}`,
      error:
        '(test passes vacuously — OCR returns digits but cannot bind them to a timestamp)',
      reasonItStillFails:
        'OCR can return digits from the cropped panel screenshot, but those digits cannot be bound to a timestamp without parsing the x-axis — which is also rendered as canvas pixels. The "Lines" panel shows dimensionless TestData values in the range 0–100; any digits OCR extracts might come from axis tick labels, the legend, or chart values from an arbitrary time bucket. A passing test here represents no actual verification of the latest sample.',
    },
    whyItFails:
      'The panel value is rendered into the panel <code>&lt;canvas&gt;</code> by uPlot. There is no DOM text node containing the number the human sees. Selector-based reads return zero matches. Grafana Play (v11) does not expose <code>data-panel-name</code> attributes; panel containers are <code>&lt;section&gt;</code> elements identified by <code>data-testid</code>. Pixel-OCR on the panel screenshot works partially, but the test still cannot verify which time bucket the recognised number belongs to without parsing the x-axis — also canvas-rendered. The test is fundamentally trying to derive structured data from rendered pixels, which is exactly what AIVA does at the OS level.',
    aivaContext:
      'AIVA reads the panel value the same way a human does — by looking at the rendered pixels through the desktop session, with no expectation of a DOM. The same approach reads the x-axis labels for timestamp binding, the legend colours for series identity, and the title bar for panel identity, all in one pass.',
  },
  {
    id: 'onshape',
    title: 'Onshape Free — click a 3D face on a WebGL viewport',
    category: 'Engineering CAD',
    demoUrl: 'https://www.onshape.com/en/products/free',
    useCase:
      'After loading a part, click on the front face of the model to select it before taking a measurement.',
    family: 'vision-only',
    failureShape: 'click',
    naive: {
      code: `await signIn(page);
await page.goto(PART_STUDIO_URL);

// The WebGL viewport has no DOM children. There is no element named
// "Front face" to locate; the role query resolves to 0 elements.
await page.getByRole('button', { name: /front face/i }).click();

await expect(page.locator('[data-selected-face="front"]')).toBeVisible();`,
      error:
        '(test skipped: ONSHAPE_TEST_EMAIL not set). When run with creds: locator.click: 0 elements match getByRole(\'button\', { name: /front face/i })',
    },
    bestEffort: {
      code: `const viewport = page.locator('canvas[data-cy="graphics-canvas"]').first();
await expect(viewport).toBeVisible({ timeout: 30_000 });

const box = await viewport.boundingBox();
expect(box, 'WebGL canvas has a bounding box').not.toBeNull();

const { x, y } = canvasCentre(box!);
await page.mouse.click(x, y);

// The viewport centre is the front face only if the camera happens to be
// facing the model squarely. The default ISO view in Onshape lands the
// centre on an edge or a different face; the assertion fails.
await expect(page.locator('[data-selected-face]')).toHaveAttribute('data-selected-face', 'front');`,
      error:
        '(test skipped: ONSHAPE_TEST_EMAIL not set). When run with creds: TimeoutError waiting for [data-selected-face="front"]',
      reasonItStillFails:
        "The viewport centroid is only the front face if the camera happens to face the model squarely. Onshape's default ISO view orients the model at an angle, so the centroid lands on an edge or a different face. The test has no way to determine which face was actually selected without reading the Properties panel — which itself depends on the part exposing named faces as DOM attributes, something the WebGL renderer does not provide.",
    },
    whyItFails:
      'The WebGL viewport has no DOM children. Faces, edges, and vertices exist only as 3D geometry rendered by Onshape\'s rendering pipeline. There is no element named "Front face" to call <code>.click()</code> on — <code>getByRole(\'button\', { name: /front face/i })</code> resolves to 0 elements. A pixel-coordinate click works mechanically, but choosing which pixel requires reasoning about a rendered 3D scene at runtime. Picking the bounding-box centroid selects the wrong face on every camera angle that is not perfectly axis-aligned with the front face, and Onshape\'s default ISO view is deliberately not axis-aligned.',
    aivaContext:
      'AIVA reads the rendered viewport pixels and identifies the front face by visual reasoning over the rendered geometry — the same operation a human CAD engineer does at a glance. The viewport is just more pixels, identical in nature to a Citrix-streamed application or a legacy enterprise canvas surface.',
  },
  {
    id: 'odoo',
    title: 'Odoo demo — drag a Gantt task to reschedule it',
    category: 'Open-source ERP',
    demoUrl: 'https://demo.odoo.com/',
    useCase:
      'Reschedule the "Create new components" task two days right in the Project Gantt view to model a delay.',
    family: 'vision-only',
    failureShape: 'drag',
    naive: {
      code: `await page.goto(START_URL);
await page.waitForURL((url) => url.hostname.endsWith('.odoo.com') && url.pathname.startsWith('/odoo'), { timeout: 30_000 });

// Cells do NOT carry a data-date attribute (verified: only data-col and data-row-id exist).
// This locator resolves to 0 elements; dragTo() throws with "strict mode violation: 0".
const task = page.locator('.o_gantt_pill_wrapper')
  .filter({ has: page.locator('.o_gantt_pill_title', { hasText: /Create new components/i }) })
  .first();
const targetCell = page.locator('.o_gantt_cell[data-date="2026-06-12"]');
await task.dragTo(targetCell);`,
      error:
        'Error: locator.dragTo: Test timeout of 30000ms exceeded.\nCall log:\n  - waiting for locator(\'.o_gantt_cell[data-date="2026-06-12"]\')',
    },
    bestEffort: {
      code: `// Attempt to read a CSS var the demo bundle does not expose.
// Verified: --o-gantt-day-width is NOT set on :root or .o_gantt_view.
const raw = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--o-gantt-day-width'),
);
const dayWidth = parseCssLength(raw);
expect(dayWidth, 'demo bundle exposes a pixel day-width').not.toBeNull();

const task = page.locator('.o_gantt_pill').first();
const b = await task.boundingBox();
const startX = b!.x + 10;
const startY = b!.y + b!.height / 2;
const endX = startX + 2 * (dayWidth ?? 0);

await page.mouse.move(startX, startY);
await page.mouse.down();
await page.mouse.move(endX, startY, { steps: 20 });
await page.mouse.up();`,
      error:
        'Error: demo bundle exposes a pixel day-width\nexpect(received).not.toBeNull()\nReceived: null',
      reasonItStillFails:
        'The demo bundle does not expose a pixel-valued CSS variable for the Gantt day-column width; <code>parseCssLength()</code> returns <code>null</code> because <code>--o-gantt-day-width</code> is unset on the document root. Even if the pixel offset were guessed correctly from the bounding box geometry, Odoo\'s drag handler snaps to an internal data offset derived from the grid\'s zoom level — a pixel-perfect drop still lands on the wrong date because the snap logic is not exposed to the page.',
    },
    whyItFails:
      'The Gantt\'s day-cells in the demo build are not separate DOM nodes — verified selectors show <code>.o_gantt_cell</code> elements carry only <code>data-col</code> and <code>data-row-id</code>, with no <code>data-date</code> attribute. The target locator <code>.o_gantt_cell[data-date="2026-06-12"]</code> resolves to zero elements. Manual mouse drags require knowing the pixel offset per day, but the offset depends on the zoom level Odoo auto-sets from viewport size, and the drag handler\'s snap logic uses internal data offsets the page does not expose via any CSS variable or DOM attribute.',
    aivaContext:
      'AIVA recognises the Gantt cells by their rendered position and uses the snap-target visual cue — the highlight ring that appears under the cursor during a drag — to adjust the drop position until the snap target is the desired date, exactly as a human operator would.',
  },
];
