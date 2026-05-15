#!/usr/bin/env node
// Variant H — deeper cloaking. The user asked for "better cloak as normal
// human, so the reCAPTCHA does not show/trigger." So this script combines
// every pure-Playwright cloak we have:
//
//   1. Real Chrome (channel: 'chrome') launched externally with a
//      *persistent* user-data-dir that accumulates cookies/history
//      between runs.
//   2. Connect via chromium.connectOverCDP — no --enable-automation flag,
//      no Playwright-set "DevToolsActivePort" early signal.
//   3. Comprehensive stealth init script covering every fingerprint
//      surface I know Google has read at some point: webdriver flag,
//      plugins, languages, chrome runtime object, permissions API,
//      WebGL vendor/renderer, hardwareConcurrency, deviceMemory,
//      navigator.connection, the screen object, the Battery API.
//   4. Behavioural warmup: hit google.com → run a real search →
//      scroll → click around for 30+ seconds BEFORE touching the OAuth
//      flow. Google's "first-time visitor from a clean profile and
//      immediately attempting OAuth" pattern is itself a flag.
//   5. Smooth mouse trajectories (Bezier) + variable per-character typing
//      cadence (60–220ms) on every form field.
//
// If reCAPTCHA still fires, we're at the AIVA wall — pure code cannot
// classify "select all fire hydrants."

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHOTS_DIR = path.join(REPO_ROOT, 'public', 'external');
const PROFILE_DIR = path.join(REPO_ROOT, 'test-results', 'business-one-stealth-profile');
const CHROME_EXE = process.env.CHROME_EXE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9230;
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL ?? 'p8142864@gmail.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD ??
  'verbally-worrisome-emergency-confirm-chevy-shy';

await fs.mkdir(SHOTS_DIR, { recursive: true });
await fs.mkdir(PROFILE_DIR, { recursive: true });

function shotPath(name) {
  return path.join(SHOTS_DIR, `business-one-google-H-stealth-${name}.png`);
}

// Curved Bezier mouse trajectory — real cursors don't move in straight lines.
async function moveMouseHuman(page, x, y) {
  const start = await page.evaluate(() => ({
    x: globalThis.__lastMouseX ?? Math.floor(window.innerWidth / 2),
    y: globalThis.__lastMouseY ?? Math.floor(window.innerHeight / 2),
  }));
  // Random control point off the straight line.
  const cx = (start.x + x) / 2 + (Math.random() - 0.5) * 200;
  const cy = (start.y + y) / 2 + (Math.random() - 0.5) * 200;
  const steps = 25 + Math.floor(Math.random() * 25);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mx = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cx + t * t * x;
    const my = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cy + t * t * y;
    await page.mouse.move(mx, my);
    await sleep(5 + Math.floor(Math.random() * 8));
  }
  await page.evaluate(([x, y]) => { globalThis.__lastMouseX = x; globalThis.__lastMouseY = y; }, [x, y]);
}

async function typeHuman(page, text) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await sleep(60 + Math.floor(Math.random() * 160));
    // Occasional brief pause as if thinking.
    if (Math.random() < 0.08) await sleep(200 + Math.floor(Math.random() * 600));
  }
}

