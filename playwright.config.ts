import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['external/**'],
      use: {
        browserName: 'chromium',
        baseURL: 'https://bot-arena.jhero.app',
      },
    },
    {
      name: 'external',
      testMatch: 'external/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        // Each external spec navigates to its own SUT URL; no shared baseURL.
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        video: { mode: 'on', size: { width: 1280, height: 720 } },
        // Bound each action so the demo video doesn't sit on a 3-minute hang
        // when the documented o-spreadsheet selectors don't resolve.
        actionTimeout: 15_000,
      },
    },
  ],
});
