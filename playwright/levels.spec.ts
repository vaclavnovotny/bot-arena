import { test, expect, type Page } from '@playwright/test';

interface DetectionEvent {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'info';
  detail?: string;
  ts: number;
}

async function readLog(page: Page): Promise<DetectionEvent[]> {
  return page.evaluate(
    () => (window as unknown as { __bus: { snapshot: () => DetectionEvent[] } }).__bus.snapshot()
  );
}

function reportEvents(level: number, events: DetectionEvent[]): void {
  const lines: string[] = [`\n      --- Level ${level} Detection Log ---`];
  for (const e of events) {
    const tag = e.status.toUpperCase().padEnd(4);
    const detail = e.detail ? ` — ${e.detail}` : '';
    lines.push(`      [${tag}] ${e.id}${detail}`);
  }
  const fails = events.filter((e) => e.status === 'fail').length;
  const passes = events.filter((e) => e.status === 'pass').length;
  const infos = events.filter((e) => e.status === 'info').length;
  lines.push(`      → ${fails} FAIL, ${passes} PASS, ${infos} INFO`);
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

async function waitForEventCount(page: Page, n: number, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    (count) =>
      (window as unknown as { __bus?: { snapshot: () => unknown[] } }).__bus?.snapshot().length! >= count,
    n,
    { timeout: timeoutMs }
  );
}

async function attemptSignIn(page: Page): Promise<void> {
  await page.locator('input[name="email"]').fill('bot@example.com');
  await page.locator('input[name="password"]').fill('hunter2');
  await page.locator('button[type="submit"]').click();
}

async function assertBlocked(page: Page): Promise<void> {
  const form = page.locator('form[data-arena-form]');
  await expect(form, 'form should reach data-arena-state="blocked"').toHaveAttribute(
    'data-arena-state',
    'blocked',
    { timeout: 15_000 }
  );
  await expect(
    form.locator('[data-arena-blocked]'),
    'visible "✗ Blocked — bot detected" message should appear'
  ).toBeVisible();
}

test.describe('bot-arena — Playwright tries to sign in and gets blocked at every level', () => {
  test('Level 1 — sign in attempt is blocked by passive webdriver flags', async ({ page }) => {
    await page.goto('/level/1/');
    await waitForEventCount(page, 6); // six passive checks complete on page load
    await attemptSignIn(page);
    await assertBlocked(page);
    reportEvents(1, await readLog(page));
  });

  test('Level 2 — sign in attempt is blocked by CDP / headless tells', async ({ page }) => {
    await page.goto('/level/2/');
    await waitForEventCount(page, 5); // five Level-2 probes complete on page load
    await attemptSignIn(page);
    await assertBlocked(page);
    reportEvents(2, await readLog(page));
  });

  test('Level 3 — sign in attempt is blocked by mouse trajectory scoring', async ({ page }) => {
    await page.goto('/level/3/');
    await waitForEventCount(page, 1); // wait for the "trajectory recorder armed" info event
    await attemptSignIn(page);
    await assertBlocked(page);
    reportEvents(3, await readLog(page));
  });

  test('Level 4 — sign in attempt is blocked by fingerprint signals', async ({ page }) => {
    await page.goto('/level/4/');
    await waitForEventCount(page, 4); // canvas/audio/webgl/font checks
    await attemptSignIn(page);
    await assertBlocked(page);
    reportEvents(4, await readLog(page));
  });

  test('Level 5 — sign in attempt is blocked by Cloudflare Turnstile', async ({ page }) => {
    await page.goto('/level/5/');
    // Give Turnstile a few seconds to either issue a token (it won't, for Playwright)
    // or render its interactive challenge. We're not solving anything manually.
    await page.waitForTimeout(5_000);
    await attemptSignIn(page);
    await assertBlocked(page);
    reportEvents(5, await readLog(page));
  });
});
