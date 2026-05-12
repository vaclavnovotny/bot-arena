import { test, expect } from '@playwright/test';

test('Level 1 sign in', async ({ page }) => {
  await page.goto('/level/1/');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});

test('Level 2 sign in', async ({ page }) => {
  await page.goto('/level/2/');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});

test('Level 3 sign in', async ({ page }) => {
  await page.goto('/level/3/');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});

test('Level 4 sign in', async ({ page }) => {
  await page.goto('/level/4/');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});

test('Level 5 sign in', async ({ page }) => {
  await page.goto('/level/5/');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Access granted')).toBeVisible();
});
