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
  // Print to stderr via stdout (Playwright list reporter preserves console output).
  // Format: indented block under the test title for readability.
  const lines: string[] = [];
  lines.push(`\n      --- Level ${level} Detection Log ---`);
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

test.describe('bot-arena — Playwright should be caught at every level', () => {
  test('Level 1 — passive webdriver flags', async ({ page }) => {
    await page.goto('/level/1/');
    await page.waitForFunction(
      () => (window as unknown as { __bus?: { snapshot: () => unknown[] } }).__bus?.snapshot().length! >= 5,
      null,
      { timeout: 10_000 }
    );
    const events = await readLog(page);
    reportEvents(1, events);
    const fails = events.filter((e) => e.status === 'fail');
    expect(fails.length, 'Level 1 should have at least one FAIL signal when run by Playwright').toBeGreaterThan(0);
  });

  test('Level 2 — CDP attachment probes', async ({ page }) => {
    await page.goto('/level/2/');
    await page.waitForFunction(
      () => (window as unknown as { __bus?: { snapshot: () => unknown[] } }).__bus?.snapshot().length! >= 4,
      null,
      { timeout: 10_000 }
    );
    const events = await readLog(page);
    reportEvents(2, events);
    const fails = events.filter((e) => e.status === 'fail');
    expect(fails.length, 'Level 2 should have at least one FAIL signal when run by Playwright').toBeGreaterThan(0);
  });

  test('Level 3 — mouse trajectory + keystroke cadence', async ({ page }) => {
    await page.goto('/level/3/');
    // Stock Playwright click: jumps to coords with no intermediate mousemoves.
    await page.locator('input[name="email"]').click();
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('hunter2');
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(
      () =>
        (window as unknown as { __bus?: { snapshot: () => DetectionEvent[] } })
          .__bus?.snapshot()
          .some((e) => e.id === 'mouse-trajectory'),
      null,
      { timeout: 10_000 }
    );
    const events = await readLog(page);
    reportEvents(3, events);
    const trajectoryFail = events.find((e) => e.id === 'mouse-trajectory');
    expect(
      trajectoryFail?.status,
      'Mouse trajectory should FAIL — stock page.click() has no intermediate moves'
    ).toBe('fail');
  });

  test('Level 4 — fingerprint battery (canvas, audio, WebGL, fonts)', async ({ page }) => {
    await page.goto('/level/4/');
    await page.waitForFunction(
      () => (window as unknown as { __bus?: { snapshot: () => unknown[] } }).__bus?.snapshot().length! >= 4,
      null,
      { timeout: 15_000 }
    );
    const events = await readLog(page);
    reportEvents(4, events);
    const fails = events.filter((e) => e.status === 'fail');
    // Note: canvas/audio denylists are empty in v1, so this will likely only catch
    // WebGL renderer (SwiftShader) and the font probe. Still expect ≥1 FAIL on headless.
    expect(
      fails.length,
      'Level 4 should catch at least the WebGL renderer (SwiftShader) on headless Chromium'
    ).toBeGreaterThan(0);
  });

  test('Level 5 — Cloudflare Turnstile', async ({ page }) => {
    await page.goto('/level/5/');
    // Give the Turnstile widget a chance to either auto-solve (it won't, for Playwright)
    // or fail-callback. We're not solving it manually — that's the point of the level.
    await page.waitForTimeout(6000);
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('hunter2');
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(
      () =>
        (window as unknown as { __bus?: { snapshot: () => DetectionEvent[] } })
          .__bus?.snapshot()
          .some((e) => e.id === 'turnstile'),
      null,
      { timeout: 15_000 }
    );
    const events = await readLog(page);
    reportEvents(5, events);
    const turnstile = events.find((e) => e.id === 'turnstile');
    expect(turnstile?.status, 'Turnstile verification should FAIL for Playwright (no token / siteverify fail)').toBe(
      'fail'
    );
  });
});
