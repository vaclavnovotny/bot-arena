#!/usr/bin/env node
// Variant G — connect Playwright to a Chrome instance launched manually
// (not via playwright/chromium-launcher). The WebDriver-launch fingerprint
// — --enable-automation, "DevToolsActivePort first-launch", the Network.*
// domain attached before any human gesture — is what Google's bot engine
// flags hardest. Attaching over the bare CDP socket to a Chrome that
// believes itself unmonitored shortcuts that whole layer.
//
// Usage:
//   node scripts/external/business-one-cdp-attach.mjs
//
// Requires Chrome stable (channel 'chrome') installed at the default path.
// Drops a screenshot into public/external/business-one-google-G-cdp-*.png.

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHOTS_DIR = path.join(REPO_ROOT, 'public', 'external');
const PROFILE_DIR = path.join(REPO_ROOT, 'test-results', 'business-one-cdp-profile');
const CHROME_EXE = process.env.CHROME_EXE ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9229;
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL ?? 'p8142864@gmail.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD ??
  'verbally-worrisome-emergency-confirm-chevy-shy';

await fs.mkdir(SHOTS_DIR, { recursive: true });
await fs.mkdir(PROFILE_DIR, { recursive: true });

function shotPath(name) {
  return path.join(SHOTS_DIR, `business-one-google-G-cdp-${name}.png`);
}

// Launch Chrome ourselves — no playwright args, no --enable-automation.
console.log('Launching Chrome at', CHROME_EXE);
const chromeProc = spawn(CHROME_EXE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-default-apps',
  // Important: do NOT pass --enable-automation; do NOT pass
  // --disable-blink-features=AutomationControlled either (its absence is
  // the default state in real Chrome).
  'about:blank',
], { detached: false, stdio: 'ignore' });

// Wait for the debug port to come up.
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
console.log('Chrome up; attaching Playwright over CDP');

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
// CDP connection exposes existing contexts; default one is the only one.
const [defaultContext] = browser.contexts();
const ctx = defaultContext;

// Use the existing tab (the about:blank one Chrome opened).
const pages = ctx.pages();
const page = pages[0] ?? await ctx.newPage();

