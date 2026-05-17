import { test, expect, ROUTES } from './fixtures/base';
import type { Page, Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gawcuwlmvcveddqjjqxc.supabase.co';
const merchantId = 'c381c4c7-1825-4ff9-bf67-492da92450db';
const locationId = '7f3fcf0a-dc47-4ee5-a834-87f6c35ba8a1';
const staffId = 'b75f7ec6-1bd9-4ac6-a5b4-a7f8d3d9c321';

type MockOpening = {
  id: string;
  merchant_id: string;
  location_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_name: string | null;
  notes: string | null;
  status: 'open' | 'booked' | 'pending_confirmation';
  booked_by_name: string | null;
  consumer_phone: string | null;
};

const buildUser = () => ({
  id: merchantId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'merchant@example.com',
  phone: '+15165879844',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const buildSession = () => ({
  access_token: 'e2e-fake-access-token',
  refresh_token: 'e2e-fake-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: buildUser(),
});

const buildOpening = (id: string, title: string): MockOpening => {
  const start = new Date();
  start.setHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    id,
    merchant_id: merchantId,
    location_id: locationId,
    staff_id: staffId,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    duration_minutes: 30,
    appointment_name: title,
    notes: null,
    status: 'open',
    booked_by_name: null,
    consumer_phone: null,
  };
};

const sendJson = async (route: Route, payload: unknown, status = 200, headers: Record<string, string> = {}) => {
  await route.fulfill({
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
};

const setupMerchantAuth = async (page: Page) => {
  await page.addInitScript(({ url, session }) => {
    const projectRef = new URL(url).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { url: supabaseUrl, session: buildSession() });

  await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
    await sendJson(route, buildUser());
  });
};

const setupOpeningsMocks = async (
  page: Page,
  initialOpenings: MockOpening[],
  options?: { failDelete?: boolean },
) => {
  let openings = [...initialOpenings];

  await page.route(`${supabaseUrl}/rest/v1/profiles*`, async (route) => {
    const profile = {
      id: merchantId,
      phone: '+15165879844',
      business_name: 'Delete Flow Test Merchant',
      default_location_id: locationId,
      working_hours: {
        monday: { enabled: true, start: '06:00', end: '20:00' },
        tuesday: { enabled: true, start: '06:00', end: '20:00' },
        wednesday: { enabled: true, start: '06:00', end: '20:00' },
        thursday: { enabled: true, start: '06:00', end: '20:00' },
        friday: { enabled: true, start: '06:00', end: '20:00' },
        saturday: { enabled: true, start: '06:00', end: '20:00' },
        sunday: { enabled: true, start: '06:00', end: '20:00' },
      },
      saved_appointment_names: [],
      saved_durations: [30],
      default_opening_duration: 30,
      email: 'merchant@example.com',
      address: '123 Main St',
    };
    await sendJson(route, profile);
  });

  await page.route(`${supabaseUrl}/rest/v1/locations*`, async (route) => {
    await sendJson(route, [{ id: locationId, name: 'Main Location', time_zone: 'America/New_York' }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/staff*`, async (route) => {
    await sendJson(route, [{
      id: staffId,
      merchant_id: merchantId,
      location_id: locationId,
      name: 'Primary Staff',
      active: true,
      is_primary: true,
    }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
    await sendJson(route, {
      id: 'sub-row-delete-tests',
      merchant_id: merchantId,
      status: 'trialing',
      billing_provider: null,
      provider_customer_id: null,
      provider_subscription_id: null,
      trial_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false,
      current_period_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      current_period_end: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      seats_count: 1,
      plans: {
        id: 'starter',
        name: 'Starter',
        staff_included: 1,
        staff_addon_price: 1000,
        max_staff: 10,
        is_unlimited_staff: false,
        sms_included: 300,
        is_unlimited_sms: false,
        sms_overage_price_per_100: 200,
      },
    });
  });

  await page.route(`${supabaseUrl}/rest/v1/rpc/check_trial_status*`, async (route) => {
    await sendJson(route, [{
      should_end: false,
      reason: null,
      openings_filled: 0,
      days_remaining: 10,
    }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/rpc/get_current_sms_usage*`, async (route) => {
    await sendJson(route, 0);
  });

  await page.route(`${supabaseUrl}/rest/v1/consumers*`, async (route) => {
    await sendJson(route, null);
  });

  await page.route(`${supabaseUrl}/rest/v1/notifications*`, async (route) => {
    const method = route.request().method();
    if (method === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: { 'content-range': '0-0/0' },
      });
      return;
    }
    await sendJson(route, []);
  });

  await page.route(`${supabaseUrl}/rest/v1/sms_logs*`, async (route) => {
    await sendJson(route, []);
  });

  await page.route(`${supabaseUrl}/rest/v1/slots*`, async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'DELETE') {
      if (options?.failDelete) {
        await sendJson(
          route,
          { message: 'Simulated delete failure. Please try again.' },
          500,
        );
        return;
      }

      const idFilter = new URL(request.url()).searchParams.get('id');
      const id = idFilter?.startsWith('eq.') ? idFilter.slice(3) : null;
      if (id) {
        openings = openings.filter((opening) => opening.id !== id);
      }
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await sendJson(route, openings);
  });
};

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

  test.describe('Waitlist Page', () => {
    test('waitlist page loads or redirects to login', async ({ page }) => {
      await page.goto(ROUTES.merchantNotifyList);
      await page.waitForTimeout(2000);

      const url = page.url();
      const isValidState = url.includes('waitlist') || url.includes('login');
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

test.describe('Openings delete refresh regression', () => {
  test('delete success removes opening immediately and closes modal', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'Targeted desktop regression coverage for delete flow');
    const openingTitle = 'Delete Success Opening';

    await setupMerchantAuth(page);
    await setupOpeningsMocks(page, [buildOpening('slot-delete-success', openingTitle)]);

    await page.goto(ROUTES.merchantOpenings);

    await expect(page.getByText(openingTitle)).toBeVisible();
    await page.getByText(openingTitle).click();
    await expect(page.getByText('Edit Opening')).toBeVisible();

    await page.locator('button:has(svg.lucide-trash2)').first().click();
    await expect(page.getByText('Delete this opening?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete opening' }).click();

    await expect(page.getByText('Delete this opening?')).toHaveCount(0);
    await expect(page.getByText(openingTitle)).toHaveCount(0);
    await expect(page.getByText(/No openings/i)).toBeVisible();
  });

  test('delete failure keeps opening visible and shows error feedback', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'Targeted desktop regression coverage for delete flow');
    const openingTitle = 'Delete Failure Opening';

    await setupMerchantAuth(page);
    await setupOpeningsMocks(page, [buildOpening('slot-delete-failure', openingTitle)], {
      failDelete: true,
    });

    await page.goto(ROUTES.merchantOpenings);

    await expect(page.getByText(openingTitle)).toBeVisible();
    await page.getByText(openingTitle).click();
    await expect(page.getByText('Edit Opening')).toBeVisible();

    await page.locator('button:has(svg.lucide-trash2)').first().click();
    await expect(page.getByText('Delete this opening?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete opening' }).click();

    await expect(page.getByText('Delete failed', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keep opening' }).click();
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByText(openingTitle)).toBeVisible();
  });
});







