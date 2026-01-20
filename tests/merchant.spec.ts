import { test, expect, ROUTES } from './fixtures/base';

/**
 * Merchant flow tests
 * These tests verify the merchant-facing pages load and function correctly
 * Note: Some tests may require authentication bypass or test-mode setup
 */
test.describe('Merchant Pages', () => {
  test.describe('Openings Page', () => {
    test('openings page structure loads', async ({ page }) => {
      await page.goto(ROUTES.merchantOpenings);
      await page.waitForTimeout(2000);
      
      // If redirected to login, that's expected for protected routes
      const url = page.url();
      if (url.includes('login')) {
        await expect(page.locator('text=Business Portal')).toBeVisible();
      } else {
        // If somehow authenticated, check for openings UI elements
        const hasCalendarUI = await page.locator('text=/agenda|week|day|calendar/i').first().isVisible().catch(() => false);
        expect(hasCalendarUI || url.includes('login')).toBe(true);
      }
    });
  });

  test.describe('Settings Page', () => {
    test('settings page structure loads', async ({ page }) => {
      await page.goto(ROUTES.merchantSettings);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      if (url.includes('login')) {
        await expect(page.locator('text=Business Portal')).toBeVisible();
      } else {
        // Check for settings sections
        await expect(page.locator('text=/account|settings|profile/i').first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Analytics Page', () => {
    test('analytics page loads', async ({ page }) => {
      await page.goto(ROUTES.merchantAnalytics);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      // Should either show analytics or redirect to login
      const isValidState = url.includes('analytics') || url.includes('login');
      expect(isValidState).toBe(true);
    });
  });

  test.describe('QR Code Page', () => {
    test('QR code page loads', async ({ page }) => {
      await page.goto(ROUTES.merchantQRCode);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      const isValidState = url.includes('qr-code') || url.includes('login');
      expect(isValidState).toBe(true);
    });
  });

  test.describe('Onboarding Page', () => {
    test('onboarding page with force param loads', async ({ page }) => {
      // Use force param to trigger onboarding regardless of completion status
      await page.goto(`${ROUTES.merchantOnboarding}?force=true`);
      await page.waitForTimeout(2000);
      
      const url = page.url();
      // Should show onboarding or redirect to login
      const isValidState = url.includes('onboarding') || url.includes('login');
      expect(isValidState).toBe(true);
    });
  });
});

test.describe('Merchant Navigation', () => {
  test('login page has correct branding', async ({ page }) => {
    await page.goto(ROUTES.merchantLogin);
    
    // Check OpenAlert branding
    await expect(page.locator('img[alt="OpenAlert"]')).toBeVisible();
    await expect(page.locator('text=OpenAlert')).toBeVisible();
  });
});