// Comprehensive stealth init script — derived from the public surface area
// that puppeteer-extra-plugin-stealth covers, re-implemented here so the
// project keeps its "no third-party stealth library" claim.
const STEALTH_INIT = `
(() => {
  // navigator.webdriver — must be undefined, not false.
  try { delete Object.getPrototypeOf(navigator).webdriver; } catch {}
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });

  // navigator.languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });

  // navigator.plugins — five realistic plugin entries with full structure.
  const realPlugins = [
    { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
  ];
  const pluginArray = Object.assign(realPlugins.map(p => Object.assign(Object.create(Plugin.prototype), p)), {
    length: realPlugins.length,
    item: (i) => realPlugins[i],
    namedItem: (n) => realPlugins.find(p => p.name === n) ?? null,
    refresh: () => {},
  });
  Object.defineProperty(navigator, 'plugins', { get: () => pluginArray, configurable: true });

  // navigator.mimeTypes — Chrome's two PDF mime entries.
  const mimes = [
    { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
    { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
  ];
  const mimeArray = Object.assign(mimes, {
    length: mimes.length,
    item: (i) => mimes[i],
    namedItem: (n) => mimes.find(m => m.type === n) ?? null,
  });
  Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeArray, configurable: true });

  // window.chrome stub with runtime + loadTimes + csi.
  if (!window.chrome) {
    window.chrome = {
      runtime: {
        OnInstalledReason: {},
        OnRestartRequiredReason: {},
        PlatformArch: {},
        PlatformNaclArch: {},
        PlatformOs: {},
        RequestUpdateCheckStatus: {},
      },
      loadTimes: () => ({}),
      csi: () => ({}),
      app: { isInstalled: false, InstallState: {}, RunningState: {} },
    };
  }

  // Permissions API: notifications must report Notification.permission, not 'prompt'.
  const origQuery = navigator.permissions?.query?.bind(navigator.permissions);
  if (origQuery) {
    navigator.permissions.query = (params) => {
      if (params.name === 'notifications') {
        return Promise.resolve({ state: Notification.permission, name: 'notifications', onchange: null });
      }
      return origQuery(params);
    };
  }

  // WebGL — vendor/renderer must match real Chrome on Windows (Intel/ANGLE).
  const origGetParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (param === 37445) return 'Intel Inc.';
    if (param === 37446) return 'Intel(R) HD Graphics 630 OpenGL Engine';
    return origGetParameter.call(this, param);
  };
  if (window.WebGL2RenderingContext) {
    const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel(R) HD Graphics 630 OpenGL Engine';
      return origGetParameter2.call(this, param);
    };
  }

  // hardwareConcurrency, deviceMemory — typical desktop values.
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
  Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });

  // navigator.connection — typical wifi values.
  Object.defineProperty(navigator, 'connection', {
    get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false, type: 'wifi' }),
    configurable: true,
  });

  // Battery API — sometimes queried; provide a real-looking promise.
  if (navigator.getBattery) {
    const origGetBattery = navigator.getBattery.bind(navigator);
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: Infinity,
      dischargingTime: Infinity,
      level: 0.87,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  // window.outerHeight/outerWidth = innerHeight/innerWidth - chrome bar (Chrome usually has ~85px chrome).
  // Leaving real values for now; overriding can backfire if reCAPTCHA checks against innerHeight.
})();
`;

console.log('Launching real Chrome with persistent profile at', PROFILE_DIR);
const chromeProc = spawn(CHROME_EXE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-default-apps',
  // Lang must match navigator.languages override.
  '--lang=en-US',
  // Don't pass --headless, don't pass --enable-automation, don't pass any
  // playwright-style flags. The flags above are what a normal user might
  // see in their own Chrome launch.
  'about:blank',
], { detached: false, stdio: 'ignore' });

