import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate through dev auth to set the session cookie
    await page.goto('/auth/login');
    await page.getByRole('link', { name: /continue.*dev/i }).click();
    await page.waitForURL('/dashboard');
  });

  test('page loads with upload section', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /upload a song/i });
    await expect(heading).toBeVisible();
  });

  test('page shows YouTube import section', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /import from youtube/i });
    await expect(heading).toBeVisible();
  });

  test('page shows tracks section', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /your tracks/i });
    await expect(heading).toBeVisible();
  });
});
