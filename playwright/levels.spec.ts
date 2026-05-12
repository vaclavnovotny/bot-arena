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

async function expectSignedIn(page: Page): Promise<void> {
  const form = page.locator('form[data-arena-form]');
  await expect(
    form,
    'expected the sign-in to succeed (data-arena-state="granted") but the bot was blocked'
  ).toHaveAttribute('data-arena-state', 'granted', { timeout: 15_000 });
  await expect(
    form.locator('[data-arena-granted]'),
    'visible "✓ Access granted" message should be shown'
  ).toBeVisible();
}

// Print the Detection Log after every test so failures show exactly which signals
// caught the bot. Reads the bus from the page; safely no-ops if the page is gone.
test.afterEach(async ({ page }, testInfo) => {
  try {
    if (!page.isClosed()) {
      const events = await readLog(page);
      const levelMatch = testInfo.title.match(/Level (\d)/);
      const level = levelMatch ? Number(levelMatch[1]) : 0;
      reportEvents(level, events);
    }
  } catch {
    // page navigated away or context closed — nothing to report
  }
});

test.describe('Automation suite — try to sign in at every level', () => {
  test('Level 1 — sign in', async ({ page }) => {
    await page.goto('/level/1/');
    await waitForEventCount(page, 6);
    await attemptSignIn(page);
    await expectSignedIn(page);
  });

  test('Level 2 — sign in', async ({ page }) => {
    await page.goto('/level/2/');
    await waitForEventCount(page, 5);
    await attemptSignIn(page);
    await expectSignedIn(page);
  });

  test('Level 3 — sign in', async ({ page }) => {
    await page.goto('/level/3/');
    await waitForEventCount(page, 1); // wait for the "trajectory armed" info event
    await attemptSignIn(page);
    await expectSignedIn(page);
  });

  test('Level 4 — sign in', async ({ page }) => {
    await page.goto('/level/4/');
    await waitForEventCount(page, 4);
    await attemptSignIn(page);
    await expectSignedIn(page);
  });

  test('Level 5 — sign in', async ({ page }) => {
    await page.goto('/level/5/');
    // Give Turnstile a few seconds to evaluate. If it doesn't issue a token
    // (likely for Playwright) submit will produce the 'no token' FAIL.
    await page.waitForTimeout(5_000);
    await attemptSignIn(page);
    await expectSignedIn(page);
  });
});
