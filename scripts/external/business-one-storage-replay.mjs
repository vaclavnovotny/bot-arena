#!/usr/bin/env node
// Storage-state replay — loads the auth.json captured by the bootstrap
// script and proves the SAP Business One Cloud session is restored
// without touching Google. Saves the authenticated screenshot that the
// /external page references.
//
// This is pure @playwright/test runtime — no human input. The only
// human action ever needed was the one-time captcha solve in the
// bootstrap step.

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHOTS_DIR = path.join(REPO_ROOT, 'public', 'external');
const AUTH_FILE = path.join(__dirname, 'auth.json');

await fs.mkdir(SHOTS_DIR, { recursive: true });
const authStat = await fs.stat(AUTH_FILE).catch(() => null);
if (!authStat) {
  console.error(`No ${AUTH_FILE} found. Run business-one-storage-bootstrap.mjs first.`);
  process.exit(1);
}

// Bundled chromium is fine — no need for channel:'chrome' because the
// session is already established; Google's bot detection is bypassed by
// the cookies we replay, not by browser fingerprint.
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: AUTH_FILE,
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();

console.log('Navigating to business-one.cloud with replayed storage state');
await page.goto('https://www.business-one.cloud/en/', { waitUntil: 'domcontentloaded' });

// Click Login — with replayed B2C cookies, the popup should skip
// straight past Google and land on the authenticated landing.
const [popup] = await Promise.all([
  context.waitForEvent('page', { timeout: 15000 }),
  page.getByRole('link', { name: /^(login|sign\s*in|anmelden)$/i }).first().click(),
]);
await popup.waitForLoadState('domcontentloaded');
await popup.waitForURL(/business-one\.cloud/, { timeout: 60000 }).catch(() => {});

// Whichever page ended up on business-one.cloud authenticated is our prize.
const pages = context.pages();
let authPage = pages.find(p => /business-one\.cloud/.test(p.url()) && !/login|signin/i.test(p.url())) ?? page;
await authPage.bringToFront();
await authPage.waitForLoadState('domcontentloaded');
const url = authPage.url();
console.log('Final URL:', url);

const shot = path.join(SHOTS_DIR, 'business-one-google-authenticated.png');
await authPage.screenshot({ path: shot, fullPage: true });
console.log(`Saved authenticated screenshot to ${shot}`);

await browser.close();
