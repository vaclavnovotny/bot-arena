import { test, expect } from '@playwright/test';
import { parseCssLength } from './helpers';

// Target: Odoo Online public demo. demo.odoo.com provisions a fresh subdomain
// per visit (e.g. demo2.odoo.com, demo3.odoo.com); we navigate to the canonical
// entry URL and follow the redirect.
//
// Verified 2026-05-14 (Odoo 17/18 demo):
//   - https://demo.odoo.com/ redirects to https://demo{N}.odoo.com/odoo (random N)
//   - https://demo.odoo.com/start?demo redirects to /start?demo= which 404s — do NOT use
//   - Gantt view lives at /odoo/all-tasks?view_type=gantt (not /odoo/project)
//   - View switcher buttons: List / Kanban / Calendar / Gantt / Map / Activity / Pivot / Graph
//   - The default landing at /odoo/project shows a Project Kanban; Tasks > All Tasks gives Gantt
//
// DOM selector verification (Odoo 17/18 community bundle):
//   - .o_gantt_pill           — CONFIRMED (15 pills visible in May-2026 viewport)
//   - .o_gantt_cell           — CONFIRMED (116 cells); has data-col + data-row-id, NO data-date
//   - .o_gantt_pill_wrapper   — wraps each pill; has data-pill-id + CSS grid-column, NO data-start
//   - .o_gantt_record         — NOT present (0 found)
//   - CSS var --o-gantt-day-width — NOT exposed on :root or .o_gantt_view
//
// Documented failure modes (by design — both tests must fail):
//   Naive:       .o_gantt_cell[data-date="…"] resolves to 0 elements → dragTo() fails
//   Best-effort: --o-gantt-day-width is unset → parseCssLength returns null → pixel math is 0
//                and even if math were correct, the snap-to-grid logic would offset the result
//
// Visible task names (May 2026 viewport, grouped by assignee):
//   Unassigned: "Create new components", "Unit Testing"
//   Marc Demo:  "Planning and budget", "Social network integration", "Usability review"
//   Mitchell Admin: "Planning and budget", "User interface improvements", "Usability review"
//
// If the demo rotates task names, the naive test will also fail at the getByRole() step
// rather than the dragTo() step — both are documented failure modes.

const START_URL = 'https://demo.odoo.com/';
const ALL_TASKS_GANTT_PATH = '/odoo/all-tasks';

test.describe('Odoo demo — drag a Gantt task to reschedule', () => {
  test('naive: dragTo() the task pill onto a target cell', { tag: '@external' }, async ({ page }) => {
    await page.goto(START_URL);
    // demo.odoo.com redirects to a random subdomain (demo{N}.odoo.com);
    // wait for any URL under *.odoo.com that has settled past /odoo
    await page.waitForURL((url) => url.hostname.endsWith('.odoo.com') && url.pathname.startsWith('/odoo'), { timeout: 30_000 });

    // Navigate to All Tasks in Gantt view (the project /odoo/project default is Kanban)
    const base = new URL(page.url());
    await page.goto(`${base.origin}${ALL_TASKS_GANTT_PATH}?view_type=gantt`);

    // Cells do NOT carry a data-date attribute (verified: only data-col and data-row-id exist).
    // This locator resolves to 0 elements; dragTo() will throw with "strict mode violation: 0".
    const task = page.locator('.o_gantt_pill_wrapper').filter({ has: page.locator('.o_gantt_pill_title', { hasText: /Create new components/i }) }).first();
    const targetCell = page.locator('.o_gantt_cell[data-date="2026-06-12"]');
    await task.dragTo(targetCell);

    // Pills carry data-pill-id (e.g. "__pill__1"), NOT data-start.
    // This assertion would also fail independently of the drag.
    await expect(task).toHaveAttribute('data-start', '2026-06-12');
  });

  test('best-effort: manual mouse drag using a computed day-column width', { tag: '@external' }, async ({ page }) => {
    await page.goto(START_URL);
    await page.waitForURL((url) => url.hostname.endsWith('.odoo.com') && url.pathname.startsWith('/odoo'), { timeout: 30_000 });

    const base = new URL(page.url());
    await page.goto(`${base.origin}${ALL_TASKS_GANTT_PATH}?view_type=gantt`);

    // Attempt to read a CSS var the demo bundle does not expose.
    // Verified 2026-05-14: --o-gantt-day-width is NOT set on :root or .o_gantt_view.
    // parseCssLength() returns null; the test then has to use 0 for dayWidth,
    // which is the documented failure mode.
    const raw = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--o-gantt-day-width'),
    );
    const dayWidth = parseCssLength(raw);
    expect(dayWidth, 'demo bundle exposes a pixel day-width').not.toBeNull();

    // Use unfiltered .o_gantt_pill (not wrapper-filtered by task name like naive test)
    // because goal is to demo the pixel-drag failure mode, not drag a specific task.
    const task = page.locator('.o_gantt_pill').first();
    const b = await task.boundingBox();
    expect(b, 'task pill has a bounding box').not.toBeNull();

    const startX = b!.x + 10;
    const startY = b!.y + b!.height / 2;
    const endX = startX + 2 * (dayWidth ?? 0);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 20 });
    await page.mouse.up();

    // Pill wrappers carry data-pill-id (e.g. "__pill__1"), NOT data-start.
    // The drop snaps to an internal grid offset, not the pixel delta we
    // computed; this assertion fails even when pixel math is correct.
    await expect(task).toHaveAttribute('data-start', '2026-06-12');
  });
});
