import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

// Target: https://demo.tsplus.net/ — TSplus' public HTML5 RDP demo
// (credentials demo/demo, advertised on tsplus.net/demo-server/). After
// login the apps portal lists Word / Excel / PowerPoint / Foxit / Notepad
// as DOM tiles. Clicking the Excel tile opens the RemoteApp in a new
// browser tab as a single HTML5 <canvas> driven over WebSocket — the
// textbook streamed-desktop failure case for selector-based automation.
//
// The story this spec tells:
//   Variant A — naive DOM-based drive. Try what a Playwright user writes
//   first: `getByText("Blank workbook").click()`, `getByRole("gridcell",
//   { name: "A1" }).fill(...)`. Every selector returns zero matches
//   because the entire Excel UI is canvas pixels, not DOM. The test
//   times out on the first such locator. THIS IS THE REAL RESULT for
//   any streamed-desktop session — Citrix HDX, VMware Horizon Blast,
//   Microsoft AVD, TSplus, Cameyo, Apache Guacamole all hit the same wall.
//
//   Variant B — pixel-coordinate hack. Kept to be candid about what it
//   would take to drive Excel-on-canvas from Playwright. This variant
//   abandons selectors entirely and uses hard-coded canvas-pixel
//   coordinates for both "Blank workbook" and A1, plus Office-2019+
//   Escape shortcut, plus the TSplus clipboard-sync side channel. It
//   "passes" — but only because we knew all four of:
//     (i)   where the Blank-workbook tile sits at 1280x720,
//     (ii)  where A1 sits at 1280x720 with the current ribbon/theme,
//     (iii) that Escape dismisses the Office 2019+ Start screen,
//     (iv)  that demo.tsplus.net redirects the remote Windows clipboard
//           back to the browser (most production Citrix / Horizon / AVD
//           deployments DISABLE clipboard redirection by policy because
//           it's the exfiltration vector compliance teams are closing).
//   Change any one of those four prior-knowledge inputs and Variant B
//   breaks. It is not a generalisable Playwright approach — it is a
//   brittle, app-version-specific pixel hack. We keep it here as
//   evidence of what stock Playwright cannot do without OCR / vision /
//   a real-pixel agent.

const SUT_URL = 'https://demo.tsplus.net/';
const USERNAME = 'demo';
const PASSWORD = 'demo';
const CELL_VALUE = 'Hello world';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.resolve(__dirname, '..', '..', 'public', 'external');

async function shot(page: Page, prefix: string, name: string): Promise<void> {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS_DIR, `tsplus-excel-${prefix}${name}.png`),
    fullPage: false,
  });
}

/**
 * Login to the TSplus Web Portal, click the Microsoft Excel tile, and
 * return the new tab holding the HTML5 RDP canvas. Both variants share
 * this — it is the real-DOM half of the flow that Playwright handles
 * fine. Diverges only on what happens inside the canvas.
 *
 * Subtle wiring gotcha worth flagging: the Log-on `<input type="button"
 * id="buttonLogOn">` has NO onclick handler on page load. The handler
 * is only assigned by `enableLogonButton()`, which is itself only
 * called from the callback of a 2-factor-auth probe XHR (POST
 * `cgi-bin/hb.exe`) that fires from the username field's `onblur`. So
 * the wiring is: fill username → blur username → 2FA XHR → handler
 * attached → click works. We mimic this with Tab between fills + a
 * `waitForResponse` race so the click lands on a wired button.
 */
