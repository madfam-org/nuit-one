import { expect, test } from '@playwright/test';

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    // Establish dev auth session
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');
  });

  test('library page loads with title', async ({ page }) => {
    await page.goto('/library');
    const heading = page.getByRole('heading', { name: /library/i });
    await expect(heading).toBeVisible();
  });

  test('library has Tracks and Projects tabs', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByText('Tracks')).toBeVisible();
    await expect(page.getByText('Projects')).toBeVisible();
  });
});
