import { test, expect } from '@playwright/test';

// Target: an Odoo Enterprise trial running the Documents app with Spreadsheet.
// We log in, open a pre-uploaded xlsx, switch to the "Purchase Orders" sheet,
// insert a row above the TOTAL row, and fill ten cells across.
//
// Why this scenario is interesting for the Bot Arena:
//   The whole spreadsheet grid is rendered to a single <canvas>. There is no
//   DOM node for "the cell containing TOTAL", "the cell above TOTAL",
//   "column A row 15", or any other cell. Stock Playwright locators
//   (getByText, getByRole) cannot reach into the canvas — they only see the
//   chrome around it (top bar, sheet tabs, name box, dropdown menus).
//
//   This spec is the "best-effort" attempt that goes as far as Playwright
//   *can* go on a canvas grid:
//     - Cell selection is done by typing a reference (e.g. "A15") into the
//       Name Box, which IS a real DOM input above the grid.
//     - Data entry is done with page.keyboard.type() — once a cell is
//       selected, the composer captures keystrokes and Tab moves right.
//   The naive equivalent (page.getByText('TOTAL').click()) does not exist as
//   a working alternative; there is nothing to find.
//
// CREDENTIALS:
//   Provided via ODOO_EMAIL / ODOO_PASSWORD env vars. The test does not embed
//   defaults — see .env.example for setup against your own Odoo trial.
//
// SELECTORS:
//   o-spreadsheet (github.com/odoo/o-spreadsheet) is the library that powers
//   the canvas grid. Its class names (.o-spreadsheet, .o-topbar-menu,
//   .o-name-box, .o-sheet) are the load-bearing hooks; we use multiple
//   fallback selectors per element because Odoo's wrapper layer occasionally
//   adds an extra prefix or attribute. Expect one round of adjustment after a
//   first run against your specific Odoo version.

const START_URL = 'https://testforme.odoo.com/odoo';
const EMAIL = process.env.ODOO_EMAIL!;
const PASSWORD = process.env.ODOO_PASSWORD!;
const FILE_NAME = 'odoo-erp-mock';

// The row index of the TOTAL row in the Purchase Orders sheet of the
// generated workbook (1 header + 13 PO rows + 1 total = row 15).
const TOTAL_ROW_REF = 'A15';

// The 10 values to type into the new row, in column order A..J of the
// Purchase Orders sheet (PO #, Order Date, Supplier, SKU, Description, Qty,
// Unit Cost, Net Total, Expected Receipt, Status).
const NEW_ROW_VALUES = [
  'P',
  '2026-05-02',
  'Dalsi',
  'RM',
  'Haha',
  '1',
  '1',
  '1',
  '2026-05-22',
  'Draft',
] as const;