async function loginAndOpenExcel(
  page: Page,
  context: BrowserContext,
  prefix: string,
): Promise<Page> {
  await page.goto(SUT_URL, { waitUntil: 'domcontentloaded' });
  await shot(page, prefix, '01-landing');

  const userInput = page.locator('input[name="username"], #Editbox1').first();
  const pwdInput = page
    .locator('input[name="Password"], #Editbox2, input[type="password"]')
    .first();
  await userInput.waitFor({ state: 'visible', timeout: 30_000 });
  await userInput.click();
  await userInput.fill(USERNAME);

  // Race the 2FA-status XHR so we know enableLogonButton has been called
  // by the time we try to click.
  const twoFaXhr = page
    .waitForResponse(
      (resp) => /\/cgi-bin\/hb\.exe/i.test(resp.url()) && resp.status() === 200,
      { timeout: 20_000 },
    )
    .catch(() => null);
  await userInput.press('Tab');
  await pwdInput.fill(PASSWORD);
  await twoFaXhr;
  await shot(page, prefix, '02-credentials-typed');

  await page.waitForFunction(
    () =>
      (document.getElementById('buttonLogOn') as HTMLInputElement | null)
        ?.onclick !== null,
    { timeout: 15_000 },
  );
  await page.locator('#buttonLogOn').first().click();

  await page.waitForURL(/index_applications\.html/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
  await shot(page, prefix, '03-apps-portal');

  const excelTile = page
    .getByRole('link', { name: /excel/i })
    .or(page.getByRole('button', { name: /excel/i }))
    .or(page.locator('[title*="Excel" i], [alt*="Excel" i]'))
    .or(page.locator('a, div').filter({ hasText: /^Microsoft Excel$|^Excel$/i }))
    .first();
  await excelTile.waitFor({ state: 'visible', timeout: 30_000 });
  await shot(page, prefix, '04-excel-tile-visible');

  // Tile click opens the RemoteApp in a new browser tab.
  const newPagePromise = context
    .waitForEvent('page', { timeout: 15_000 })
    .catch(() => null);
  await excelTile.click();
  const appPage = (await newPagePromise) ?? page;
  await appPage.bringToFront();
  await appPage.waitForLoadState('domcontentloaded').catch(() => {});

  // Wait for the canvas itself to mount. After this point, the body
  // contains exactly one <canvas id="JWTS_myCanvas"> inside one
  // <div id="RDP_JW_TS"> overlay and zero <input>/<textarea> elements
  // (probed at runtime against document.body.children).
  const canvas = appPage.locator('canvas#JWTS_myCanvas, canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 60_000 });
  await shot(appPage, prefix, '05-canvas-mounted');

  // Give the RDP session + Excel cold-start time to paint the Start
  // screen. There is no DOM signal to wait on — fixed sleep is the only
  // option once we cross the canvas boundary.
  await appPage.waitForTimeout(12_000);
  await shot(appPage, prefix, '06-after-warmup');

  return appPage;
}

test.describe('TSplus Demo — Excel inside an HTML5 RDP canvas', () => {
  test.setTimeout(180_000);
  test.use({ ignoreHTTPSErrors: true });

  // ----------------------------------------------------------------------
  // Variant A — Naive DOM-based drive against the streamed Excel UI.
  //
  // Tries the canonical Playwright approach a developer would write
  // first: locate the "Blank workbook" tile by visible text, locate the
  // A1 cell by accessible name, assert the cell holds the typed value
  // afterwards. Every selector returns zero matches because the entire
  // Excel UI is canvas pixels. The test fails on the first locator's
  // toBeVisible() timeout — that is the real result.
  // ----------------------------------------------------------------------
  test(
    'A. naive — DOM selectors against the canvas',
    { tag: '@external' },
    async ({ page, context }) => {
      const appPage = await loginAndOpenExcel(page, context, 'A-naive-');

      // First locator a Playwright user would write: find the
      // "Blank workbook" tile on the Excel Start screen by its visible
      // label and click it. The tile is painted into the canvas; the
      // locator resolves to zero elements and toBeVisible() times out.
      const blankTile = appPage.getByText(/^Blank workbook$/i).first();
      await expect(
        blankTile,
        'Excel Start-screen "Blank workbook" tile should be reachable from the DOM — it is not, because the Start screen is painted into the canvas',
      ).toBeVisible({ timeout: 10_000 });
      await blankTile.click();

      // Unreachable in practice (the assertion above fails first), but
      // recorded so a reader of the spec can see the next two naive
      // selectors a developer would write — and verify that they too
      // resolve to zero matches against the canvas:
      const a1Cell = appPage
        .getByRole('gridcell', { name: 'A1' })
        .or(appPage.locator('[aria-label="A1"]'));
      await expect(a1Cell).toBeVisible({ timeout: 10_000 });
      await a1Cell.fill(CELL_VALUE);
      await expect(a1Cell).toHaveText(CELL_VALUE);
    },
  );

  // ----------------------------------------------------------------------
  // Variant B — Best-effort pixel-coordinate hack.
  //
  // Kept to be candid about what it would take to drive Excel-on-canvas
  // from stock Playwright. This variant abandons selectors entirely.
  // The four pieces of prior knowledge it requires:
  //
  //   (i)   Blank-workbook tile is at canvas pixel (270, 211) at 1280x720.
  //         A different theme / DPI / Office version moves it.
  //   (ii)  Pressing Escape twice closes the Office 2019+ Start screen.
  //         Office 2016 (pre-Backstage Start screen) responds differently.
  //   (iii) A1 sits at canvas pixel (58, 237) at 1280x720 with the
  //         current ribbon / formula-bar / font configuration.
  //   (iv)  demo.tsplus.net redirects the remote Windows clipboard back
  //         to the browser, AND we have been granted clipboard-read
  //         permission for the origin. Most production Citrix /
  //         Horizon / AVD deployments DISABLE remote-clipboard sync by
  //         policy because it's the exfiltration vector compliance
  //         teams are trying to close.
  //
  // Change any one of those four and Variant B breaks. This is the
  // upper bound of what selector-based automation can do against a
  // streamed-desktop session, not a generalisable approach.
  // ----------------------------------------------------------------------
  test(
    'B. best-effort — pixel coords + Office shortcut + clipboard sync (NOT a real solution)',
    { tag: '@external' },
    async ({ page, context }) => {
      // (iv): Grant clipboard read/write so the only working readback
      // path (Ctrl+C → navigator.clipboard.readText()) can run.
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: 'https://demo.tsplus.net',
      });

      const appPage = await loginAndOpenExcel(page, context, 'B-besteffort-');
      const canvas = appPage.locator('canvas#JWTS_myCanvas, canvas').first();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('canvas has no bounding box');

      // The canvas has no tabindex (confirmed by probing
      // document.body.children at runtime), so it cannot receive
      // keyboard focus the normal way. JWS only forwards keystrokes
      // after a mousedown gesture on the canvas. Click neutral
      // whitespace at (640, 700) to give the gesture without
      // accidentally activating any tile.
      await appPage.mouse.move(box.x + 640, box.y + 700, { steps: 15 });
      await appPage.mouse.click(box.x + 640, box.y + 700);
      await appPage.waitForTimeout(600);

      // (ii): Escape twice dismisses the Office 2019+ Start screen and
      // drops us into Book1.
      await appPage.keyboard.press('Escape');
      await appPage.waitForTimeout(1_500);
      await appPage.keyboard.press('Escape');
      await appPage.waitForTimeout(6_000);
      await shot(appPage, 'B-besteffort-', '07-after-escape');

      // (iii): A1 by hardcoded canvas pixel position. Belt-and-braces
      // Ctrl+Home for tiny DPI drift.
      await appPage.mouse.move(box.x + 58, box.y + 237, { steps: 15 });
      await appPage.mouse.click(box.x + 58, box.y + 237);
      await appPage.waitForTimeout(600);
      await appPage.keyboard.press('Control+Home');
      await appPage.waitForTimeout(500);
      await shot(appPage, 'B-besteffort-', '08-a1-selected');

      // Type via the canvas. Keystrokes are forwarded over WebSocket as
      // RDP scancodes — this part is the one piece of the streamed-app
      // surface Playwright can drive without prior knowledge.
      await appPage.keyboard.type(CELL_VALUE, { delay: 60 });
      await shot(appPage, 'B-besteffort-', '09-typed-before-commit');
      await appPage.keyboard.press('Enter');
      await appPage.waitForTimeout(1_500);
      await shot(appPage, 'B-besteffort-', '10-a1-committed');

      // (iv): Readback via the clipboard side channel.
      await appPage.keyboard.press('Control+Home');
      await appPage.waitForTimeout(400);
      await appPage.keyboard.press('Control+C');
      await appPage.waitForTimeout(1_000);
      const clipboardText = await appPage
        .evaluate(() => navigator.clipboard.readText())
        .catch(() => null);
      await shot(appPage, 'B-besteffort-', '11-final');

      console.log(
        `[tsplus-excel] Variant B clipboard readback: ${JSON.stringify(clipboardText)}`,
      );

      // Assert iff the clipboard side channel was open. If it was not,
      // Variant B has no Playwright-only readback path at all.
      expect(
        clipboardText && clipboardText.trim().length > 0,
        'Variant B requires remote-clipboard sync — if disabled by policy (the default in regulated enterprises), even the pixel-hack has no readback path',
      ).toBe(true);
      expect(clipboardText!.trim()).toBe(CELL_VALUE);
    },
  );
});