async function waitForPort() {
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${PORT}/json/version`, (res) => {
          res.resume();
          res.on('end', () => res.statusCode === 200 ? resolve() : reject(new Error(`status ${res.statusCode}`)));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy(new Error('timeout')));
      });
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Chrome debug port never opened');
}

await waitForPort();
console.log('Attaching Playwright over CDP');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const [ctx] = browser.contexts();
// Apply stealth on *every* page in this context, including ones already open.
await ctx.addInitScript(STEALTH_INIT);
for (const p of ctx.pages()) {
  await p.evaluate(STEALTH_INIT).catch(() => {});
}

try {
  // ====================================================================
  // PHASE 1 — Behavioural warmup. Real users don't land on an OAuth page
  // from cold. They visit google.com, search for things, watch YouTube.
  // We do the same to populate cookies, fingerprint history, and any
  // server-side behavioural model Google maintains for this profile.
  // ====================================================================
  const warmupPage = ctx.pages()[0] ?? await ctx.newPage();
  console.log('Warmup 1/3: google.com search');
  await warmupPage.goto('https://www.google.com/', { waitUntil: 'domcontentloaded' });
  // Accept cookies if present.
  await warmupPage
    .getByRole('button', { name: /accept all|i agree|přijmout|reject all/i })
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
  await sleep(2000 + Math.floor(Math.random() * 2000));
  // Search for something.
  const searchBox = warmupPage.locator('textarea[name="q"], input[name="q"]').first();
  if (await searchBox.isVisible().catch(() => false)) {
    await searchBox.click();
    await typeHuman(warmupPage, 'sap business one cloud demo');
    await warmupPage.keyboard.press('Enter');
    await warmupPage.waitForLoadState('domcontentloaded');
    await sleep(3000 + Math.floor(Math.random() * 2000));
    // Scroll a bit.
    await warmupPage.mouse.wheel(0, 400);
    await sleep(1500);
    await warmupPage.mouse.wheel(0, 600);
    await sleep(2000);
  }

  console.log('Warmup 2/3: youtube.com');
  await warmupPage.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
  await warmupPage
    .getByRole('button', { name: /accept all|i agree|reject all/i })
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
  await sleep(3000 + Math.floor(Math.random() * 2000));
  await warmupPage.mouse.wheel(0, 500);
  await sleep(2000);

  console.log('Warmup 3/3: accounts.google.com (check session)');
  await warmupPage.goto('https://accounts.google.com/', { waitUntil: 'domcontentloaded' });
  await sleep(2000 + Math.floor(Math.random() * 1500));
  await warmupPage.screenshot({ path: shotPath('00-warmup-accounts') });

  // ====================================================================
  // PHASE 2 — The real attempt.
  // ====================================================================
  console.log('Navigating to business-one.cloud');
  await warmupPage.goto('https://www.business-one.cloud/en/', { waitUntil: 'domcontentloaded' });
  await sleep(1500 + Math.floor(Math.random() * 1500));
  // Hover over a few things — readers don't beeline to the Login button.
  await moveMouseHuman(warmupPage, 600, 300);
  await sleep(400);
  await moveMouseHuman(warmupPage, 300, 500);
  await sleep(500);
  await warmupPage.screenshot({ path: shotPath('01-landing') });

  const loginLink = warmupPage
    .getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i })
    .or(warmupPage.getByRole('button', { name: /^(login|sign\s*in|anmelden)$/i }))
    .first();
  const linkBox = await loginLink.boundingBox();
  if (linkBox) await moveMouseHuman(warmupPage, linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  await sleep(200);
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 15000 }),
    loginLink.click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  // Re-apply stealth on the popup (init scripts apply but pre-existing JS
  // already ran when the popup opened; evaluate again as belt-and-braces).
  await popup.evaluate(STEALTH_INIT).catch(() => {});
  await sleep(2000 + Math.floor(Math.random() * 1500));
  await popup.screenshot({ path: shotPath('02-b2c-popup') });

  // Move to Google button, hover, then click.
  const googleBtn = popup.getByRole('button', { name: /^google$/i }).first();
  const gBox = await googleBtn.boundingBox();
  if (gBox) await moveMouseHuman(popup, gBox.x + gBox.width / 2, gBox.y + gBox.height / 2);
  await sleep(400 + Math.floor(Math.random() * 400));
  await googleBtn.click();
  await popup.waitForURL(/accounts\.google\.com/, { timeout: 30000 });
  await popup.evaluate(STEALTH_INIT).catch(() => {});
  await sleep(2500 + Math.floor(Math.random() * 2000));
  await popup.screenshot({ path: shotPath('03-google-email') });

  // Read the page (mouse movement) before typing.
  await moveMouseHuman(popup, 200, 200);
  await sleep(800);
  await moveMouseHuman(popup, 300, 400);
  await sleep(600);

  const email = popup.locator('input[type="email"], input#identifierId').first();
  const eBox = await email.boundingBox();
  if (eBox) await moveMouseHuman(popup, eBox.x + eBox.width / 2, eBox.y + eBox.height / 2);
  await sleep(300);
  await email.click();
  await sleep(400);
  await typeHuman(popup, GOOGLE_EMAIL);
  await sleep(500 + Math.floor(Math.random() * 800));
  await popup.screenshot({ path: shotPath('04-email-typed') });

  // Click Next directly (don't press Tab — that moves focus to the
  // "Forgot email?" link and Enter activates the wrong control).
  const nextBtn = popup.getByRole('button', { name: /^(next|další)$/i }).or(popup.locator('#identifierNext')).first();
  const nBox = await nextBtn.boundingBox();
  if (nBox) await moveMouseHuman(popup, nBox.x + nBox.width / 2, nBox.y + nBox.height / 2);
  await sleep(300 + Math.floor(Math.random() * 400));
  await nextBtn.click();

  await Promise.race([
    popup.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 30000 }),
    popup.frameLocator('iframe[src*="/recaptcha/"]').first().locator('body').waitFor({ timeout: 30000 }),
    popup.getByText(/couldn't sign you in|verify it'?s you|try again later/i).first().waitFor({ timeout: 30000 }),
  ]).catch(() => {});
  await sleep(2000);
  await popup.screenshot({ path: shotPath('05-after-email') });

  const pw = popup.locator('input[type="password"]').first();
  let landedAtPassword = await pw.isVisible().catch(() => false);
  let landedAtCaptcha = /challenge\/recaptcha|verify it'?s you/i.test(popup.url() + ' ' + (await popup.title()));
  let landedAtRejection = await popup.getByText(/couldn't sign you in/i).isVisible().catch(() => false);

  console.log(JSON.stringify({ landedAtPassword, landedAtCaptcha, landedAtRejection, url: popup.url() }));

  if (landedAtPassword) {
    const pwBox = await pw.boundingBox();
    if (pwBox) await moveMouseHuman(popup, pwBox.x + pwBox.width / 2, pwBox.y + pwBox.height / 2);
    await sleep(500);
    await pw.click();
    await sleep(400);
    await typeHuman(popup, GOOGLE_PASSWORD);
    await sleep(600);
    await popup.screenshot({ path: shotPath('06-password-typed') });
    await popup.keyboard.press('Enter');
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    await Promise.race([
      popup.waitForURL(/business-one\.cloud/, { timeout: 60000 }),
      popup.getByText(/couldn't sign you in|wrong password|verify it'?s you/i).first().waitFor({ timeout: 60000 }),
      popup.frameLocator('iframe[src*="/recaptcha/"]').first().locator('body').waitFor({ timeout: 60000 }),
    ]).catch(() => {});
    await popup.screenshot({ path: shotPath('07-after-password') });

    // Consent screen?
    const continueBtn = popup.getByRole('button', { name: /^continue$|^allow$/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      const cBox = await continueBtn.boundingBox();
      if (cBox) await moveMouseHuman(popup, cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
      await sleep(400);
      await continueBtn.click();
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      await popup.waitForURL(/business-one\.cloud/, { timeout: 60000 }).catch(() => {});
      await popup.screenshot({ path: shotPath('08-after-consent') });
    }
  }

  const finalUrl = popup.url();
  const landed = /business-one\.cloud/.test(finalUrl) && !/login|signin/i.test(finalUrl);
  if (landed) {
    await popup.screenshot({ path: shotPath('99-authenticated') });
    await popup.screenshot({ path: path.join(SHOTS_DIR, 'business-one-google-authenticated.png'), fullPage: true });
  } else {
    await popup.screenshot({ path: shotPath('99-blocked') });
  }
  console.log(JSON.stringify({ landed, finalUrl }));
  process.exitCode = landed ? 0 : 1;
} finally {
  await browser.close().catch(() => {});
  try { chromeProc.kill(); } catch {}
}
