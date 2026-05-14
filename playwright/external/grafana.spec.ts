import { test, expect } from '@playwright/test';

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

  test('best-effort: hover over the chart canvas and read the DOM tooltip', { tag: '@external' }, async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    const panel = page.locator(`[data-testid="data-testid Panel header ${PANEL_NAME}"]`).first();
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // Hover near the right edge of the panel — the latest data point on a time
    // series chart. Grafana's tooltip is DOM (rendered by uPlot's tooltip
    // plugin), so a synthetic mouse.move SHOULD make it appear. In practice the
    // tooltip dismisses on every mouse move and binds to whichever x-coordinate
    // the cursor lands on — not "the latest sample".
    const box = await panel.boundingBox();
    expect(box, 'panel has a bounding box').not.toBeNull();
    const x = box!.x + box!.width - 20;        // 20px in from the right edge
    const y = box!.y + box!.height / 2;
    await page.mouse.move(x, y);

    // The tooltip selector is uPlot-specific; in current Grafana it has
    // role="tooltip" and lives in a portal at the document root.
    const tooltip = page.getByRole('tooltip').first();
    await expect(tooltip).toBeVisible({ timeout: 5_000 });

    // Even if the tooltip appears, its value corresponds to the cursor x-position,
    // not "the latest sample" — and PW cannot prove which time bucket the value
    // represents without parsing the (canvas-rendered) x-axis label.
    const text = await tooltip.textContent();
    expect(text, 'tooltip has text').not.toBeNull();
    expect(text!.length).toBeGreaterThan(0);
  });
});
