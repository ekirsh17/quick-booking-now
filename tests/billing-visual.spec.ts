import { test, expect, type Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gawcuwlmvcveddqjjqxc.supabase.co';
const merchantId = 'c381c4c7-1825-4ff9-bf67-492da92450db';

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

test.describe('Billing Visual States', () => {
  test('shows canceled banner when subscription is canceled', async ({ page }) => {
    await page.addInitScript(({ url, session }) => {
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { url: supabaseUrl, session: buildSession() });

    await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
      await sendJson(route, buildUser());
    });

    await page.route(`${supabaseUrl}/rest/v1/profiles*`, async (route) => {
      const url = new URL(route.request().url());
      const select = url.searchParams.get('select') || '';
      const payload = select.includes('avg_appointment_value')
        ? { avg_appointment_value: 70 }
        : { id: merchantId, phone: '+15165879844', business_name: 'Test' };
      await sendJson(route, payload);
    });

    await page.route(`${supabaseUrl}/rest/v1/consumers*`, async (route) => {
      await sendJson(route, null);
    });

    await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
      await sendJson(route, {
        id: 'sub-row-1',
        merchant_id: merchantId,
        status: 'canceled',
        billing_provider: 'stripe',
        provider_customer_id: 'cus_test',
        provider_subscription_id: 'sub_test',
        trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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
        days_remaining: 14,
      }]);
    });

    await page.route(`${supabaseUrl}/rest/v1/rpc/get_current_sms_usage*`, async (route) => {
      await sendJson(route, 0);
    });

    await page.route(`${supabaseUrl}/rest/v1/staff*`, async (route) => {
      const method = route.request().method();
      if (method === 'HEAD') {
        await route.fulfill({
          status: 200,
          headers: {
            'content-range': '0-0/1',
          },
        });
        return;
      }
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/slots*`, async (route) => {
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/notifications*`, async (route) => {
      const method = route.request().method();
      if (method === 'HEAD') {
        await route.fulfill({
          status: 200,
          headers: {
            'content-range': '0-0/0',
          },
        });
        return;
      }
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/sms_logs*`, async (route) => {
      await sendJson(route, []);
    });

    await page.goto('/merchant/billing');

    await expect(page.getByText('Canceled', { exact: false })).toBeVisible();
    await expect(page.getByText(/subscription has been canceled/i)).toBeVisible();
    await expect(page).toHaveScreenshot('billing-canceled-banner.png', {
      fullPage: true,
    });
  });

  test('shows trial ending banner when canceled within trial window', async ({ page }) => {
    await page.addInitScript(({ url, session }) => {
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { url: supabaseUrl, session: buildSession() });

    await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
      await sendJson(route, buildUser());
    });

    await page.route(`${supabaseUrl}/rest/v1/profiles*`, async (route) => {
      const url = new URL(route.request().url());
      const select = url.searchParams.get('select') || '';
      const payload = select.includes('avg_appointment_value')
        ? { avg_appointment_value: 70 }
        : { id: merchantId, phone: '+15165879844', business_name: 'Test' };
      await sendJson(route, payload);
    });

    await page.route(`${supabaseUrl}/rest/v1/consumers*`, async (route) => {
      await sendJson(route, null);
    });

    const trialEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
      await sendJson(route, {
        id: 'sub-row-2',
        merchant_id: merchantId,
        status: 'canceled',
        billing_provider: 'stripe',
        provider_customer_id: 'cus_test',
        provider_subscription_id: 'sub_test',
        trial_end: trialEnd,
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

    await page.route(`${supabaseUrl}/rest/v1/staff*`, async (route) => {
      const method = route.request().method();
      if (method === 'HEAD') {
        await route.fulfill({
          status: 200,
          headers: {
            'content-range': '0-0/1',
          },
        });
        return;
      }
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/slots*`, async (route) => {
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/notifications*`, async (route) => {
      const method = route.request().method();
      if (method === 'HEAD') {
        await route.fulfill({
          status: 200,
          headers: {
            'content-range': '0-0/0',
          },
        });
        return;
      }
      await sendJson(route, []);
    });

    await page.route(`${supabaseUrl}/rest/v1/sms_logs*`, async (route) => {
      await sendJson(route, []);
    });

    await page.goto('/merchant/billing');

    await expect(page.getByText(/trial ending/i)).toBeVisible();
    await expect(page.getByText(/please subscribe to ensure your service is uninterrupted/i)).toBeVisible();
    await expect(page).toHaveScreenshot('billing-trial-ending-banner.png', {
      fullPage: true,
    });
  });
});
