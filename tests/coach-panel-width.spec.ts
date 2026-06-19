import { test, expect, ROUTES } from './fixtures/base';
import type { Page, Route } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gawcuwlmvcveddqjjqxc.supabase.co';
const MERCHANT_AUTH_STORAGE_KEY = 'openalert.merchant.auth';
const merchantId = 'c381c4c7-1825-4ff9-bf67-492da92450db';
const locationId = '7f3fcf0a-dc47-4ee5-a834-87f6c35ba8a1';

const OA_SETUP_CHECKLIST_PREVIEW_KEY = 'oa_setup_checklist_preview';

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

const sendJson = async (route: Route, payload: unknown, status = 200) => {
  await route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

async function setupCoachPanelTest(page: Page) {
  await page.addInitScript(({ session, previewKey, authStorageKey }) => {
    localStorage.setItem(authStorageKey, JSON.stringify(session));
    sessionStorage.setItem(previewKey, 'true');
    localStorage.removeItem('oa_checklist_collapsed');
    localStorage.removeItem('oa_setup_checklist_dismissed');
  }, {
    session: buildSession(),
    previewKey: OA_SETUP_CHECKLIST_PREVIEW_KEY,
    authStorageKey: MERCHANT_AUTH_STORAGE_KEY,
  });

  await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
    await sendJson(route, buildUser());
  });

  const profile = {
    id: merchantId,
    phone: '+15165879844',
    business_name: 'Coach Panel Width Test',
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
    onboarding_completed_at: new Date().toISOString(),
    tutorial_dismissed_at: new Date().toISOString(),
    tutorial_tour_seen_at: new Date().toISOString(),
    setup_booking_method_confirmed_at: null,
    setup_cancellation_confirmed_at: null,
    setup_confirmation_confirmed_at: null,
    setup_qr_engaged_at: null,
  };

  await page.route(`${supabaseUrl}/rest/v1/profiles*`, async (route) => {
    await sendJson(route, profile);
  });

  await page.route(`${supabaseUrl}/rest/v1/locations*`, async (route) => {
    await sendJson(route, [{ id: locationId, name: 'Main Location', time_zone: 'America/New_York' }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/staff*`, async (route) => {
    await sendJson(route, [{
      id: 'staff-1',
      merchant_id: merchantId,
      location_id: locationId,
      name: 'Primary Staff',
      active: true,
      is_primary: true,
    }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/subscriptions*`, async (route) => {
    await sendJson(route, {
      id: 'sub-coach-width',
      merchant_id: merchantId,
      status: 'trialing',
      trial_end: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      plans: { id: 'starter', name: 'Starter', staff_included: 1 },
    });
  });

  await page.route(`${supabaseUrl}/rest/v1/rpc/check_trial_status*`, async (route) => {
    await sendJson(route, [{ should_end: false, reason: null, openings_filled: 0, days_remaining: 10 }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/rpc/get_current_sms_usage*`, async (route) => {
    await sendJson(route, 0);
  });

  await page.route(`${supabaseUrl}/rest/v1/duration_presets*`, async (route) => {
    await sendJson(route, [{ id: 'dp-1', duration_minutes: 30 }]);
  });

  await page.route(`${supabaseUrl}/rest/v1/qr_codes*`, async (route) => {
    await sendJson(route, [{ id: 'qr-1', short_code: 'testcode', merchant_id: merchantId, location_id: locationId }]);
  });
}

async function expectedCoachPanelWidth(page: Page): Promise<number> {
  return page.evaluate(() => Math.min(window.innerWidth - 10.25 * 16, 17 * 16));
}

async function assertCoachPanelClearsSaveButton(page: Page) {
  const panel = page.locator('.oa-floating-coach-panel').first();
  const saveButton = page.getByRole('button', { name: /^Save$/ });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(saveButton).toBeVisible({ timeout: 15_000 });

  const panelBox = await panel.boundingBox();
  const saveBox = await saveButton.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(saveBox).not.toBeNull();

  const gap = saveBox!.x - (panelBox!.x + panelBox!.width);
  expect(gap).toBeGreaterThanOrEqual(12);
}

async function assertCoachPanelWidth(page: Page) {
  const panel = page.locator('.oa-floating-coach-panel').first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  const expected = await expectedCoachPanelWidth(page);
  expect(box!.width).toBeGreaterThanOrEqual(expected - 1);
  expect(box!.width).toBeLessThanOrEqual(expected + 1);
}

test.describe('coach panel width', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('setup checklist matches shared panel width on QR Code', async ({ page }) => {
    await setupCoachPanelTest(page);
    await page.goto(ROUTES.merchantQRCode, { waitUntil: 'networkidle' });
    await assertCoachPanelWidth(page);
  });

  test('setup checklist matches shared panel width on Settings', async ({ page }) => {
    await setupCoachPanelTest(page);
    await page.goto(ROUTES.merchantSettings, { waitUntil: 'networkidle' });
    await assertCoachPanelWidth(page);
  });

  test('setup checklist matches shared panel width on Openings', async ({ page }) => {
    await setupCoachPanelTest(page);
    await page.route(`${supabaseUrl}/rest/v1/slots*`, async (route) => {
      await sendJson(route, []);
    });
    await page.goto(ROUTES.merchantOpenings, { waitUntil: 'networkidle' });
    await assertCoachPanelWidth(page);
  });

  test('setup checklist does not overlap Save button on Business Settings', async ({ page }) => {
    await setupCoachPanelTest(page);
    await page.goto('/merchant/settings/business', { waitUntil: 'networkidle' });
    await assertCoachPanelWidth(page);
    await assertCoachPanelClearsSaveButton(page);
  });
});
