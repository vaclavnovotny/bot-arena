import { test, expect } from '@playwright/test';

test.describe('Bot detection', () => {
  test('Level 1 sign in', async ({ page }) => {
    await page.goto('/bot-detection/level-1/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 2 sign in', async ({ page }) => {
    await page.goto('/bot-detection/level-2/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 3 sign in', async ({ page }) => {
    await page.goto('/bot-detection/level-3/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 4 sign in', async ({ page }) => {
    await page.goto('/bot-detection/level-4/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 5 sign in', async ({ page }) => {
    await page.goto('/bot-detection/level-5/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });
});

test.describe('Selector resistance', () => {
  test('Level 1 sign in', async ({ page }) => {
    await page.goto('/selector-resistance/level-1/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 2 sign in', async ({ page }) => {
    await page.goto('/selector-resistance/level-2/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 3 sign in', async ({ page }) => {
    await page.goto('/selector-resistance/level-3/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });

  test('Level 4 sign in', async ({ page }) => {
    await page.goto('/selector-resistance/level-4/');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('hunter2');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Access granted')).toBeVisible();
  });
});
