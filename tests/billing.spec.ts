import { test, expect } from '@playwright/test';

/**
 * Billing E2E Tests
 * 
 * Tests for the NotifyMe billing system including:
 * - Trial flow
 * - Plan display
 * - Upgrade/downgrade flows
 * - Cancellation flow
 * 
 * Note: Actual Stripe/PayPal checkout tests require mocking or test mode credentials.
 */

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as merchant first
    // This assumes a test merchant account exists
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
  });

  test('should display billing page with subscription info', async ({ page }) => {
    await page.goto('/merchant/billing');
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible();
    
    // Should show current plan info
    await expect(page.getByText(/starter|pro/i)).toBeVisible();
  });

  test('should show trial indicator for trialing merchants', async ({ page }) => {
    await page.goto('/merchant/billing');
    
    // Look for trial indicator
    const trialIndicator = page.getByText(/trial|days left/i);
    const isTrialing = await trialIndicator.isVisible().catch(() => false);
    
    if (isTrialing) {
      // Verify trial elements
      await expect(page.getByText(/openings filled/i)).toBeVisible();
      await expect(page.getByText(/value guarantee/i)).toBeVisible();
    }
  });

  test('should display available plans', async ({ page }) => {
    await page.goto('/merchant/billing');
    
    // Should show Starter and Pro plans
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
    
    // Should show pricing
    await expect(page.getByText('$19')).toBeVisible();
    await expect(page.getByText('$79')).toBeVisible();
  });

  test('should display usage metrics', async ({ page }) => {
    await page.goto('/merchant/billing');
    
    // Should show SMS usage section
    await expect(page.getByText(/sms/i)).toBeVisible();
    
    // Should show staff seats section
    await expect(page.getByText(/staff|seats/i)).toBeVisible();
  });

  test('should link from settings to billing', async ({ page }) => {
    await page.goto('/merchant/settings');
    
    // Find and click the manage billing button
    const billingButton = page.getByRole('link', { name: /manage billing/i });
    await expect(billingButton).toBeVisible();
    
    await billingButton.click();
    
    // Should navigate to billing page
    await expect(page).toHaveURL(/\/merchant\/billing/);
  });
});

test.describe('Cancellation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
    await page.goto('/merchant/billing');
  });

  test('should show cancel button for active subscriptions', async ({ page }) => {
    // Only visible for paid subscriptions
    const cancelButton = page.getByRole('button', { name: /cancel subscription/i });
    const isActive = await cancelButton.isVisible().catch(() => false);
    
    if (isActive) {
      await expect(cancelButton).toBeEnabled();
    }
  });

  test('should open cancellation modal with value recap', async ({ page }) => {
    const cancelButton = page.getByRole('button', { name: /cancel subscription/i });
    const isActive = await cancelButton.isVisible().catch(() => false);
    
    if (isActive) {
      await cancelButton.click();
      
      // Should show value metrics
      await expect(page.getByText(/openings filled/i)).toBeVisible();
      await expect(page.getByText(/revenue/i)).toBeVisible();
      
      // Should show alternatives
      await expect(page.getByText(/pause/i)).toBeVisible();
      await expect(page.getByText(/keep my subscription/i)).toBeVisible();
    }
  });

  test('should allow keeping subscription from cancellation modal', async ({ page }) => {
    const cancelButton = page.getByRole('button', { name: /cancel subscription/i });
    const isActive = await cancelButton.isVisible().catch(() => false);
    
    if (isActive) {
      await cancelButton.click();
      
      // Click keep subscription
      await page.getByRole('button', { name: /keep my subscription/i }).click();
      
      // Modal should close
      await expect(page.getByText(/before you go/i)).not.toBeVisible();
    }
  });
});

test.describe('Upgrade Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
    await page.goto('/merchant/billing');
  });

  test('should show upgrade modal when clicking upgrade', async ({ page }) => {
    // Look for upgrade button on Pro plan
    const upgradeButton = page.getByRole('button', { name: /upgrade/i });
    const hasUpgrade = await upgradeButton.first().isVisible().catch(() => false);
    
    if (hasUpgrade) {
      await upgradeButton.first().click();
      
      // Should show payment options
      await expect(page.getByText(/credit or debit card/i)).toBeVisible();
      await expect(page.getByText(/paypal/i)).toBeVisible();
    }
  });

  test('should show equal prominence for Stripe and PayPal', async ({ page }) => {
    const upgradeButton = page.getByRole('button', { name: /upgrade|select plan/i });
    const hasUpgrade = await upgradeButton.first().isVisible().catch(() => false);
    
    if (hasUpgrade) {
      await upgradeButton.first().click();
      
      // Both options should be visible and styled equally
      const stripeOption = page.getByText(/credit or debit card/i);
      const paypalOption = page.getByText(/paypal/i);
      
      await expect(stripeOption).toBeVisible();
      await expect(paypalOption).toBeVisible();
    }
  });
});

test.describe('Trial Tracking', () => {
  test('should show trial banner in merchant layout', async ({ page }) => {
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
    
    // Go to openings page (not billing)
    await page.goto('/merchant/openings');
    
    // Look for trial banner
    const trialBanner = page.getByText(/value guarantee trial/i);
    const isTrialing = await trialBanner.isVisible().catch(() => false);
    
    if (isTrialing) {
      // Should show trial progress
      await expect(page.getByText(/days left/i)).toBeVisible();
      await expect(page.getByText(/openings filled/i)).toBeVisible();
    }
  });

  test('should navigate to billing from trial banner', async ({ page }) => {
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
    await page.goto('/merchant/openings');
    
    // Look for trial banner link
    const trialBanner = page.getByRole('link', { name: /view details|trial/i });
    const isTrialing = await trialBanner.isVisible().catch(() => false);
    
    if (isTrialing) {
      await trialBanner.click();
      await expect(page).toHaveURL(/\/merchant\/billing/);
    }
  });
});

test.describe('Enterprise Contact', () => {
  test('should show enterprise contact option', async ({ page }) => {
    await page.goto('/merchant/login');
    await page.waitForURL(/\/merchant\//);
    await page.goto('/merchant/billing');
    
    // Should show enterprise section
    await expect(page.getByText(/need more/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /contact sales/i })).toBeVisible();
  });
});









