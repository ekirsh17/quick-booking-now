import { test, expect, ROUTES } from './fixtures/base';

/**
 * Reporting page tests
 * Verifies the merchant reporting/analytics page displays correctly
 */
test.describe('Reporting Page', () => {
  test('page loads with correct header', async ({ page }) => {
    await page.goto(ROUTES.merchantAnalytics);
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    // Should either show analytics or redirect to login
    if (url.includes('login')) {
      await expect(page.locator('text=Business Portal')).toBeVisible();
    } else {
      // Check for the reporting header and value-prop subtitle
      await expect(page.locator('h1:has-text("Reporting")')).toBeVisible();
      await expect(page.locator('text=Slots you might have lost, now filled')).toBeVisible();
    }
  });

  test('KPI cards are present', async ({ page }) => {
    await page.goto(ROUTES.merchantAnalytics);
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    if (!url.includes('login')) {
      // Check for the 3 hero KPI cards
      await expect(page.locator('text=Slots Filled')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Estimated Revenue')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Notifications Sent')).toBeVisible({ timeout: 5000 });
    }
  });

  test('weekly chart section exists', async ({ page }) => {
    await page.goto(ROUTES.merchantAnalytics);
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    if (!url.includes('login')) {
      // Check for the weekly activity chart section
      await expect(page.locator('h2:has-text("Weekly Activity")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Openings created vs. slots filled')).toBeVisible({ timeout: 5000 });
    }
  });

  test('does not display fake metrics', async ({ page }) => {
    await page.goto(ROUTES.merchantAnalytics);
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    if (!url.includes('login')) {
      // Verify removed fake metrics are not present
      await expect(page.locator('text=Customer Satisfaction')).not.toBeVisible();
      await expect(page.locator('text=Avg Response Time')).not.toBeVisible();
      await expect(page.locator('text=Most Popular Times')).not.toBeVisible();
    }
  });

  test('handles loading state', async ({ page }) => {
    await page.goto(ROUTES.merchantAnalytics);
    await page.waitForTimeout(2000);
    
    // The page should show something (either loading skeleton or content)
    const url = page.url();
    
    if (!url.includes('login')) {
      // Wait for either content or verify page structure exists
      const hasHeader = await page.locator('h1:has-text("Reporting")').isVisible().catch(() => false);
      const hasContent = await page.locator('text=Slots Filled').isVisible().catch(() => false);
      
      // Either header or content should be visible after page loads
      expect(hasHeader || hasContent).toBe(true);
    }
  });
});

test.describe('Reporting Navigation', () => {
  test('can navigate to reporting from sidebar', async ({ page }) => {
    // Start at openings page (protected route)
    await page.goto(ROUTES.merchantOpenings);
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    if (!url.includes('login')) {
      // Click on Reporting in the sidebar (desktop) or bottom nav (mobile)
      const reportingLink = page.locator('a[href="/merchant/analytics"]').first();
      await reportingLink.click();
      
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('analytics');
    }
  });
});

