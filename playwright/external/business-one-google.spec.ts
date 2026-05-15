import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';

// Target: https://www.business-one.cloud/en/ — a SAP Business One Cloud
// reseller portal that gates everything behind sign-in. The Goal here is the
// AIVA proof-point inverse of the Odoo demo: where Odoo shows Playwright
// stopping at the *application surface* (canvas), this one shows Playwright
// stopping at the *gateway* — Google's anti-automation reCAPTCHA + risk
// engine, before the SaaS even gets a chance to load.
//
// Credentials (test/disposable Google account, owned by Y Soft for AIVA demos):
//   GOOGLE_EMAIL=p8142864@gmail.com
//   GOOGLE_PASSWORD=verbally-worrisome-emergency-confirm-chevy-shy
//
// We try multiple Playwright-only escalations:
//   A) Naive: default chromium, fill+click.
//   B) Real Chrome channel (channel: 'chrome') + Win10 Chrome UA.
//   C) Stealth-style init script: hide navigator.webdriver, fake plugins,
//      languages, chrome.runtime, permissions.query.
//   D) Slow human-like typing (random per-char delay, mouse jitter).
//   E) Persistent context (real user-data-dir) so Google's cookie/device
//      heuristics see "returning user".
//
// Every variant takes screenshots of (a) the business-one landing,
// (b) the Google sign-in page, (c) wherever the test ultimately stops —
// almost certainly the reCAPTCHA image challenge or the "Couldn't sign
// you in" rejection page. The /external page references those screenshots.

const SUT_URL = 'https://www.business-one.cloud/en/';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL ?? 'p8142864@gmail.com';
const GOOGLE_PASSWORD =
  process.env.GOOGLE_PASSWORD ?? 'verbally-worrisome-emergency-confirm-chevy-shy';

// Where Playwright should drop the per-attempt screenshots that the
// /external page later embeds. Resolved relative to the repo root regardless
// of where playwright test was invoked from.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.resolve(__dirname, '..', '..', 'public', 'external');

async function shot(page: Page, name: string): Promise<void> {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `business-one-google-${name}.png`), fullPage: false });
}

/**
 * Click "Login" on business-one.cloud (or follow whichever entry-point the
 * site exposes), reach the Google OAuth screen, then run a Playwright-only
 * email/password flow. Returns once we either land on an authenticated
 * business-one URL or run out of road.
 *
 * The function is shared across the variants so each test focuses on its
 * *escalation* (UA, stealth, persistent context) rather than re-implementing
 * the flow.
 */
