import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

// Target: https://demo.tsplus.net/ — TSplus' public HTML5 RDP demo portal.
// Credentials are static and advertised on tsplus.net/demo-server/: demo/demo.
// After login the portal at /index_applications.html exposes a grid of
// published applications (Excel, PowerPoint, Foxit, Notepad, Calculator).
// Each tile click opens a RemoteApp window in a new browser tab as a single
// HTML5 <canvas> driven over WebSocket — the textbook streamed-desktop
// failure case for stock browser automation.
//
// Why this scenario is interesting for the Bot Arena:
//   The login + apps grid are real DOM. The instant the Excel tile opens,
//   we cross into a canvas pixel stream. The Excel chrome — ribbon, formula
//   bar, sheet tabs, every grid cell — is painted into a <canvas>. No DOM
//   node exists for "cell A1", "the Blank workbook tile", or "the formula
//   bar text". getByRole / getByText return zero matches inside the canvas.
//
//   This spec is the "best-effort" attempt that goes as far as Playwright
//   *can* go on a streamed RemoteApp:
//     - The DOM-side flow (login form, Excel tile click) is normal Playwright.
//     - Once Excel is up, data entry leans on the fact that the canvas
//       captures keyboard events: page.keyboard.type() reaches the remote
//       Excel because TSplus forwards keystrokes as RDP scancodes.
//     - Verification falls back to a screenshot. There is no DOM-side way
//       to read A1 back; the canonical Playwright readbacks (textContent,
//       inputValue, ARIA tree) all return nothing.
//
// CREDENTIALS:
//   Public demo credentials (demo/demo), hardcoded. No env var needed —
//   they are advertised on tsplus.net's marketing page.
//
// TLS CAVEAT:
//   demo.tsplus.net's certificate is expired as of May 2026. We set
//   `ignoreHTTPSErrors: true` for this spec so the navigation proceeds.
//   A live click-through would show a browser warning; the recording does
//   not, which keeps the demo focused on the canvas boundary instead of
//   incidental cert noise.

const SUT_URL = 'https://demo.tsplus.net/';
const USERNAME = 'demo';
const PASSWORD = 'demo';
const CELL_VALUE = 'Hello world';

// Where Playwright drops the per-step screenshots that the /external page
// later embeds, resolved relative to the repo root.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.resolve(__dirname, '..', '..', 'public', 'external');

async function shot(page: Page, name: string): Promise<void> {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOTS_DIR, `tsplus-excel-${name}.png`),
    fullPage: false,
  });
}

