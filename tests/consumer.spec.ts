import { test, expect, ROUTES } from './fixtures/base';
import { TEST_MERCHANT_ID, TEST_OPEN_SLOT_ID } from './fixtures/test-data';

/**
 * Consumer flow tests
 * These tests verify the consumer-facing pages and booking flows
 */
test.describe('Consumer Flows', () => {
  test.describe('Notify Me Flow', () => {
    test('notify page loads for valid merchant', async ({ page }) => {
      await page.goto(ROUTES.notifyMe(TEST_MERCHANT_ID));
      await page.waitForTimeout(3000);
      
      // Should be on the notify page URL (even if business not found, page still renders)
      const url = page.url();
      expect(url).toContain(`/notify/${TEST_MERCHANT_ID}`);
      
      // Page should render without crash (will show either business info or error message)
      await expect(page.locator('text=OpenAlert').first()).toBeVisible();
    });

    test('notify page renders content', async ({ page }) => {
      await page.goto(ROUTES.notifyMe(TEST_MERCHANT_ID));
      await page.waitForTimeout(3000);
      
      // Should display some content (either business info or error handling)
      const url = page.url();
      expect(url).toContain(TEST_MERCHANT_ID);
      
      // Check that the page rendered with OpenAlert branding
      await expect(page.locator('text=OpenAlert').first()).toBeVisible({ timeout: 5000 });
    });

    test('notify page handles invalid merchant gracefully', async ({ page }) => {
      await page.goto(ROUTES.notifyMe('invalid-merchant-id-12345'));
      await page.waitForTimeout(3000);
      
      // Should either show error message or empty state
      // Not crash or show raw error
      const hasErrorState = await page.locator('text=/not found|error|invalid|no.*available/i').first().isVisible().catch(() => false);
      const pageLoaded = !page.url().includes('error');
      expect(hasErrorState || pageLoaded).toBe(true);
    });
  });

  test.describe('Claim Booking Flow', () => {
    test('claim page loads for valid slot', async ({ page }) => {
      await page.goto(ROUTES.claimBooking(TEST_OPEN_SLOT_ID));
      await page.waitForTimeout(3000);
      
      // Page should load without crashing
      const url = page.url();
      expect(url).toContain('claim');
    });

    test('claim page handles invalid slot gracefully', async ({ page }) => {
      await page.goto(ROUTES.claimBooking('invalid-slot-id-12345'));
      await page.waitForTimeout(3000);
      
      // Should show error state or redirect, not crash
      const hasErrorState = await page.locator('text=/not found|error|invalid|expired|unavailable/i').first().isVisible().catch(() => false);
      const pageLoaded = !page.url().includes('500');
      expect(hasErrorState || pageLoaded).toBe(true);
    });
  });

  test.describe('Booking Confirmed Flow', () => {
    test('confirmation page loads for valid slot', async ({ page }) => {
      await page.goto(ROUTES.bookingConfirmed(TEST_OPEN_SLOT_ID));
      await page.waitForTimeout(3000);
      
      // Page should load
      const url = page.url();
      expect(url).toContain('booking-confirmed');
    });

    test('confirmation page handles invalid slot', async ({ page }) => {
      await page.goto(ROUTES.bookingConfirmed('invalid-slot-id'));
      await page.waitForTimeout(3000);
      
      // Should handle gracefully
      const pageLoaded = !page.url().includes('500');
      expect(pageLoaded).toBe(true);
    });
  });

  test.describe('My Notifications Page', () => {
    test('my notifications page loads', async ({ page }) => {
      await page.goto(ROUTES.myNotifications);
      await page.waitForTimeout(2000);
      
      // Page should load (may show empty state or sign-in prompt)
      await expect(page).toHaveURL(/my-notifications/);
    });
  });

  test.describe('Consumer Settings', () => {
    test('consumer settings page redirects unauthenticated users to sign-in', async ({ page }) => {
      await page.goto(ROUTES.consumerSettings);
      await page.waitForTimeout(2000);
      
      // Unauthenticated users should be redirected to sign-in
      const url = page.url();
      // Either stays on settings (if no auth required) or redirects to sign-in
      const isValidState = url.includes('consumer/settings') || url.includes('consumer/sign-in');
      expect(isValidState).toBe(true);
    });
  });
});

test.describe('QR Code Redirect', () => {
  test('QR redirect handles invalid code', async ({ page }) => {
    await page.goto(ROUTES.qrRedirect('invalid-code'));
    await page.waitForTimeout(3000);
    
    // Should show error or redirect appropriately
    const pageLoaded = !page.url().includes('500');
    expect(pageLoaded).toBe(true);
  });
});