async function attemptGoogleSignIn(page: Page, tag: string): Promise<{ landed: boolean; finalUrl: string }>
{
  // ----------------------------------------------------------------------
  // 1. Land on business-one. Login control is a hero <a href="#"> that
  // window.open()s a Microsoft B2C popup — *not* a same-tab navigation.
  // ----------------------------------------------------------------------
  await page.goto(SUT_URL, { waitUntil: 'domcontentloaded' });
  // Some cookie banners block the Login button. Accept whatever is present;
  // the consent UIs we've seen so far put "Accept" or "Allow all" on a
  // button — match permissively.
  const cookieButton = page
    .getByRole('button', { name: /accept|allow|got it|agree/i })
    .first();
  await cookieButton.click({ timeout: 5_000 }).catch(() => {/* no banner */});

  await shot(page, `${tag}-01-landing`);

  // Hero "Login" link (href="#"); the header also has "Anmelden" (German for
  // "Sign in") regardless of locale, so prefer the explicit text match. The
  // click triggers window.open() against businessoneservice.b2clogin.com.
  const loginLink = page
    .getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i })
    .or(page.getByRole('button', { name: /^(login|sign\s*in|anmelden)$/i }))
    .first();
  const [popup] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 15_000 }),
    loginLink.click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await shot(popup, `${tag}-02-b2c-popup`);

  // ----------------------------------------------------------------------
  // 2. On the B2C popup, click the "Google" federated-sign-in button.
  // The B2C "Sign in with your social account" form exposes LinkedIn,
  // Microsoft and Google as bare-text buttons — match exactly on "Google".
  // ----------------------------------------------------------------------
  const googleButton = popup
    .getByRole('button', { name: /^google$/i })
    .or(popup.getByRole('link', { name: /^google$/i }))
    .first();
  await googleButton.waitFor({ state: 'visible', timeout: 15_000 });
  await googleButton.click();

  // The B2C popup itself navigates to accounts.google.com — no second popup.
  let opened: Page = popup;

  // ----------------------------------------------------------------------
  // 3. We should now be on accounts.google.com.
  // ----------------------------------------------------------------------
  await opened.waitForURL(/accounts\.google\.com/, { timeout: 20_000 }).catch(() => {
    /* may have inlined the form — continue regardless */
  });
  await opened.waitForLoadState('domcontentloaded');
  await shot(opened, `${tag}-03-google-email`);

  // Email field is input[type="email"] or input#identifierId.
  const emailInput = opened.locator('input[type="email"], input#identifierId, input[name="identifier"]').first();
  await emailInput.fill(GOOGLE_EMAIL);
  await shot(opened, `${tag}-04-email-filled`);

  // "Next" button — Google has shipped a few labels over the years; match
  // permissively. Also handle the legacy form-submit shape.
  const nextBtn = opened
    .getByRole('button', { name: /^next$|^continue$|^další$/i })
    .or(opened.locator('#identifierNext button, #identifierNext'))
    .first();
  await nextBtn.click({ timeout: 10_000 });

  // ----------------------------------------------------------------------
  // 4. Password page — or, almost always for an automated context, the
  // reCAPTCHA / risk-rejection page. Take a screenshot of whichever lands.
  // ----------------------------------------------------------------------
  // Wait for either: password field, captcha iframe, or rejection text.
  await Promise.race([
    opened.locator('input[type="password"], input[name="Passwd"]').first().waitFor({ state: 'visible', timeout: 20_000 }),
    opened.frameLocator('iframe[src*="recaptcha"], iframe[title*="recaptcha" i]').first().locator('body').waitFor({ timeout: 20_000 }),
    opened.getByText(/couldn't sign you in|verify it'?s you|try again later/i).first().waitFor({ timeout: 20_000 }),
  ]).catch(() => {/* take whatever shot we ended up on */});

  await shot(opened, `${tag}-05-after-email-next`);

  const passwordInput = opened.locator('input[type="password"], input[name="Passwd"]').first();
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(GOOGLE_PASSWORD);
    await shot(opened, `${tag}-06-password-filled`);
    const pwNext = opened
      .getByRole('button', { name: /^next$|^continue$|^sign\s*in$/i })
      .or(opened.locator('#passwordNext button, #passwordNext'))
      .first();
    await pwNext.click({ timeout: 10_000 });

    // Wait for either business-one redirect, captcha, or rejection.
    await opened.waitForLoadState('domcontentloaded');
    await Promise.race([
      opened.waitForURL(/business-one\.cloud/, { timeout: 30_000 }),
      opened.getByText(/couldn't sign you in|wrong password|verify it'?s you/i).first().waitFor({ timeout: 30_000 }),
      opened.frameLocator('iframe[src*="recaptcha"]').first().locator('body').waitFor({ timeout: 30_000 }),
    ]).catch(() => {/* still take the shot */});
    await shot(opened, `${tag}-07-after-password`);
  }

  // ----------------------------------------------------------------------
  // 5. Verdict.
  // ----------------------------------------------------------------------
  const finalUrl = opened.url();
  const landed = /business-one\.cloud/.test(finalUrl) && !/login|signin/i.test(finalUrl);
  if (landed) {
    await shot(opened, `${tag}-99-authenticated`);
  } else {
    await shot(opened, `${tag}-99-blocked`);
  }
  return { landed, finalUrl };
}

