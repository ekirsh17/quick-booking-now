import { test, expect, ROUTES } from './fixtures/base';

/**
 * Smoke tests to verify basic app functionality
 */
test.describe('Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto(ROUTES.landing);
    
    // Should see the OpenAlert branding
    await expect(page.locator('text=OpenAlert').first()).toBeVisible();
  });

  test('merchant login page loads', async ({ page }) => {
    await page.goto(ROUTES.merchantLogin);
    
    // Should see login form
    await expect(page.locator('text=Business Portal')).toBeVisible();
    await expect(page.locator('text=Sign In or Sign Up')).toBeVisible();
  });

  test('consumer sign-in page loads', async ({ page }) => {
    await page.goto(ROUTES.consumerSignIn);
    
    // Should see consumer sign-in form
    await expect(page.locator('input[type="tel"], [placeholder*="phone" i]').first()).toBeVisible({ timeout: 10000 });
  });

  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto(ROUTES.notFound);
    
    // Should see 404 indication
    await expect(page.locator('text=/404|not found|page.*exist/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('tools page loads', async ({ page }) => {
    await page.goto(ROUTES.tools);
    
    // Should load without error
    await expect(page).toHaveURL(/\/tools/);
  });
});