test.describe('Odoo Spreadsheet — insert a row in Purchase Orders', () => {
  // Odoo logins + spreadsheet boot are not fast; budget accordingly.
  test.setTimeout(180_000);

  test('best-effort: Name Box for cell selection, keyboard for data entry', { tag: '@external' }, async ({ page }) => {
    // ----------------------------------------------------------------------
    // Step 1: Navigate to the trial entry URL.
    // ----------------------------------------------------------------------
    await page.goto(START_URL);

    // testforme.odoo.com redirects to /web/login when no session cookie is
    // present. Wait for the login form to appear before interacting.
    await page.waitForURL(/\/(web\/login|odoo)/, { timeout: 30_000 });

    // ----------------------------------------------------------------------
    // Steps 2–6: Log in.
    // Odoo's login form uses input[name="login"] and input[name="password"]
    // with a single submit button.
    // ----------------------------------------------------------------------
    if (page.url().includes('/web/login')) {
      await page.locator('input[name="login"]').fill(EMAIL);
      await page.locator('input[name="password"]').fill(PASSWORD);
      await page.getByRole('button', { name: /log in/i }).click();
      // Wait until we leave the login page.
      await page.waitForURL((url) => !url.pathname.startsWith('/web/login'), { timeout: 30_000 });
    }

    // ----------------------------------------------------------------------
    // Step 7: Open the Documents app.
    // Try several entry points: the apps grid card, the systray launcher, or
    // a direct URL. Whichever the trial puts in front of us, one of these
    // resolves first.
    // ----------------------------------------------------------------------
    const documentsCard = page
      .locator('a, button')
      .filter({ hasText: /^Documents$/ })
      .first();

    try {
      await documentsCard.waitFor({ state: 'visible', timeout: 8_000 });
      await documentsCard.click();
    } catch {
      const base = new URL(page.url());
      await page.goto(`${base.origin}/odoo/documents`);
    }

    // The Documents app renders a kanban/list of files. Wait for any file row
    // to appear so we know the app loaded.
    await page.locator('.o_kanban_record, .o_data_row, .o_documents_kanban_record').first().waitFor({ timeout: 30_000 });

    // ----------------------------------------------------------------------
    // Step 8: Open the odoo-erp-mock spreadsheet.
    // Documents files appear as cards (kanban) or rows (list). Either way the
    // filename text is visible — we double-click whichever matches.
    // ----------------------------------------------------------------------
    const fileCard = page
      .locator('.o_kanban_record, .o_data_row, .o_documents_kanban_record')
      .filter({ hasText: new RegExp(FILE_NAME, 'i') })
      .first();
    await fileCard.waitFor({ timeout: 30_000 });
    await fileCard.dblclick();

    // The spreadsheet root mounts as .o-spreadsheet (o-spreadsheet library)
    // inside .o_spreadsheet (Odoo wrapper). Wait for the canvas grid to be
    // present before we touch anything else.
    const spreadsheet = page.locator('.o-spreadsheet, .o_spreadsheet').first();
    await spreadsheet.waitFor({ timeout: 60_000 });
    await page.locator('.o-grid canvas, .o-spreadsheet canvas').first().waitFor({ timeout: 30_000 });

    // ----------------------------------------------------------------------
    // Step 9: Click the "Purchase Orders" sheet tab.
    // Sheet tabs live in the bottom bar as real DOM elements (.o-sheet).
    // ----------------------------------------------------------------------
    const purchaseTab = page
      .locator('.o-sheet, .o-sheet-list .o-sheet, [class*="sheet-list"] [class*="sheet"]')
      .filter({ hasText: /^Purchase Orders$/ })
      .first();
    await purchaseTab.click();

    // Give the renderer a frame to repaint the new active sheet before we
    // start issuing keyboard navigation against it.
    await page.waitForTimeout(200);

    // ----------------------------------------------------------------------
    // Step 10: Select the TOTAL cell (A15) via the Name Box.
    //
    // CANVAS BOUNDARY — the TOTAL text is painted into the canvas; there is
    // no DOM node to click. The Name Box (top-left of the spreadsheet, above
    // column A's header) is the supported way to navigate selection by
    // reference. It's a real <input>.
    // ----------------------------------------------------------------------
    await selectCellByReference(page, TOTAL_ROW_REF);

    // ----------------------------------------------------------------------
    // Steps 11–13: Insert > Row > Above.
    //
    // Menus are real DOM (.o-topbar-menu in the top bar, .o-menu-item in
    // dropdowns). The exact label of the row-insertion submenu varies
    // slightly across Odoo / o-spreadsheet versions; we match permissively.
    // ----------------------------------------------------------------------
    await page
      .locator('.o-topbar-menu, [class*="topbar-menu"]')
      .filter({ hasText: /^Insert$/ })
      .first()
      .click();

    // The "Row" submenu (or "Insert row" depending on version).
    await page
      .locator('.o-menu-item, [class*="menu-item"]')
      .filter({ hasText: /^(Insert\s+)?Row(s)?$/i })
      .first()
      .click();

    // Flyout: "Row above" (sometimes labelled "Above" or "Insert row above").
    await page
      .locator('.o-menu-item, [class*="menu-item"]')
      .filter({ hasText: /(Row\s+above|^Above$|Insert row above)/i })
      .first()
      .click();

    // After the insert, the new empty row sits at A15 and TOTAL has shifted
    // to A16. o-spreadsheet usually moves selection to the inserted row, but
    // re-select via the Name Box so the test is deterministic.

    // ----------------------------------------------------------------------
    // Step 14: Re-select the empty cell at A15.
    // ----------------------------------------------------------------------
    await selectCellByReference(page, TOTAL_ROW_REF);

    // ----------------------------------------------------------------------
    // Steps 15–33: Type the ten values, Tab between them.
    //
    // Once a cell is selected, any printable keystroke opens the cell
    // composer. Tab commits the cell and advances selection one column to
    // the right. Enter commits and advances down (we use Enter on the last
    // value so we don't end up parked on the canvas with an open composer).
    // ----------------------------------------------------------------------
    for (let i = 0; i < NEW_ROW_VALUES.length; i++) {
      await page.keyboard.type(NEW_ROW_VALUES[i], { delay: 20 });
      if (i < NEW_ROW_VALUES.length - 1) {
        await page.keyboard.press('Tab');
      } else {
        await page.keyboard.press('Enter');
      }
    }

    // ----------------------------------------------------------------------
    // Verification — and the punchline.
    //
    // We just wrote ten values across A15:J15. There is no DOM-based way to
    // read them back: the cells are painted to canvas. Three options exist:
    //   (a) Re-select A15 via Name Box, observe the value displayed in the
    //       formula bar (.o-spreadsheet-topbar input — DOM, readable). This
    //       proves a single cell at a time, not the whole row.
    //   (b) Trigger Ctrl+S, download the xlsx, and parse it with a library —
    //       expensive and depends on Odoo letting us export.
    //   (c) Pixel-OCR the canvas region — high effort, fragile.
    // Option (a) is what we use: it's the cheapest read-back path that does
    // not require leaving the browser.
    // ----------------------------------------------------------------------
    await selectCellByReference(page, TOTAL_ROW_REF);
    const formulaBarValue = await readFormulaBar(page);
    expect(formulaBarValue, 'A15 should hold the first value we typed').toBe(NEW_ROW_VALUES[0]);
  });
});

/**
 * Select a cell by typing a reference (e.g. "A15") into the Name Box.
 *
 * The Name Box is the small input at the top-left of the spreadsheet, above
 * column A's header. It's a real DOM input and is the canonical way to
 * navigate selection on a canvas grid without clicking on the canvas itself.
 *
 * Class variants observed across o-spreadsheet versions:
 *   .o-name-box-input, .o-name-box input, [class*="name-box"] input
 */
async function selectCellByReference(page: import('@playwright/test').Page, ref: string): Promise<void> {
  const nameBox = page
    .locator('.o-name-box input, .o-name-box-input, [class*="name-box"] input, [class*="cell-reference"] input')
    .first();
  await nameBox.click();
  // Clear any existing reference so our type() does not append.
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(ref);
  await page.keyboard.press('Enter');
  // Tiny settle: focus moves back to the grid composer after Enter.
  await page.waitForTimeout(80);
}

/**
 * Read the value displayed in the formula bar for the currently selected
 * cell. The formula bar (composer area) is real DOM, so we can read it
 * even though the cell on the grid is not.
 */
async function readFormulaBar(page: import('@playwright/test').Page): Promise<string> {
  const composer = page
    .locator('.o-spreadsheet-topbar .o-composer, .o-topbar-toolbar .o-composer, .o-formula-bar')
    .first();
  return (await composer.textContent())?.trim() ?? '';
}
