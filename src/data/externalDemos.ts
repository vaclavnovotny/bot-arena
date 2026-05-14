export interface ExternalDemo {
  id: 'odoo-spreadsheet';
  title: string;
  category: string;
  demoUrl: string;
  goal: string;
  steps: string[];
  /** May contain inline <code>...</code>. */
  problem: string;
  /**
   * Layered schema of where Playwright actually reaches in the SUT.
   * Rendered as a stacked diagram on the page. Status drives the colour:
   *  - 'reaches' → green check (Playwright works here)
   *  - 'fails'   → red cross   (this is where the test stops)
   *  - 'opaque'  → grey dot    (no DOM at all — only pixels)
   */
  layers: Array<{
    status: 'reaches' | 'fails' | 'opaque';
    name: string;
    /** May contain inline <code>...</code>. */
    detail: string;
  }>;
  /** Short line under the diagram explaining how AIVA sees it differently. */
  aivaFootnote: string;
  /** The actual Playwright spec, trimmed of bulk comments for readability. */
  testCode: string;
  /** One-line failure output we observe when we run it. */
  failureLine: string;
  /** Public path to the .webm recording captured by Playwright. */
  videoSrc: string;
  /** Public path to a poster image (the failure-screenshot) for the video. */
  posterSrc: string;
  /** Human-readable duration label, e.g. "23 s". */
  videoDuration: string;
  /** Public path to the AIVA proof recording (the same task, completed). */
  aivaVideoSrc: string;
  /** Short description of what the AIVA recording shows. */
  aivaVideoCaption: string;
  /** Public path to the AIVA platform's step-by-step log screenshot. */
  aivaStepsImageSrc: string;
  /** Caption rendered under the step-log screenshot. */
  aivaStepsCaption: string;
}