test.describe('business-one.cloud — Google OAuth login via Playwright', () => {
  test.setTimeout(180_000);

  // ------------------------------------------------------------------
  // Variant A: Naive — what a typical Playwright user would write first.
  // Default chromium, default UA (HeadlessChrome on Linux despite Windows),
  // no special flags.
  // ------------------------------------------------------------------
  test('A. naive — default chromium, default UA', { tag: '@external' }, async ({ page }) => {
    const { landed, finalUrl } = await attemptGoogleSignIn(page, 'A-naive');
    // Document the expected outcome inline so the recording is self-explanatory.
    expect(landed, `naive variant should have landed on business-one but ended on ${finalUrl}`).toBe(true);
  });

  // ------------------------------------------------------------------
  // Variant B: Real Chrome (channel: 'chrome') + Win10 Chrome UA.
  // Removes the "HeadlessChrome" UA token and uses the installed Chrome
  // build instead of the bundled chromium. Both are signals Google has
  // historically used in its bot heuristics.
  // ------------------------------------------------------------------
  test('B. real-chrome — channel: chrome + Win10 UA', { tag: '@external' }, async ({ browserName }, testInfo) => {
    // Tied to chromium family; skip otherwise.
    test.skip(browserName !== 'chromium', 'chromium-only');
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    }).catch(() => null);
    test.skip(!browser, 'Chrome stable not installed locally');
    const context = await browser!.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });
    const page = await context.newPage();
    const { landed, finalUrl } = await attemptGoogleSignIn(page, 'B-real-chrome');
    await context.close();
    await browser!.close();
    expect(landed, `real-chrome variant should have landed on business-one but ended on ${finalUrl}`).toBe(true);
  });

  // ------------------------------------------------------------------
  // Variant C: Stealth-style init script — mask the navigator.webdriver
  // flag, fake plugins/languages, restore chrome.runtime, intercept
  // permissions.query for "notifications". This is what most public
  // "playwright stealth" packages do; we inline it to keep the spec
  // pure @playwright/test.
  // ------------------------------------------------------------------
  test('C. stealth — mask webdriver / fake plugins / chrome.runtime', { tag: '@external' }, async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'Europe/Prague',
    });
    await applyStealth(context);
    const page = await context.newPage();
    const { landed, finalUrl } = await attemptGoogleSignIn(page, 'C-stealth');
    await context.close();
    expect(landed, `stealth variant should have landed on business-one but ended on ${finalUrl}`).toBe(true);
  });

  // ------------------------------------------------------------------
  // Variant D: Slow human-like typing + mouse motion before each click.
  // Bot detection libraries flag uniform-cadence keystrokes and instant
  // clicks at element centroids. Introduce per-char jitter (60–180ms)
  // and small mouse drifts.
  // ------------------------------------------------------------------
  test('D. human-cadence — jittered typing + mouse drift', { tag: '@external' }, async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });
    await applyStealth(context);
    const page = await context.newPage();
    await page.goto(SUT_URL, { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: /accept|allow|got it|agree/i })
      .first()
      .click({ timeout: 5_000 })
      .catch(() => {});
    await shot(page, 'D-human-01-landing');
    // Drift the mouse to a random offset before clicking Login.
    await page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 200, { steps: 25 });
    const loginLink = page
      .getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i })
      .or(page.getByRole('button', { name: /^(login|sign\s*in|anmelden)$/i }))
      .first();
    // The Login click triggers window.open() against the B2C popup.
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 15_000 }),
      loginLink.click(),
    ]);
    await popup.waitForLoadState('domcontentloaded');
    await shot(popup, 'D-human-02-b2c-popup');

    // Mouse-drift, then click "Google" on the B2C social-login form.
    const googleBtn = popup.getByRole('button', { name: /^google$/i }).first();
    const gBox = await googleBtn.boundingBox();
    if (gBox) {
      await popup.mouse.move(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2, { steps: 25 });
    }
    await googleBtn.click();
    const opened = popup;
    await opened.waitForURL(/accounts\.google\.com/, { timeout: 20_000 }).catch(() => {});
    await shot(opened, 'D-human-03-google-email');

    // Mouse-drift to the email input, then type with per-character jitter.
    const email = opened.locator('input[type="email"], input#identifierId').first();
    const box = await email.boundingBox();
    if (box) {
      await opened.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
    }
    await email.click();
    for (const ch of GOOGLE_EMAIL) {
      await opened.keyboard.type(ch);
      await opened.waitForTimeout(60 + Math.floor(Math.random() * 120));
    }
    await shot(opened, 'D-human-04-email-typed');
    await opened.keyboard.press('Enter');

    await Promise.race([
      opened.locator('input[type="password"], input[name="Passwd"]').first().waitFor({ state: 'visible', timeout: 20_000 }),
      opened.frameLocator('iframe[src*="recaptcha"]').first().locator('body').waitFor({ timeout: 20_000 }),
      opened.getByText(/couldn't sign you in|verify it'?s you|try again later/i).first().waitFor({ timeout: 20_000 }),
    ]).catch(() => {});
    await shot(opened, 'D-human-05-after-email');

    const pw = opened.locator('input[type="password"]').first();
    if (await pw.isVisible().catch(() => false)) {
      await pw.click();
      for (const ch of GOOGLE_PASSWORD) {
        await opened.keyboard.type(ch);
        await opened.waitForTimeout(60 + Math.floor(Math.random() * 120));
      }
      await shot(opened, 'D-human-06-password-typed');
      await opened.keyboard.press('Enter');
      await opened.waitForLoadState('domcontentloaded');
      await Promise.race([
        opened.waitForURL(/business-one\.cloud/, { timeout: 30_000 }),
        opened.getByText(/couldn't sign you in|wrong password|verify it'?s you/i).first().waitFor({ timeout: 30_000 }),
        opened.frameLocator('iframe[src*="recaptcha"]').first().locator('body').waitFor({ timeout: 30_000 }),
      ]).catch(() => {});
      await shot(opened, 'D-human-07-final');
    }

    const finalUrl = opened.url();
    const landed = /business-one\.cloud/.test(finalUrl) && !/login|signin/i.test(finalUrl);
    if (landed) {
      await shot(opened, 'D-human-99-authenticated');
    } else {
      await shot(opened, 'D-human-99-blocked');
    }
    await context.close();
    expect(landed, `human-cadence variant should have landed on business-one but ended on ${finalUrl}`).toBe(true);
  });

  // ------------------------------------------------------------------
  // Variant E: Persistent context — a real on-disk user-data-dir so the
  // visit is not "zero-cookie-zero-fingerprint" the way ephemeral
  // contexts always are. This is the strongest pure-Playwright move
  // before resorting to non-Playwright tooling.
  // ------------------------------------------------------------------
  test('E. persistent — real user-data-dir for cookie/device trust', { tag: '@external' }, async () => {
    const profileDir = path.resolve(__dirname, '..', '..', 'test-results', 'business-one-profile');
    await fs.mkdir(profileDir, { recursive: true });
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chrome',
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    }).catch(() => null);
    test.skip(!context, 'Chrome stable not installed locally');
    await applyStealth(context!);
    const page = await context!.newPage();
    const { landed, finalUrl } = await attemptGoogleSignIn(page, 'E-persistent');
    await context!.close();
    expect(landed, `persistent-context variant should have landed on business-one but ended on ${finalUrl}`).toBe(true);
  });

  // ------------------------------------------------------------------
  // Variant F: Real Chrome + click the "I'm not a robot" reCAPTCHA
  // checkbox. With high-trust fingerprints the checkbox sometimes
  // passes "no challenge" — but on a virgin profile / data-centre IP
  // Google escalates to the image grid (cars/buses/crosswalks), which
  // is the canvas-rendered widget AIVA would solve and Playwright
  // can't.
  // ------------------------------------------------------------------
  test('F. real-chrome + click reCAPTCHA checkbox', { tag: '@external' }, async () => {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    }).catch(() => null);
    test.skip(!browser, 'Chrome stable not installed locally');
    const context = await browser!.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });
    await applyStealth(context);
    const page = await context.newPage();
    const { landed: preLanded, finalUrl: preUrl } = await attemptGoogleSignIn(page, 'F-recaptcha');
    if (preLanded) {
      await context.close();
      await browser!.close();
      return; // already authenticated, nothing more to try
    }
    // We expect to be on the "Verify it's you" screen with reCAPTCHA.
    const pages = context.pages();
    const opened = pages[pages.length - 1];
    // reCAPTCHA "I'm not a robot" checkbox lives inside an iframe whose src
    // includes /recaptcha/. The checkbox is the .recaptcha-checkbox element.
    const recaptchaFrame = opened.frameLocator('iframe[src*="/recaptcha/"]').first();
    const checkbox = recaptchaFrame
      .locator('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]')
      .first();
    try {
      await checkbox.waitFor({ state: 'visible', timeout: 10_000 });
      const box = await checkbox.boundingBox();
      if (box) {
        await opened.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
      }
      await checkbox.click();
      await shot(opened, 'F-recaptcha-08-checkbox-clicked');
      // Either the checkbox flips to "verified", an image-challenge popup
      // opens in a second iframe, or Google instantly hard-blocks. Wait
      // briefly so the camera catches the state.
      await opened.waitForTimeout(4_000);
      await shot(opened, 'F-recaptcha-09-after-checkbox');
      // If a challenge opened, screenshot the visible image grid.
      const challengeFrame = opened.frameLocator('iframe[src*="/recaptcha/"][src*="bframe"]').first();
      const challengeImg = challengeFrame.locator('img').first();
      if (await challengeImg.isVisible().catch(() => false)) {
        await shot(opened, 'F-recaptcha-10-image-challenge');
      }
    } catch {
      await shot(opened, 'F-recaptcha-08-checkbox-not-found');
    }
    // Try clicking Next anyway — if reCAPTCHA passed silently we land on
    // the password page.
    const nextBtn = opened.getByRole('button', { name: /^next$|^continue$/i }).first();
    await nextBtn.click({ timeout: 5_000 }).catch(() => {});
    await opened.waitForTimeout(2_000);
    await shot(opened, 'F-recaptcha-11-after-next');

    const pw = opened.locator('input[type="password"]').first();
    if (await pw.isVisible().catch(() => false)) {
      await pw.click();
      for (const ch of GOOGLE_PASSWORD) {
        await opened.keyboard.type(ch);
        await opened.waitForTimeout(60 + Math.floor(Math.random() * 120));
      }
      await opened.keyboard.press('Enter');
      await opened.waitForLoadState('domcontentloaded');
      await Promise.race([
        opened.waitForURL(/business-one\.cloud/, { timeout: 30_000 }),
        opened.getByText(/couldn't sign you in|wrong password|verify it'?s you/i).first().waitFor({ timeout: 30_000 }),
      ]).catch(() => {});
      await shot(opened, 'F-recaptcha-12-after-password');
    }

    const finalUrl = opened.url();
    const landed = /business-one\.cloud/.test(finalUrl) && !/login|signin/i.test(finalUrl);
    if (landed) {
      await shot(opened, 'F-recaptcha-99-authenticated');
    } else {
      await shot(opened, 'F-recaptcha-99-blocked');
    }
    await context.close();
    await browser!.close();
    expect(landed, `recaptcha-click variant should have landed on business-one but ended on ${finalUrl} (pre-stage ended on ${preUrl})`).toBe(true);
  });
});

