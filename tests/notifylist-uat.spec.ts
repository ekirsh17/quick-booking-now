import { test, expect, type Page, type Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gawcuwlmvcveddqjjqxc.supabase.co';
const merchantId = 'c381c4c7-1825-4ff9-bf67-492da92450db';
const locationOneId = '11111111-1111-1111-1111-111111111111';
const locationTwoId = '22222222-2222-2222-2222-222222222222';
const locationTimeZone = 'America/New_York';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

interface MockSetupOptions {
  subscriptionStatus?: SubscriptionStatus;
  trialEndIso?: string;
  trialShouldEnd?: boolean;
  locations?: Array<{ id: string; name: string; time_zone: string }>;
  defaultLocationId?: string;
  notifyRowsByLocation?: Record<string, unknown[]>;
  notifyRequestsCallCounter?: { value: number };
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

const sendJson = async (
  route: Route,
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
) => {
  await route.fulfill({
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
};

const parseEqParam = (param: string | null): string | null => {
  if (!param || !param.startsWith('eq.')) return null;
  return decodeURIComponent(param.slice(3));
};

const dateKeyForTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
};

const buildNotifyRow = ({
  id,
  consumerId,
  consumerName,
  consumerPhone,
  staffId,
  timeRange,
  createdAt,
  locationId,
}: {
  id: string;
  consumerId: string;
  consumerName: string;
  consumerPhone: string;
  staffId: string | null;
  timeRange: string;
  createdAt: string;
  locationId: string;
}) => ({
  id,
  consumer_id: consumerId,
  staff_id: staffId,
  time_range: timeRange,
  created_at: createdAt,
  location_id: locationId,
  consumer: {
    id: consumerId,
    name: consumerName,
    phone: consumerPhone,
  },
});

const setupAuthenticatedMerchantMocks = async (page: Page, options: MockSetupOptions = {}) => {
  const now = Date.now();
  const defaultTrialEndIso = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
  const subscriptionStatus = options.subscriptionStatus || 'trialing';
  const trialEndIso = options.trialEndIso || defaultTrialEndIso;
  const trialShouldEnd = options.trialShouldEnd ?? false;
  const defaultLocationId = options.defaultLocationId || locationOneId;
  const locations = options.locations || [
    { id: locationOneId, name: 'Downtown', time_zone: locationTimeZone },
    { id: locationTwoId, name: 'Uptown', time_zone: locationTimeZone },
  ];

  const notifyRowsByLocation = options.notifyRowsByLocation || {};
  const notifyRequestsCallCounter = options.notifyRequestsCallCounter;

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

    if (select.includes('default_location_id')) {
      await sendJson(route, { default_location_id: defaultLocationId });
      return;
    }

    await sendJson(route, {
      id: merchantId,
      business_name: 'Test Business',
      email: 'merchant@example.com',
      phone: '+15165879844',
      address: '123 Main St',
      saved_appointment_names: [],
      saved_durations: [],
      default_opening_duration: 30,
    });
  });

  await page.route(`${supabaseUrl}/rest/v1/locations*`, async (route) => {
    await sendJson(route, locations);
  });

  await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
    await sendJson(route, {
      id: 'sub-row-1',
      merchant_id: merchantId,
      status: subscriptionStatus,
      billing_provider: subscriptionStatus === 'active' ? 'stripe' : null,
      provider_customer_id: subscriptionStatus === 'active' ? 'cus_test' : null,
      provider_subscription_id: subscriptionStatus === 'active' ? 'sub_test' : null,
      trial_end: trialEndIso,
      cancel_at_period_end: false,
      canceled_at: subscriptionStatus === 'canceled' ? new Date().toISOString() : null,
      current_period_start: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      current_period_end: new Date(now + 27 * 24 * 60 * 60 * 1000).toISOString(),
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
      should_end: trialShouldEnd,
      reason: trialShouldEnd ? 'time_expired' : null,
      openings_filled: 0,
      days_remaining: trialShouldEnd ? 0 : 10,
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

    const url = new URL(route.request().url());
    const locationId = parseEqParam(url.searchParams.get('location_id'));
    if (locationId === locationOneId) {
      await sendJson(route, [
        { id: 'staff-1', name: 'Sam', active: true },
        { id: 'staff-2', name: 'Alex', active: false },
      ]);
      return;
    }
    if (locationId === locationTwoId) {
      await sendJson(route, [{ id: 'staff-3', name: 'Riley', active: true }]);
      return;
    }

    await sendJson(route, []);
  });

  await page.route(`${supabaseUrl}/rest/v1/notify_requests*`, async (route) => {
    if (notifyRequestsCallCounter) {
      notifyRequestsCallCounter.value += 1;
    }

    const url = new URL(route.request().url());
    const locationId = parseEqParam(url.searchParams.get('location_id'));
    if (!locationId) {
      await sendJson(route, []);
      return;
    }
    await sendJson(route, notifyRowsByLocation[locationId] || []);
  });

  await page.route(`${supabaseUrl}/rest/v1/consumers*`, async (route) => {
    await sendJson(route, null);
  });
};

test.describe('Waitlist Authenticated UAT', () => {
  test('validates location scoping and active-only request behavior', async ({ page }) => {
    const now = new Date();
    const yesterdayDateKey = dateKeyForTimeZone(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
      locationTimeZone,
    );

    const notifyRowsByLocation: Record<string, unknown[]> = {
      [locationOneId]: [
        buildNotifyRow({
          id: 'notify-1',
          consumerId: 'consumer-1',
          consumerName: 'Alice Active',
          consumerPhone: '+15165550001',
          staffId: 'staff-1',
          timeRange: '3-days',
          createdAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
          locationId: locationOneId,
        }),
        buildNotifyRow({
          id: 'notify-2',
          consumerId: 'consumer-2',
          consumerName: 'Bob Expired Date',
          consumerPhone: '+15165550002',
          staffId: null,
          timeRange: yesterdayDateKey,
          createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          locationId: locationOneId,
        }),
        buildNotifyRow({
          id: 'notify-3',
          consumerId: 'consumer-3',
          consumerName: 'Casey Expired Tomorrow',
          consumerPhone: '+15165550003',
          staffId: null,
          timeRange: 'tomorrow',
          createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          locationId: locationOneId,
        }),
      ],
      [locationTwoId]: [
        buildNotifyRow({
          id: 'notify-4',
          consumerId: 'consumer-4',
          consumerName: 'Dana Uptown',
          consumerPhone: '+15165550004',
          staffId: null,
          timeRange: 'today',
          createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          locationId: locationTwoId,
        }),
      ],
    };

    await setupAuthenticatedMerchantMocks(page, {
      notifyRowsByLocation,
      subscriptionStatus: 'trialing',
      trialShouldEnd: false,
    });

    const isMobile = (page.viewportSize()?.width || 1280) < 768;
    const expectConsumerVisible = async (name: string) => {
      if (isMobile) {
        await expect(page.locator('div.md\\:hidden').getByText(name)).toBeVisible();
        return;
      }
      await expect(page.getByRole('cell', { name })).toBeVisible();
    };

    await page.goto('/merchant/waitlist');

    await expect(page.getByRole('heading', { name: 'Waitlist', exact: true })).toBeVisible();
    await expect(page.getByText(/People currently waiting for openings in Downtown/i)).toBeVisible();

    await expectConsumerVisible('Alice Active');
    await expect(page.getByText('Bob Expired Date')).toHaveCount(0);
    await expect(page.getByText('Casey Expired Tomorrow')).toHaveCount(0);
    await expect(page.getByText('1 person waiting')).toBeVisible();

    await expect(page.getByPlaceholder(/Search by customer name or phone/i)).toBeVisible();

    const accountTrigger = page.getByRole('button', { name: /Test Business/i }).first();
    await accountTrigger.click();
    await page.getByRole('menuitem', { name: 'Uptown' }).click();

    await expect(page.getByText(/People currently waiting for openings in Uptown/i)).toBeVisible();
    await expectConsumerVisible('Dana Uptown');
    await expect(page.getByText('Alice Active')).toHaveCount(0);

    if (isMobile) {
      await expect(page.getByRole('button', { name: /Copy phone number/i }).first()).toBeVisible();
    } else {
      await expect(page.getByRole('columnheader', { name: 'Customer' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Copy phone number/i }).first()).toBeVisible();
    }
  });

  test('validates polling fallback and refresh behavior under changing data', async ({ page }) => {
    const now = new Date();
    const isMobile = (page.viewportSize()?.width || 1280) < 768;
    const expectConsumerVisible = async (name: string) => {
      if (isMobile) {
        await expect(page.locator('div.md\\:hidden').getByText(name)).toBeVisible();
        return;
      }
      await expect(page.getByRole('cell', { name })).toBeVisible();
    };

    const notifyRowsByLocation: Record<string, unknown[]> = {
      [locationOneId]: [
        buildNotifyRow({
          id: 'notify-poll-1',
          consumerId: 'consumer-poll-1',
          consumerName: 'Initial Consumer',
          consumerPhone: '+15165550011',
          staffId: null,
          timeRange: '3-days',
          createdAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          locationId: locationOneId,
        }),
      ],
      [locationTwoId]: [],
    };

    await setupAuthenticatedMerchantMocks(page, {
      notifyRowsByLocation,
      subscriptionStatus: 'trialing',
      trialShouldEnd: false,
    });

    await page.goto('/merchant/waitlist');

    await expectConsumerVisible('Initial Consumer');
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

    notifyRowsByLocation[locationOneId] = [
      ...notifyRowsByLocation[locationOneId],
      buildNotifyRow({
        id: 'notify-poll-2',
        consumerId: 'consumer-poll-2',
        consumerName: 'Refreshed Consumer',
        consumerPhone: '+15165550012',
        staffId: null,
        timeRange: '3-days',
        createdAt: new Date().toISOString(),
        locationId: locationOneId,
      }),
    ];

    await page.getByRole('button', { name: 'Refresh' }).click();
    await expectConsumerVisible('Refreshed Consumer');
    await expect(page.getByText('2 people waiting')).toBeVisible();
  });

  test('validates canceled subscription guardrail state', async ({ page }) => {
    const notifyRequestsCalls = { value: 0 };
    await setupAuthenticatedMerchantMocks(page, {
      subscriptionStatus: 'canceled',
      trialEndIso: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      trialShouldEnd: true,
      notifyRowsByLocation: {
        [locationOneId]: [],
        [locationTwoId]: [],
      },
      notifyRequestsCallCounter: notifyRequestsCalls,
    });

    await page.goto('/merchant/waitlist');

    await expect(page.getByText(/Your subscription has ended/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reactivate Subscription' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    await page.waitForTimeout(400);
    expect(notifyRequestsCalls.value).toBeLessThanOrEqual(1);
  });

  test('validates read-only trial-expired guardrail state', async ({ page }) => {
    const notifyRequestsCalls = { value: 0 };
    await setupAuthenticatedMerchantMocks(page, {
      subscriptionStatus: 'past_due',
      trialEndIso: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      trialShouldEnd: true,
      notifyRowsByLocation: {
        [locationOneId]: [],
        [locationTwoId]: [],
      },
      notifyRequestsCallCounter: notifyRequestsCalls,
    });

    await page.goto('/merchant/waitlist');

    await expect(page.getByText(/Subscription required to access waitlist/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    await page.waitForTimeout(400);
    expect(notifyRequestsCalls.value).toBeLessThanOrEqual(1);
  });
});
