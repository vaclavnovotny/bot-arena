// NOTE: The selector `canvas[data-cy="graphics-canvas"]` is UNVERIFIED.
// Onshape redirects all document URLs to the sign-in page when unauthenticated,
// so the canvas could not be inspected without credentials. The selector is taken
// from the plan as-is; update it once a test account is available and the
// part-studio page can be inspected.

import { test, expect } from '@playwright/test';
import { canvasCentre } from './helpers';

// Target: Onshape Free public part-studio. Set ONSHAPE_TEST_EMAIL and
// ONSHAPE_TEST_PASSWORD in .env (see .env.example).
const PART_STUDIO_URL = process.env.ONSHAPE_PART_STUDIO_URL ?? '';
const EMAIL = process.env.ONSHAPE_TEST_EMAIL ?? '';
const PASSWORD = process.env.ONSHAPE_TEST_PASSWORD ?? '';

test.beforeAll(() => {
  if (!PART_STUDIO_URL || !EMAIL || !PASSWORD) {
    test.skip(true, 'Onshape credentials not configured; see .env.example');
  }
});

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('https://cad.onshape.com/signin');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/cad\.onshape\.com\/documents/, { timeout: 30_000 });
}

test.describe('Onshape Free — click a face on a 3D WebGL viewport', () => {
  test('naive: click an accessible "Front face" element', { tag: '@external' }, async ({ page }) => {
    await signIn(page);
    await page.goto(PART_STUDIO_URL);

    // The WebGL viewport has no DOM children. There is no element named
    // "Front face" to locate; the role query resolves to 0 elements.
    await page.getByRole('button', { name: /front face/i }).click();

    await expect(page.locator('[data-selected-face="front"]')).toBeVisible();
  });

  test('best-effort: click the viewport centroid', { tag: '@external' }, async ({ page }) => {
    await signIn(page);
    await page.goto(PART_STUDIO_URL);

    const viewport = page.locator('canvas[data-cy="graphics-canvas"]').first();
    await expect(viewport).toBeVisible({ timeout: 30_000 });

    const box = await viewport.boundingBox();
    expect(box, 'WebGL canvas has a bounding box').not.toBeNull();

    const { x, y } = canvasCentre(box!);
    await page.mouse.click(x, y);

    // The viewport centre is the front face only if the camera happens to be
    // facing the model squarely. The default ISO view in Onshape lands the
    // centre on an edge or a different face; the assertion fails.
    await expect(page.locator('[data-selected-face]')).toHaveAttribute('data-selected-face', 'front');
  });
});
