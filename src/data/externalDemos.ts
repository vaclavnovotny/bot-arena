export interface ExternalDemo {
  id: 'odoo-spreadsheet' | 'business-one-google';
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
  /**
   * Extra still-image proof captured during the Playwright run — used when a
   * single video clip can't show every failure mode (e.g. the same SUT
   * blocks different Playwright variants in distinct ways).
   */
  stills?: Array<{ src: string; caption: string }>;
  /**
   * Structured log of every Playwright variant attempted against this SUT.
   * Rendered as a table on the page. The `wall` field drives colour-coding:
   * fingerprint = rejected before password, recaptcha-anchor = stopped at
   * "I'm not a robot" checkbox, recaptcha-image = stopped at the image grid.
   * Used when "one test failed" is the wrong frame — when the story is "we
   * tried eight different escalations and they all stopped on the same wall."
   */
  attempts?: Array<{
    letter: string;
    name: string;
    /** What this variant added on top of the previous one — keep terse. */
    change: string;
    /** Which wall halted the run; drives the per-row colour pill. */
    wall: 'fingerprint' | 'recaptcha-anchor' | 'recaptcha-image';
    /** One-sentence outcome (what URL / what message Google returned). */
    outcome: string;
  }>;
  /**
   * AIVA-side proof. Optional because some demos ship as Playwright-only
   * proofs first, with the AIVA recording added later.
   */
  aivaVideoSrc?: string;
  aivaVideoCaption?: string;
  aivaStepsImageSrc?: string;
  aivaStepsCaption?: string;
  /**
   * Text to show in place of the AIVA recording when the recording isn't
   * available yet. Required iff aivaVideoSrc is omitted.
   */
  aivaPendingNote?: string;
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
  {
    id: 'business-one-google',
    title: 'Sign in to SAP Business One Cloud with a Google account',
    category: 'SaaS gateway',
    demoUrl: 'https://www.business-one.cloud/en/',
    goal:
      'A prospect wants to evaluate SAP Business One Cloud using their company Google Workspace identity — Login → "Sign in with Google" → land on the authenticated dashboard. The same flow a sales engineer would script before showing the product to a customer.',
    steps: [
      'Open https://www.business-one.cloud/en/.',
      'Click "Login" — a Microsoft B2C popup opens.',
      'Choose "Google" on the B2C social-sign-in panel.',
      'On accounts.google.com, fill the email and click Next.',
      'Fill the password and click Next.',
      'Land on the authenticated SAP Business One Cloud dashboard.',
    ],
    problem:
      'SAP Business One Cloud itself is fine — its Login link is a plain anchor, and the Microsoft B2C popup that opens is a regular form with named buttons. The "Sign in with Google" button is the cliff edge: from there, the flow is owned by <code>accounts.google.com</code>, and Google\'s anti-automation engine runs <strong>two consecutive checks</strong> before SAP B1 ever loads.<br/><br/>' +
      '<strong>Stage 1 — browser fingerprint check (email step).</strong> Google inspects <code>navigator.webdriver</code>, the plugin / mime-type arrays, <code>navigator.languages</code>, the <code>window.chrome</code> object surface, the WebGL vendor/renderer string, <code>hardwareConcurrency</code> / <code>deviceMemory</code>, the Permissions API\'s behaviour, the Battery API, and at the launch level whether the browser was started with <code>--enable-automation</code> or exposes a <code>DevToolsActivePort</code> file. Any single tell → <strong>"Couldn\'t sign you in — this browser or app may not be secure."</strong> The password field never appears.<br/><br/>' +
      '<strong>Stage 2 — reCAPTCHA "Verify it\'s you" (post-email).</strong> If the fingerprint check passes, Google runs a risk score (cookie age, IP reputation, mouse-movement entropy, and Stage-1 signals as inputs) and chooses whether to silently pass the "I\'m not a robot" checkbox or escalate to the image grid ("Select all squares with fire hydrants"). The image grid is <code>&lt;canvas&gt;</code> inside a Google-owned iframe; the answer is image classification, unsolvable from the DOM. The SAP B1 dashboard is never reached.',
    layers: [
      {
        status: 'reaches',
        name: 'business-one.cloud marketing site + Microsoft B2C selector',
        detail: 'Standard locators work here: <code>getByRole(\'link\', { name: \'Login\' })</code> opens the B2C popup; <code>getByRole(\'button\', { name: \'Google\' })</code> launches the federated flow. This is what the recording shows succeeding for the first ~6 seconds.',
      },
      {
        status: 'fails',
        name: 'accounts.google.com · Stage 1 — automation fingerprint check',
        detail: 'Inspected at the email-submit step. No matter how thorough the in-page stealth init script is, certain signals (launch flags, DevToolsActivePort presence, CDP-protocol attach pattern) leak through and route the session to <code>/signin/rejected</code>. The password field is never reached.',
      },
      {
        status: 'fails',
        name: 'accounts.google.com · Stage 2 — reCAPTCHA "Verify it\'s you"',
        detail: 'When Stage 1 passes (real Chrome via <code>channel: \'chrome\'</code> or <code>connectOverCDP</code>), Google escalates to "Verify it\'s you · Confirm you\'re not a robot". Even a high-trust profile gets the image grid; <code>getByText(\'fire hydrant\')</code> resolves to zero elements because the tiles are painted into a canvas inside a Google iframe.',
      },
      {
        status: 'opaque',
        name: 'Behind the wall — SAP Business One web client, app modules, ERP data',
        detail: 'Never reached. Every Playwright variant stops on Google\'s side; the actual SAP B1 surface (the thing the test was supposed to drive) is unobservable from selector-based automation.',
      },
    ],
    aivaFootnote:
      'AIVA drives a real desktop browser, not a WebDriver-controlled one — Stage 1 doesn\'t apply. For Stage 2 it reads the image grid the same way a human does (rendered pixels) and clicks the matching tiles.',
    attempts: [
      {
        letter: 'A',
        name: 'Naive headless',
        change: 'Default chromium, default UA, no flags',
        wall: 'fingerprint',
        outcome: 'Lands on <code>/signin/rejected?idnf=…</code> immediately after Next. "This browser or app may not be secure."',
      },
      {
        letter: 'B',
        name: 'Real Chrome channel',
        change: 'A + <code>channel: \'chrome\'</code> + Win10 Chrome UA + <code>--disable-blink-features=AutomationControlled</code>',
        wall: 'recaptcha-anchor',
        outcome: 'Fingerprint check passes. Lands on "Verify it\'s you" with the reCAPTCHA "I\'m not a robot" checkbox.',
      },
      {
        letter: 'C',
        name: 'Stealth init script',
        change: 'A + <code>addInitScript</code>: delete <code>navigator.webdriver</code>, fake <code>plugins</code> / <code>mimeTypes</code>, restore <code>window.chrome.runtime</code>, override <code>navigator.languages</code> / Permissions API',
        wall: 'fingerprint',
        outcome: 'Same as A — the stealth surface is not enough on its own without a real Chrome binary underneath.',
      },
      {
        letter: 'D',
        name: 'Human cadence',
        change: 'C + per-character typing delay 60–180 ms, mouse drift to element centroid before each click, occasional thinking pauses',
        wall: 'fingerprint',
        outcome: 'Identical to A / C. Google flags before any human behavioural signal can register.',
      },
      {
        letter: 'E',
        name: 'Persistent profile',
        change: 'B + <code>chromium.launchPersistentContext({ userDataDir })</code> so cookies and history accumulate between runs',
        wall: 'recaptcha-anchor',
        outcome: 'Same wall as B. An empty-then-warmed profile doesn\'t accumulate enough trust in one session.',
      },
      {
        letter: 'F',
        name: 'Click the reCAPTCHA checkbox',
        change: 'E + <code>frameLocator(\'iframe[src*="/recaptcha/"]\').click("I\'m not a robot")</code>',
        wall: 'recaptcha-image',
        outcome: 'Image grid opens — "Select all squares with fire hydrants". Tiles are <code>&lt;canvas&gt;</code> inside a Google iframe; cannot be classified from the DOM.',
      },
      {
        letter: 'G',
        name: 'CDP attach to external Chrome',
        change: '<code>chromium.connectOverCDP()</code> to a Chrome launched manually with <code>--remote-debugging-port</code> — not via Playwright, so the WebDriver-launch signature (<code>--enable-automation</code>, <code>DevToolsActivePort</code> file) never gets set',
        wall: 'recaptcha-anchor',
        outcome: 'Past Stage 1 — but Stage 2 still fires. The launch-time signature was the last residual sub-fingerprint that B / E couldn\'t hide.',
      },
      {
        letter: 'H',
        name: 'CDP + warmup + comprehensive stealth',
        change: 'G + 30 s behavioural warmup (google.com search → YouTube → accounts.google.com) + comprehensive init script: WebGL vendor/renderer (Intel Inc. / ANGLE), <code>hardwareConcurrency</code> = 8, <code>deviceMemory</code> = 8, <code>navigator.platform</code>, <code>navigator.connection</code>, Battery API stub, Permissions notifications = <code>Notification.permission</code>. Bezier mouse trajectories + variable typing.',
        wall: 'recaptcha-anchor',
        outcome: 'Strongest pure-Playwright cloak available. Still "Verify it\'s you". Google\'s wall holds.',
      },
    ],
    testCode: `import { test, expect, chromium, type Page } from '@playwright/test';

const SUT_URL = 'https://www.business-one.cloud/en/';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL!;
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD!;

// Shared flow. Each variant differs only in the *browser fingerprint*
// (stealth init script, real-chrome channel, persistent user-data-dir).
async function attemptGoogleSignIn(page: Page) {
  // 1. business-one.cloud — Login opens a B2C popup via window.open().
  await page.goto(SUT_URL);
  const [popup] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: /^(login|anmelden)$/i }).first().click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');

  // 2. B2C social-sign-in form: LinkedIn / Microsoft / Google.
  await popup.getByRole('button', { name: /^google$/i }).click();
  await popup.waitForURL(/accounts\\.google\\.com/);

  // 3. Email page.
  await popup.locator('input[type="email"]').fill(GOOGLE_EMAIL);
  await popup.getByRole('button', { name: /^next$/i }).click();

  // 4. Wait for whichever wall Google chooses:
  //    - Password input (the happy path)
  //    - /signin/rejected   (headless fingerprint detected)
  //    - reCAPTCHA iframe   (real-Chrome path, hits "Verify it's you")
  await Promise.race([
    popup.locator('input[type="password"]').waitFor({ state: 'visible' }),
    popup.getByText(/couldn't sign you in/i).waitFor(),
    popup.frameLocator('iframe[src*="/recaptcha/"]').first().locator('body').waitFor(),
  ]);
  return popup;
}

test('A. naive — default chromium, default UA', async ({ page }) => {
  const opened = await attemptGoogleSignIn(page);
  expect(opened.url()).toMatch(/business-one\\.cloud/); // ← fails on /signin/rejected
});

test('B. real-chrome — channel: chrome + Win10 UA', async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/132.0.0.0 ...',
  });
  const page = await context.newPage();
  const opened = await attemptGoogleSignIn(page);
  expect(opened.url()).toMatch(/business-one\\.cloud/); // ← fails on reCAPTCHA
});

// Variants C (stealth init script) and D (jittered typing) hit the
// same /signin/rejected wall as A. Variants E (persistent user-data-dir)
// and F (click "I'm not a robot") hit the same image-grid challenge as B.`,
    failureLine: 'Error: naive variant should have landed on business-one but ended on https://accounts.google.com/v3/signin/rejected?idnf=p8142864%40gmail.com…',
    videoSrc: '/external/business-one-google-fails.webm',
    posterSrc: '/external/business-one-google-rejected.png',
    videoDuration: '30 s',
    stills: [
      {
        src: '/external/business-one-google-rejected.png',
        caption: 'Variants A / C / D — Google rejects automation fingerprint with "Couldn\'t sign you in — this browser or app may not be secure" before asking for a password.',
      },
      {
        src: '/external/business-one-google-B-real-chrome-99-blocked.png',
        caption: 'Variants B / E / G — switching to real Chrome (channel \'chrome\') or CDP-attaching to an externally-launched Chrome clears the fingerprint check; Google escalates to a reCAPTCHA "Verify it\'s you" wall.',
      },
      {
        src: '/external/business-one-google-recaptcha.png',
        caption: 'Variant F clicks the "I\'m not a robot" checkbox; Google answers with the canvas-rendered image grid ("Select all squares with fire hydrants / bicycles") — unsolvable from the DOM.',
      },
      {
        src: '/external/business-one-google-H-deep-stealth-blocked.png',
        caption: 'Variant H — strongest pure-Playwright cloak: CDP-attached Chrome + persistent profile + 30s behavioural warmup (Google search → YouTube → accounts.google.com) + Bezier mouse + variable typing + comprehensive stealth (WebGL/Permissions/Battery/Connection/HardwareConcurrency overrides). Still hits the same reCAPTCHA wall.',
      },
    ],
    aivaVideoSrc: '/external/business-one-google-aiva.mp4',
    aivaVideoCaption:
      'AIVA driving the exact same flow end-to-end on a real desktop browser — clicking Login on business-one.cloud, choosing Google on the B2C popup, typing the email, then reading the reCAPTCHA image grid as rendered pixels and clicking the matching tiles. The eight pure-Playwright variants above all fail on this last step; AIVA does not run into either Google wall because it does not look like an automated browser to Google\'s engine in the first place.',
  },
];