test.describe('TSplus Demo — log in, open Excel, write Hello world into A1', () => {
  // RDP session boot inside the browser is not fast; budget accordingly.
  test.setTimeout(180_000);
  test.use({ ignoreHTTPSErrors: true });

  test(
    'best-effort: Excel inside an HTML5 RDP canvas',
    { tag: '@external' },
    async ({ page, context }) => {
      // Grant clipboard permissions for both demo.tsplus.net and its
      // RemoteApp tab. If the TSplus session is configured to sync the
      // remote Windows clipboard back to the browser, our Ctrl+C readback
      // at the end can hard-assert A1's content. If the demo host disabled
      // clipboard sync, the soft annotation path takes over.
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: 'https://demo.tsplus.net',
      });

      // --------------------------------------------------------------------
      // Step 1: Land on the TSplus demo portal. Expect a login form.
      // --------------------------------------------------------------------
      await page.goto(SUT_URL, { waitUntil: 'domcontentloaded' });
      await shot(page, '01-landing');

      // --------------------------------------------------------------------
      // Step 2–4: Log in.
      // TSplus' default Web Portal form uses input[name="user"] and
      // input[name="pwd"] with a submit button labelled "Log On". We match
      // permissively in case the demo skin renames things.
      // --------------------------------------------------------------------
      // The actual TSplus Web Portal markup:
      //   <input type="text"     name="username" id="Editbox1" onblur="onLoginTyped();">
      //   <input type="password" name="Password" id="Editbox2" onfocus="onPasswordFocused();">
      //   <input type="button"   id="buttonLogOn" value="Log on">
      // The Log-on button is an <input type="button"> (not <button>), so
      // button:has-text() doesn't match — target it by id.
      //
      // Less obvious: clicking the button on a fresh page does NOTHING because
      // `buttonLogOn.onclick` is only assigned by `enableLogonButton()`, which
      // is itself only called from the callback of a 2-factor-auth status XHR
      // (POST ./cgi-bin/hb.exe). That XHR is fired by `onLoginTyped`, which
      // is bound to `onblur` on the username field. So the wiring is:
      //   fill username → blur username → 2FA XHR → enableLogonButton.
      // We mimic the human flow with Tab to blur, then wait for the wiring.
      const userInput = page
        .locator('input[name="username"], #Editbox1')
        .first();
      const pwdInput = page
        .locator('input[name="Password"], #Editbox2, input[type="password"]')
        .first();
      await userInput.waitFor({ state: 'visible', timeout: 30_000 });
      await userInput.click();
      await userInput.fill(USERNAME);
      // Press Tab to fire onblur → onLoginTyped → 2FA-status XHR. Race the
      // network response so we know `enableLogonButton()` has been called by
      // the time we click. The endpoint is ./cgi-bin/hb.exe with action=twofa.
      const twoFaXhr = page
        .waitForResponse(
          (resp) => /\/cgi-bin\/hb\.exe/i.test(resp.url()) && resp.status() === 200,
          { timeout: 20_000 },
        )
        .catch(() => null);
      await userInput.press('Tab');
      await pwdInput.fill(PASSWORD);
      await twoFaXhr;
      await shot(page, '02-credentials-typed');

      // Belt-and-braces: also poll until the click handler is actually
      // attached before trying to click.
      await page.waitForFunction(
        () => (document.getElementById('buttonLogOn') as HTMLInputElement | null)?.onclick !== null,
        { timeout: 15_000 },
      );
      const submitBtn = page.locator('#buttonLogOn').first();
      await submitBtn.click();

      // --------------------------------------------------------------------
      // Step 5: Wait for the published-apps portal.
      // The post-login URL is /index_applications.html. The grid renders as
      // tiles (real DOM, one <a>/<div> per app with an <img> and label text).
      // --------------------------------------------------------------------
      await page.waitForURL(/index_applications\.html/, { timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');
      await shot(page, '03-apps-portal');

      // --------------------------------------------------------------------
      // Step 6: Click the Excel tile.
      // The tile is exposed with the visible label "Excel" (or "Microsoft
      // Excel"). Match by accessible name / text content; fall back to a
      // tile-with-Excel-image lookup if the text variant misses.
      // --------------------------------------------------------------------
      const excelTile = page
        .getByRole('link', { name: /excel/i })
        .or(page.getByRole('button', { name: /excel/i }))
        .or(page.locator('[title*="Excel" i], [alt*="Excel" i]'))
        .or(page.locator('a, div').filter({ hasText: /^Microsoft Excel$|^Excel$/i }))
        .first();
      await excelTile.waitFor({ state: 'visible', timeout: 30_000 });
      await shot(page, '04-excel-tile-visible');

      // The tile opens the RemoteApp in a new browser tab (target=_blank).
      // We race the popup event against the click and grab whichever page
      // ends up holding the canvas. Some TSplus portal builds open in the
      // same tab — handle both.
      const newPagePromise = context
        .waitForEvent('page', { timeout: 15_000 })
        .catch(() => null);
      await excelTile.click();
      const appPage = (await newPagePromise) ?? page;
      await appPage.bringToFront();
      await appPage.waitForLoadState('domcontentloaded').catch(() => {});

      // --------------------------------------------------------------------
      // CANVAS BOUNDARY
      //
      // The new tab's body is the TSplus HTML5 RDP client: a single <canvas>
      // driven over WebSocket. The actual Excel UI is painted into that
      // canvas. There is no DOM element for "cell A1", "the Blank workbook
      // tile", "the ribbon", or "the formula bar". Stock Playwright locators
      // stop at the canvas element and find nothing inside.
      //
      // What still works:
      //   - The canvas captures keyboard events. page.keyboard.type()
      //     reaches the remote Excel because TSplus forwards keystrokes as
      //     RDP scancodes.
      //   - The canvas also captures mouse events at (x, y) — but every
      //     click becomes a pixel-coordinate guess against a layout we
      //     cannot inspect.
      //
      // What does NOT work:
      //   - getByRole / getByText / getByLabel: zero matches inside the
      //     canvas.
      //   - Reading cell values back: cells are pixels.
      //   - Detecting render readiness: no DOM mutates after the canvas
      //     mounts — we are reduced to a fixed sleep waiting for the RDP
      //     session to finish negotiating + Excel to finish painting Book1.
      // --------------------------------------------------------------------
      // The TSplus html5.html shell is intentionally minimal — the body
      // contains exactly one <canvas id="JWTS_myCanvas"> inside a single
      // <div id="RDP_JW_TS"> overlay, and zero <input>/<textarea> elements.
      // Verified by snapshotting document.body.children at runtime. No
      // hidden text input exists to focus, so the canvas itself is the
      // only thing that can take input — and it has no tabindex, so
      // keyboard focus is only granted via a mousedown on it.
      const canvas = appPage.locator('canvas#JWTS_myCanvas, canvas').first();
      await canvas.waitFor({ state: 'visible', timeout: 60_000 });
      await shot(appPage, '05-canvas-mounted');

      // Wait for the RDP session + Excel cold-start. Timing is not
      // deterministic on the demo host — sometimes Excel auto-skips the
      // Start screen and opens Book1, sometimes it parks waiting for
      // input. We cannot read the canvas to tell which state we're in.
      await appPage.waitForTimeout(12_000);
      await shot(appPage, '06-after-warmup');

      // CANVAS BOUNDARY — give JWS its required input gesture, then drive
      // Excel to a clean "Book1 with A1 selected" state via keyboard only.
      //
      // Why click first: the canvas has no tabindex (confirmed by probing
      // document.body.children at runtime). JWS forwards keystrokes only
      // after a mousedown on the canvas makes it the input target —
      // without a click, keys go to document.body and are silently dropped.
      //
      // Why click an *empty* area: prior runs hard-coded the "Blank
      // workbook" tile pixel, but the tile sometimes responded with only a
      // hover-tooltip instead of activation, leaving us stranded on the
      // Start screen. Clicking near the bottom of the canvas (640, 700)
      // lands on neutral whitespace in either state.
      const box = await canvas.boundingBox();
      if (!box) throw new Error('canvas has no bounding box');
      const focusX = box.x + 640;
      const focusY = box.y + 700;
      await appPage.mouse.move(focusX, focusY, { steps: 15 });
      await appPage.mouse.click(focusX, focusY);
      await appPage.waitForTimeout(600);

      // Escape closes the Excel Start screen (Office 2019+ / 365 behaviour)
      // and opens Book1. If we were already on Book1, Escape is a no-op.
      // Two presses with a gap insures against a transient modal (e.g.
      // first-run "Privacy options" dialogs) that Office sometimes shows.
      await appPage.keyboard.press('Escape');
      await appPage.waitForTimeout(1_500);
      await appPage.keyboard.press('Escape');
      await appPage.waitForTimeout(6_000);
      await shot(appPage, '07-after-escape');

      // Click A1 directly. In Book1, A1 sits at canvas pixel ~(58, 237):
      // row-header width 58, ribbon + formula-bar stack height ~237.
      const a1X = box.x + 58;
      const a1Y = box.y + 237;
      await appPage.mouse.move(a1X, a1Y, { steps: 15 });
      await appPage.mouse.click(a1X, a1Y);
      await appPage.waitForTimeout(600);

      // Belt-and-braces: Ctrl+Home goes to A1 from any selection on a
      // fresh sheet with no frozen panes. Cheap insurance against the A1
      // pixel coord being off on a different DPI.
      await appPage.keyboard.press('Control+Home');
      await appPage.waitForTimeout(500);
      await shot(appPage, '08-a1-selected');

      // --------------------------------------------------------------------
      // Step 7: Type "Hello world" into A1.
      //
      // Excel opens a fresh workbook with A1 selected. Any printable key
      // opens the cell editor; Enter commits the cell and advances down.
      // The keystrokes flow through the canvas via RDP — this is the rare
      // part of a streamed-desktop session where Playwright *can* drive
      // the remote app, because the canvas accepts the same keyboard events
      // any DOM element would.
      // --------------------------------------------------------------------
      await appPage.keyboard.type(CELL_VALUE, { delay: 60 });
      await shot(appPage, '09-typed-before-commit');
      await appPage.keyboard.press('Enter');
      await appPage.waitForTimeout(1_500);
      await shot(appPage, '10-a1-committed');

      // --------------------------------------------------------------------
      // Verification — and the punchline.
      //
      // A human looking at 08-a1-committed.png can see "Hello world" in A1.
      // Playwright cannot confirm it without leaving the browser:
      //   (a) Ctrl+Home → Ctrl+C, then read navigator.clipboard.readText().
      //       TSplus supports clipboard sync between the remote session and
      //       the browser, but it requires a granted clipboard permission
      //       and a recent user gesture. Often blocked under automation.
      //   (b) Screenshot the canvas region for A1 and OCR it — works, but
      //       it is no longer "a Playwright assertion".
      //   (c) Canonical Playwright readbacks (textContent, inputValue,
      //       ARIA tree) all return nothing — the cell is pixels.
      //
      // We attempt (a) as a soft check. If clipboard sync is denied or
      // returns empty, the test still passes: the failure mode IS the
      // demo, and the screenshot is the artifact of record.
      // --------------------------------------------------------------------
      await appPage.keyboard.press('Control+Home');
      await appPage.waitForTimeout(400);
      await appPage.keyboard.press('Control+C');
      await appPage.waitForTimeout(1_000);

      let clipboardText: string | null = null;
      try {
        clipboardText = await appPage.evaluate(async () =>
          navigator.clipboard.readText(),
        );
      } catch {
        clipboardText = null;
      }
      await shot(appPage, '11-final');

      console.log(
        `[tsplus-excel] clipboard readback: ${JSON.stringify(clipboardText)}`,
      );

      // Hard assertion only on what Playwright can actually observe.
      // The canvas mounted, the typing completed without error, and we
      // produced the screenshots. If clipboard sync did pass through,
      // assert the value too; otherwise note the canvas boundary.
      expect(canvas, 'streamed RemoteApp canvas should be mounted').toBeVisible();

      if (clipboardText && clipboardText.trim().length > 0) {
        expect(clipboardText.trim()).toBe(CELL_VALUE);
      } else {
        test.info().annotations.push({
          type: 'canvas-boundary',
          description:
            'A1 was typed and committed (visible in 10-a1-committed.png), ' +
            'but stock Playwright cannot read it back without clipboard ' +
            'sync or OCR — exactly the streamed-desktop failure mode this ' +
            'demo exists to illustrate.',
        });
      }
    },
  );
});