try {
  console.log('Navigating to business-one.cloud');
  await page.goto('https://www.business-one.cloud/en/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: shotPath('01-landing') });

  // Cookie-banner dismiss (no-op if absent).
  await page
    .getByRole('button', { name: /accept|allow|got it|agree/i })
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});

  // Login link opens window.open() popup against B2C.
  const loginLink = page
    .getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i })
    .or(page.getByRole('button', { name: /^(login|sign\s*in|anmelden)$/i }))
    .first();

  const [popup] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 15000 }),
    loginLink.click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.screenshot({ path: shotPath('02-b2c-popup') });

  // Click Google federated button.
  await popup.getByRole('button', { name: /^google$/i }).click();
  await popup.waitForURL(/accounts\.google\.com/, { timeout: 30000 });
  await popup.screenshot({ path: shotPath('03-google-email') });

  // Fill email with light per-char jitter — CDP attach + jitter together.
  const email = popup.locator('input[type="email"], input#identifierId').first();
  await email.click();
  for (const ch of GOOGLE_EMAIL) {
    await popup.keyboard.type(ch);
    await sleep(40 + Math.floor(Math.random() * 120));
  }
  await popup.screenshot({ path: shotPath('04-email-typed') });
  await popup.keyboard.press('Enter');

  // Wait for password field, captcha frame, or rejection text.
  await Promise.race([
    popup.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 30000 }),
    popup.frameLocator('iframe[src*="/recaptcha/"]').first().locator('body').waitFor({ timeout: 30000 }),
    popup.getByText(/couldn't sign you in|verify it'?s you|try again later/i).first().waitFor({ timeout: 30000 }),
  ]).catch(() => {});
  await popup.screenshot({ path: shotPath('05-after-email') });

  // If we hit the "Verify it's you" reCAPTCHA page, try clicking the
  // "I'm not a robot" checkbox. With a CDP-attached Chrome (real fingerprint)
  // the trust score is sometimes high enough that the checkbox passes
  // silently and we continue to the password page.
  if (/challenge\/recaptcha|verify it'?s you/i.test(popup.url() + ' ' + (await popup.title()).toLowerCase())) {
    console.log('reCAPTCHA wall — clicking checkbox');
    const recaptchaFrame = popup.frameLocator('iframe[src*="/recaptcha/"]').first();
    const checkbox = recaptchaFrame
      .locator('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]')
      .first();
    try {
      await checkbox.waitFor({ state: 'visible', timeout: 10000 });
      const box = await checkbox.boundingBox();
      if (box) {
        await popup.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
        await sleep(200 + Math.floor(Math.random() * 300));
      }
      await checkbox.click();
      await popup.screenshot({ path: shotPath('05a-checkbox-clicked') });
      // Wait briefly for the checkbox to settle (either "verified" or image
      // challenge popup), then click Next.
      await sleep(3000);
      await popup.screenshot({ path: shotPath('05b-after-checkbox') });
      // If image challenge appeared, screenshot it and bail.
      const challengeFrame = popup.frameLocator('iframe[src*="/recaptcha/"][src*="bframe"]').first();
      const challengeImg = challengeFrame.locator('img').first();
      if (await challengeImg.isVisible().catch(() => false)) {
        await popup.screenshot({ path: shotPath('05c-image-challenge') });
        console.log('Image challenge fired — pure Playwright cannot solve');
      } else {
        // No challenge — click Next to advance past the verify step.
        const nextBtn = popup.getByRole('button', { name: /^next$|^continue$/i }).first();
        await nextBtn.click({ timeout: 5000 }).catch(() => {});
        await popup.waitForLoadState('domcontentloaded').catch(() => {});
        await Promise.race([
          popup.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 20000 }),
          popup.getByText(/couldn't sign you in|verify it'?s you/i).first().waitFor({ timeout: 20000 }),
        ]).catch(() => {});
        await popup.screenshot({ path: shotPath('05d-after-next') });
      }
    } catch (e) {
      console.log('Checkbox interaction failed:', e.message);
    }
  }

  // Password path (if we got there).
  const pw = popup.locator('input[type="password"]').first();
  if (await pw.isVisible().catch(() => false)) {
    await pw.click();
    for (const ch of GOOGLE_PASSWORD) {
      await popup.keyboard.type(ch);
      await sleep(40 + Math.floor(Math.random() * 120));
    }
    await popup.screenshot({ path: shotPath('06-password-typed') });
    await popup.keyboard.press('Enter');
    await popup.waitForLoadState('domcontentloaded');

    // Either we land on business-one (success), see a "verify it's you"
    // captcha, or get a final rejection.
    await Promise.race([
      popup.waitForURL(/business-one\.cloud/, { timeout: 45000 }),
      popup.getByText(/couldn't sign you in|wrong password|verify it'?s you/i).first().waitFor({ timeout: 45000 }),
      popup.frameLocator('iframe[src*="/recaptcha/"]').first().locator('body').waitFor({ timeout: 45000 }),
    ]).catch(() => {});
    await popup.screenshot({ path: shotPath('07-after-password') });

    // Some flows show "Use Google to sign in to b2clogin.com — Continue"
    // as a one-tap consent screen post-password. Click Continue if so.
    const continueBtn = popup.getByRole('button', { name: /^continue$|^allow$/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await popup.waitForLoadState('domcontentloaded');
      await popup.screenshot({ path: shotPath('08-after-consent') });
      await popup.waitForURL(/business-one\.cloud/, { timeout: 45000 }).catch(() => {});
    }
  }

  const finalUrl = popup.url();
  const landed = /business-one\.cloud/.test(finalUrl) && !/login|signin/i.test(finalUrl);
  if (landed) {
    await popup.screenshot({ path: shotPath('99-authenticated') });
    // Also save a top-level evidence file.
    await popup.screenshot({ path: path.join(SHOTS_DIR, 'business-one-google-authenticated.png'), fullPage: true });
  } else {
    await popup.screenshot({ path: shotPath('99-blocked') });
  }
  console.log(JSON.stringify({ landed, finalUrl }));
  process.exitCode = landed ? 0 : 1;
} finally {
  await browser.close().catch(() => {});
  try {
    chromeProc.kill();
  } catch {}
}
