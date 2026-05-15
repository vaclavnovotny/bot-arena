#!/usr/bin/env node
// Storage-state bootstrap — the canonical Playwright pattern for SaaS
// gated by anti-automation IdPs. Opens a CDP-attached real Chrome, drives
// the flow up to Google's "Verify it's you" page, and then *waits* for a
// human to complete the captcha + password + consent. Once the popup tab
// redirects back to business-one.cloud with an authenticated session, the
// script exports the full context's storage state to scripts/external/
// auth.json. Subsequent replay runs need no Google interaction.
//
// One-time human action: solve the captcha + type the password.
// Everything before and after is pure @playwright/test code.

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROFILE_DIR = path.join(REPO_ROOT, 'test-results', 'business-one-bootstrap-profile');
const AUTH_FILE = path.join(__dirname, 'auth.json');
const CHROME_EXE = process.env.CHROME_EXE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9231;
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL ?? 'p8142864@gmail.com';
const WAIT_FOR_HUMAN_MS = parseInt(process.env.WAIT_FOR_HUMAN_MS ?? `${30 * 60 * 1000}`, 10); // default 30 min

await fs.mkdir(PROFILE_DIR, { recursive: true });

console.log('Launching Chrome — you will be asked to solve a captcha + sign in.');
const chromeProc = spawn(CHROME_EXE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-default-apps',
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
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const [ctx] = browser.contexts();

try {
  const page = ctx.pages()[0] ?? await ctx.newPage();
  console.log('Navigating to business-one.cloud');
  await page.goto('https://www.business-one.cloud/en/', { waitUntil: 'domcontentloaded' });
  await page.bringToFront();

  console.log('Clicking Login');
  const loginLink = page.getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i }).first();
  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 15000 }),
    loginLink.click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.bringToFront();

  console.log('Clicking Google on B2C popup');
  await popup.getByRole('button', { name: /^google$/i }).click();
  await popup.waitForURL(/accounts\.google\.com/, { timeout: 30000 });

  console.log('Filling email');
  await popup.locator('input[type="email"], input#identifierId').first().fill(GOOGLE_EMAIL);
  const nextBtn = popup.getByRole('button', { name: /^next$/i }).or(popup.locator('#identifierNext')).first();
  await nextBtn.click();

  // From here it's all yours. Solve the captcha, type the password, click
  // any consent screens. We just poll for either:
  //   - popup.url() back on business-one.cloud (success)
  //   - popup closing (B2C auto-closes the popup after success in some flows)
  //   - original page URL changing to something authenticated
  console.log('====================================================');
  console.log('HUMAN: please complete the captcha + password + any');
  console.log('consent screens in the Chrome window. The script is');
  console.log('polling for success — will continue automatically.');
  console.log('====================================================');

  const start = Date.now();
  let success = false;
  let landingUrl = '';

  // Helper: check if a page DOM shows an authenticated state. SAP Business
  // One Cloud's web client renders the user email in the header after
  // login and replaces the "Login" CTA with a sign-out/profile control.
  async function isAuthed(p) {
    try {
      const txt = await p.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
      if (/sign\s*out|log\s*out|abmelden|^logout$/m.test(txt)) return true;
      // The test account's email appearing in the DOM is a strong signal.
      if (txt.includes('p8142864@gmail.com')) return true;
      // Specific SAP B1 dashboard markers.
      if (/web client|browser access|main menu/i.test(txt) && !/welcome to sap business one cloud/i.test(txt)) return true;
    } catch {}
    return false;
  }

  while (Date.now() - start < WAIT_FOR_HUMAN_MS) {
    // Strong signal #1: the popup closed AND the original page is on
    // business-one.cloud AND DOM shows authed state.
    try {
      if (popup.isClosed?.() && /business-one\.cloud/.test(page.url())) {
        if (await isAuthed(page)) {
          success = true;
          landingUrl = page.url();
          break;
        }
      }
    } catch {}
    // Strong signal #2: any page in the context is on a business-one URL
    // path that is NOT the marketing landing (i.e. dashboard / app / portal).
    for (const p of ctx.pages()) {
      try {
        const u = p.url();
        if (!/business-one\.cloud/.test(u)) continue;
        const url = new URL(u);
        const pathOnly = url.pathname; // ignores hash + query
        // Marketing/landing paths to exclude.
        if (/^\/$|^\/en\/?$|^\/de\/?$|^\/en\/signup\/?$|^\/de\/signup\/?$/.test(pathOnly)) continue;
        if (/signin|login|b2credirect\.html/i.test(pathOnly)) continue;
        // Any other path on business-one.cloud is a strong signal of auth.
        success = true;
        landingUrl = u;
        break;
      } catch {}
    }
    if (success) break;
    // Strong signal #3: a still-open page that shows an authed DOM.
    for (const p of ctx.pages()) {
      if (/business-one\.cloud/.test(p.url()) && await isAuthed(p)) {
        success = true;
        landingUrl = p.url();
        break;
      }
    }
    if (success) break;
    await sleep(2000);
  }

  if (!success) {
    console.error('TIMEOUT: 10 minutes elapsed without reaching an authenticated business-one.cloud URL');
    process.exitCode = 2;
  } else {
    console.log('Authenticated. URL:', landingUrl);
    await ctx.storageState({ path: AUTH_FILE });
    const stats = await fs.stat(AUTH_FILE);
    console.log(`Saved storage state to ${AUTH_FILE} (${stats.size} bytes)`);
  }
} finally {
  await browser.close().catch(() => {});
  try { chromeProc.kill(); } catch {}
}
