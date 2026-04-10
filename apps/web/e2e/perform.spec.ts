import { expect, test } from '@playwright/test';
import { TEST_TRACK_ID } from './helpers/seed-data';

test.describe('Performance mode', () => {
  test.beforeEach(async ({ page }) => {
    // Establish dev auth session
    await page.goto('/dashboard');
    await page.waitForURL('/dashboard');
  });

  test('perform route loads and responds', async ({ page }) => {
    const response = await page.goto(`/perform/${TEST_TRACK_ID}`);
    // The page should either render the perform UI or show an error
    // (404/400 if track not in DB). Either way, no 500.
    expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(500);
  });
});
