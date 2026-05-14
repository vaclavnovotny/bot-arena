import { test, expect } from '@playwright/test';
import { ocr } from '../support';

// Target: Grafana Play public demo dashboard. Pinned at implementation time (2026-05-14).
// Dashboard: "1 - Time series features detailed overview" (Demo: Visualizations folder)
// URL verified by navigating play.grafana.org — the root / redirects to /d/to6j8mh/grafana-play-home,
// and the old UID 000000012 no longer exists. This dashboard is stable test data (TestData DB).
//
// Panel selector note: the current Grafana Play build (Grafana Cloud, ~v11) does NOT expose
// data-panel-name attributes. Panel containers are <section> elements with:
//   data-testid="data-testid Panel header {Panel Name}"
// The panel menu button uses:
//   data-testid="data-testid Panel menu {Panel Name}"
// We use the section/container form for screenshotting the full panel area.
//
// If the URL or panel name changes, update both constants below.
const DASHBOARD_URL = 'https://play.grafana.org/d/hxne1Hm4z/1-time-series-features-detailed-overview';
const PANEL_NAME = 'Lines';

test.describe('Grafana Play — read a canvas-rendered panel value', () => {
  test('naive: locate the latest value as DOM text', { tag: '@external' }, async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    // The panel renders its value into a <canvas> via uPlot. There is no DOM
    // text node containing the number that the human sees on the chart.
    // This test is expected to FAIL — it demonstrates that canvas-rendered
    // time-series values are not accessible as DOM text.
    await expect(page.getByText(/^\d{1,4}\s?ms$/i)).toBeVisible({ timeout: 10_000 });
  });

  test('best-effort: OCR the panel screenshot', { tag: '@external' }, async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    // Grafana Play (v11) uses data-testid="data-testid Panel header {name}" on the
    // <section> panel container. There is no data-panel-name attribute in this build.
    const panel = page.locator(`[data-testid="data-testid Panel header ${PANEL_NAME}"]`).first();
    await expect(panel).toBeVisible({ timeout: 15_000 });

    const buf = await panel.screenshot();
    const text = await ocr(buf);

    // The "Lines" panel shows values in the range 0–100 (dimensionless TestData).
    // OCR may or may not extract a clean number from the canvas-rendered chart.
    // The assertion below only proves OCR ran and returned something — not that
    // the value corresponds to the latest sample, because correlating a pixel
    // to a timestamp requires parsing the x-axis (also canvas pixels).
    expect(text, `OCR returned empty string`).toBeTruthy();

    // If OCR did extract digits, they should be plausible chart values (< 10000).
    const m = text.match(/(\d{1,4})/);
    if (m) {
      expect(Number(m[1])).toBeLessThan(10_000);
    }
  });
});
