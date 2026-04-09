import { expect, test } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('landing page shows Nuit One branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Nuit');
    await expect(page.locator('h1')).toContainText('One');
  });

  test('login page shows dev mode bypass', async ({ page }) => {
    await page.goto('/auth/login');
    const devLink = page.getByRole('link', { name: /continue.*dev/i });
    await expect(devLink).toBeVisible();
    await expect(devLink).toHaveAttribute('href', '/dashboard');
  });

  test('dev mode bypass reaches dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /continue.*dev/i }).click();
    await page.waitForURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Nuit');
  });
});