export const externalDemos: ExternalDemo[] = [
  {
    id: 'odoo-spreadsheet',
    title: 'Add a purchase order to Odoo Spreadsheet',
    category: 'Open-source ERP',
    demoUrl: 'https://testforme.odoo.com/odoo',
    goal: 'A procurement clerk needs to record a new incoming order — PO-2026-3123, 700 units of RM-3002 (Stainless 316L bar) from NorthSteel Foundry, due 2026-05-22, status Draft — in the company\'s Odoo Spreadsheet ERP workbook.',
    steps: [
      'Log in to Odoo and open the ERP workbook in the Documents app.',
      'Navigate to the Purchase Orders register.',
      'Open a new row above the TOTAL line for the incoming order.',
      'Fill in PO #, order date, supplier, SKU, description, qty, unit cost, net total, expected receipt and status.',
      'Save and verify the order was recorded.',
    ],
    problem:
      'The spreadsheet renders to a single <code>&lt;canvas&gt;</code>, and the chrome around it (Name Box, menus, formula bar) uses class names Odoo wraps differently from the <code>o-spreadsheet</code> library docs. Playwright never reaches the canvas — it can\'t get past the chrome.',
    layers: [
      {
        status: 'reaches',
        name: 'Outer Odoo DOM — login form, Documents app, file card',
        detail: 'Standard locators work here: <code>input[name="login"]</code>, <code>.o_kanban_record</code>, the Documents nav link. This is what the recording shows succeeding for the first ~10 seconds.',
      },
      {
        status: 'fails',
        name: 'o-spreadsheet chrome — Name Box, top-bar menus, sheet tabs, formula bar',
        detail: 'The library docs claim <code>.o-name-box</code>, <code>.o-topbar-menu</code>, <code>.o-sheet</code>, <code>.o-formula-bar</code>. Odoo\'s wrapped build exposes none of them — every documented selector resolves to zero elements. <strong>The test stops here</strong>, timing out on the first Name-Box click.',
      },
      {
        status: 'opaque',
        name: '<canvas> grid — every cell, gridline, total, conditional fill',
        detail: 'Painted into a single canvas element with no DOM children. Even if a future test author reverse-engineers the chrome selectors, no per-cell locator exists; verification has no DOM surface to assert against.',
      },
    ],
    aivaFootnote:
      'AIVA reads all three layers as rendered pixels — the layer separation doesn\'t apply. Login form, sheet tabs, and grid cells are visually identical inputs to the same vision model.',
    testCode: `import { test, expect, type Page } from '@playwright/test';

const START_URL = 'https://testforme.odoo.com/odoo';
const EMAIL = process.env.ODOO_EMAIL!;
const PASSWORD = process.env.ODOO_PASSWORD!;
const FILE_NAME = 'odoo-erp-mock';
const TOTAL_ROW_REF = 'A15';
const NEW_ROW_VALUES = [
  'PO-2026-3123', '2026-05-02', 'NorthSteel Foundry', 'RM-3002',
  'Stainless 316L bar — 60mm', '700', '14.20', '9940.00',
  '2026-05-22', 'Draft',
] as const;

test('insert a row in Purchase Orders, fill it, verify', async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Log in
  await page.goto(START_URL);
  if (page.url().includes('/web/login')) {
    await page.locator('input[name="login"]').fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/web/login'));
  }

  // 2. Open Documents → odoo-erp-mock.xlsx
  await page.getByRole('link', { name: /^Documents$/ }).click();
  await page
    .locator('.o_kanban_record, .o_data_row')
    .filter({ hasText: FILE_NAME })
    .first()
    .dblclick();
  await page.locator('.o-grid canvas').first().waitFor();

  // 3. Switch to Purchase Orders sheet (sheet tabs ARE real DOM)
  await page.locator('.o-sheet').filter({ hasText: /^Purchase Orders$/ }).first().click();

  // 4. Select A15 (TOTAL) and Insert → Row → Above
  await selectCellByReference(page, TOTAL_ROW_REF);
  await page.locator('.o-topbar-menu').filter({ hasText: /^Insert$/ }).first().click();
  await page.locator('.o-menu-item').filter({ hasText: /^Row(s)?$/i }).first().click();
  await page.locator('.o-menu-item').filter({ hasText: /Row\\s+above/i }).first().click();

  // 5. Re-select A15 (now empty) and type ten cells across
  await selectCellByReference(page, TOTAL_ROW_REF);
  for (let i = 0; i < NEW_ROW_VALUES.length; i++) {
    await page.keyboard.type(NEW_ROW_VALUES[i], { delay: 20 });
    await page.keyboard.press(i < NEW_ROW_VALUES.length - 1 ? 'Tab' : 'Enter');
  }

  // 6. Verify: re-select A15 and read the formula bar
  await selectCellByReference(page, TOTAL_ROW_REF);
  const composer = page
    .locator('.o-spreadsheet-topbar .o-composer, .o-formula-bar')
    .first();
  const value = (await composer.textContent())?.trim() ?? '';
  expect(value).toBe(NEW_ROW_VALUES[0]); // ← fails: returns "" under headless timing
});

// Name Box: real-DOM <input> at top-left of the grid that selects a cell
// by A1-reference. The only navigation path that works without per-cell DOM.
async function selectCellByReference(page: Page, ref: string) {
  const nameBox = page.locator('.o-name-box input, [class*="name-box"] input').first();
  await nameBox.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(ref);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
}`,
    failureLine: 'TimeoutError: locator.click: Timeout 15000ms exceeded.  waiting for locator(\'.o-name-box input, [class*="name-box"] input, …\').first()',
    videoSrc: '/external/odoo-spreadsheet-fails.webm',
    posterSrc: '/external/odoo-spreadsheet-fails.png',
    videoDuration: '23 s',
    aivaVideoSrc: '/external/odoo-spreadsheet-aiva.mp4',
    aivaVideoCaption:
      'AIVA driving the same Odoo Spreadsheet task end-to-end — selecting the TOTAL row, inserting the row above, typing the ten Purchase Order cells across, and verifying the result — by looking at the rendered pixels the same way a human operator does.',
    aivaStepsImageSrc: '/external/odoo-spreadsheet-aiva-steps.jpg',
    aivaStepsCaption:
      'The AIVA test-run log records every step it took on the canvas — clicking "TOTAL", opening Insert → Row above, typing each value, pressing Tab. The screenshot is exported from AIVA\'s test-runs viewer. Login credentials have been redacted for publication.',
  },
];