// ----------------------------------------------------------------------
// Stealth helper — runs as init script in every context page. Each block
// addresses one fingerprint surface that Google's "are you a bot" engine
// has been documented to read:
//   - navigator.webdriver:   true under WebDriver, undefined in real Chrome.
//   - navigator.plugins:     empty under headless, ~3+ in real Chrome.
//   - navigator.languages:   missing under headless launches.
//   - window.chrome:         missing under chromium without the Chrome
//                            channel; presence is treated as a positive
//                            signal by some heuristics.
//   - Permissions API:       returns 'denied' for 'notifications' under
//                            real Chrome before the user opts in;
//                            chromium-without-flags returns 'default'.
// These overrides are derived from the public puppeteer-extra-plugin-stealth
// source — re-implemented here as plain Playwright init scripts so the
// spec keeps its "pure @playwright/test" claim.
// ----------------------------------------------------------------------
async function applyStealth(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // navigator.languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // navigator.plugins — fake three real-looking plugin entries.
    const fakePlugins = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' },
    ];
    Object.defineProperty(navigator, 'plugins', {
      get: () => Object.assign(fakePlugins, { length: fakePlugins.length, item: (i: number) => fakePlugins[i] }),
    });

    // window.chrome stub
    // @ts-expect-error window.chrome doesn't exist on the Window type
    window.chrome = window.chrome ?? { runtime: {} };

    // Permissions.notifications must return 'denied' (default in real
    // Chrome before user opt-in), not 'default'.
    const origQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
    if (origQuery) {
      window.navigator.permissions.query = (params: PermissionDescriptor) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission, name: 'notifications' } as PermissionStatus)
          : origQuery(params);
    }
  });
}
