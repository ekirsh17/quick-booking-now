import { test, expect, type Page, type Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gawcuwlmvcveddqjjqxc.supabase.co';
const merchantId = 'c381c4c7-1825-4ff9-bf67-492da92450db';

declare global {
  interface Window {
    __overlaySeen?: boolean;
    __renewBannerSeen?: boolean;
  }
}

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

const setupAuth = async (page: Page) => {
  await page.addInitScript(({ url, session }) => {
    const projectRef = new URL(url).hostname.split('.')[0];
    const storageKey = `sb-${projectRef}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
  }, { url: supabaseUrl, session: buildSession() });

  await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
    await sendJson(route, buildUser());
  });
};

const setupBaseMocks = async (page: Page) => {
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
};

const attachOverlayObserver = async (page: Page) => {
  await page.addInitScript(() => {
    window.__overlaySeen = false;
    const check = () => {
      const text = document.body?.innerText || '';
      if (
        text.includes('Subscription required to manage openings.') ||
        text.includes('Subscribe to access your QR code and booking link.')
      ) {
        window.__overlaySeen = true;
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(document, { childList: true, subtree: true, characterData: true });
    setInterval(check, 50);
    check();
  });
};

const expectNoOverlayFlash = async (page: Page) => {
  const overlaySeen = await page.evaluate(() => window.__overlaySeen);
  expect(overlaySeen).toBe(false);
};

test.describe('No Overlay Flash During Active Trial', () => {
  test('openings page does not flash expired overlay', async ({ page }) => {
    await attachOverlayObserver(page);
    await setupAuth(page);
    await setupBaseMocks(page);

    await page.goto('/merchant/openings');
    await expect(page.getByRole('link', { name: 'Openings' })).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoOverlayFlash(page);
  });

  test('qr page does not flash expired overlay', async ({ page }) => {
    await attachOverlayObserver(page);
    await setupAuth(page);
    await setupBaseMocks(page);

    await page.goto('/merchant/qr-code');
    await expect(page.getByRole('link', { name: 'QR Code' })).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoOverlayFlash(page);
  });
});

test.describe('No Renew Banner Flash After Portal Return', () => {
  test('suppresses canceled banner while subscription refreshes', async ({ page }) => {
    await page.addInitScript(({ url, session }) => {
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, { url: supabaseUrl, session: buildSession() });

    await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
      await sendJson(route, buildUser());
    });

    await page.route(`${supabaseUrl}/rest/v1/profiles*`, async (route) => {
      await sendJson(route, { id: merchantId, phone: '+15165879844', business_name: 'Test' });
    });

    await page.route(`${supabaseUrl}/rest/v1/consumers*`, async (route) => {
      await sendJson(route, null);
    });

    let subscriptionCalls = 0;
    const portalReturnAt = Date.now();
    await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
      subscriptionCalls += 1;
      if (subscriptionCalls === 1) {
        await sendJson(route, {
          id: 'sub-row-1',
          merchant_id: merchantId,
          status: 'canceled',
          billing_provider: 'stripe',
          provider_customer_id: 'cus_test',
          provider_subscription_id: 'sub_test',
          trial_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          current_period_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_end: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
          seats_count: 1,
          updated_at: new Date(portalReturnAt - 1000).toISOString(),
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
      } else {
        await sendJson(route, {
          id: 'sub-row-1',
          merchant_id: merchantId,
          status: 'trialing',
          billing_provider: 'stripe',
          provider_customer_id: 'cus_test',
          provider_subscription_id: 'sub_test',
          trial_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          current_period_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_end: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
          seats_count: 1,
          updated_at: new Date(portalReturnAt + 2000).toISOString(),
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
      }
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

    await attachOverlayObserver(page);
    await page.addInitScript(() => {
      window.__renewBannerSeen = false;
      const check = () => {
        const text = document.body?.innerText || '';
        if (text.includes('subscription has been canceled')) {
          window.__renewBannerSeen = true;
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document, { childList: true, subtree: true, characterData: true });
      setInterval(check, 50);
      check();
    });

    await page.goto('/merchant/openings?billing=portal_return');
    await page.waitForTimeout(250);
    const renewSeenEarly = await page.evaluate(() => window.__renewBannerSeen);
    expect(renewSeenEarly).toBe(false);
    await page.waitForTimeout(750);
    const renewSeen = await page.evaluate(() => window.__renewBannerSeen);
    expect(renewSeen).toBe(false);
  });
});
