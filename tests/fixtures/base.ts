import { test as base, expect } from '@playwright/test';
import { ROUTES, TIMEOUTS } from './test-data';

/**
 * Extended test fixtures for OpenAlert E2E tests
 */
export const test = base.extend<{
  /**
   * Navigate to a route and wait for load
   */
  navigateTo: (route: string) => Promise<void>;
}>({
  navigateTo: async ({ page }, use) => {
    const navigateTo = async (route: string) => {
      await page.goto(route, { waitUntil: 'networkidle' });
    };
    await use(navigateTo);
  },
});

export { expect, ROUTES, TIMEOUTS };

/**
 * Helper to wait for page to be ready
 */
export async function waitForPageReady(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to check if element is visible with timeout
 */
export async function isElementVisible(
  page: import('@playwright/test').Page,
  selector: string,
  timeout = TIMEOUTS.navigation
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to dismiss any toasts that might be blocking
 */
export async function dismissToasts(page: import('@playwright/test').Page) {
  const toastCloseButtons = page.locator('[data-radix-toast-close]');
  const count = await toastCloseButtons.count();
  for (let i = 0; i < count; i++) {
    try {
      await toastCloseButtons.nth(i).click({ timeout: 1000 });
    } catch {
      // Toast may have auto-dismissed
    }
  }
}









