import { test, expect, ROUTES } from './fixtures/base';

test.describe('Homepage (Landing)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ROUTES.landing, { waitUntil: 'networkidle' });
  });

  test('renders hero, nav branding, and primary headline', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'OpenAlert' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Turn Cancellations Into Revenue/i,
    );
    await expect(page.getByRole('link', { name: 'Start free' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('renders all major marketing sections', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /automatically text clients when there's an opening/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /save your time and increase their satisfaction/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /customers join in seconds/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /what are cancellations actually costing you/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: /ready to stop losing revenue from cancellations/i,
      }),
    ).toBeVisible();
  });

  test('nav Start free links to merchant login', async ({ page }) => {
    await page.getByRole('link', { name: 'Start free' }).first().click();
    await expect(page).toHaveURL(/\/merchant\/login$/);
    await expect(page.getByRole('heading', { name: /sign in or sign up/i })).toBeVisible();
  });

  test('hero See how it works scrolls to #how section', async ({ page }) => {
    await page.getByRole('button', { name: 'See how it works' }).click();
    await expect(page).toHaveURL(/#how$/);
    await expect(
      page.getByRole('heading', { name: /automatically text clients when there's an opening/i }),
    ).toBeInViewport();
  });

  test('savings calculator sliders update recovered amount live', async ({ page }) => {
    const mathSection = page.locator('#math');
    await mathSection.scrollIntoViewIfNeeded();

    const sliders = page.locator('.oa-slider');
    await expect(sliders).toHaveCount(2);

    // Default: $50 × 4 cancels → $810/mo recovered
    await expect(mathSection.getByText('$810', { exact: false })).toBeVisible();

    await sliders.nth(0).fill('100');
    await sliders.nth(1).fill('10');

    // 100 × 10 × 4.3 × 0.94 → $4,040/mo recovered
    await expect(mathSection.getByText('$4,040', { exact: false })).toBeVisible();
  });

  test('loads compressed QR waitlist image', async ({ page }) => {
    const qrImage = page.getByAltText(/join the waitlist sign on a counter/i);
    await qrImage.scrollIntoViewIfNeeded();
    await expect(qrImage).toBeVisible();

    const src = await qrImage.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/qr-card-counter.*\.webp/);

    const naturalWidth = await qrImage.evaluate(
      (img) => (img as HTMLImageElement).naturalWidth,
    );
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('final CTA links to merchant login', async ({ page }) => {
    await page.getByRole('link', { name: 'Start your free trial' }).click();
    await expect(page).toHaveURL(/\/merchant\/login$/);
  });

  test('mobile viewport keeps compact nav actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.landing, { waitUntil: 'networkidle' });

    await expect(page.getByRole('link', { name: 'OpenAlert' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start free' }).first()).toBeVisible();
  });
});

test.describe('Homepage regression: other routes still work', () => {
  test('merchant login loads after visiting homepage', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await page.goto(ROUTES.merchantLogin);
    await expect(page.getByText('Business Portal')).toBeVisible();
    await expect(page.getByRole('heading', { name: /sign in or sign up/i })).toBeVisible();
  });

  test('consumer sign-in loads after visiting homepage', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await page.goto(ROUTES.consumerSignIn);
    await expect(
      page.locator('input[type="tel"], [placeholder*="phone" i]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('tools page still loads', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await page.goto(ROUTES.tools);
    await expect(page).toHaveURL(/\/tools/);
  });

  test('unknown route still shows 404', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await page.goto(ROUTES.notFound);
    await expect(page.locator('text=/404|not found|page.*exist/i').first()).toBeVisible({
      timeout: 10000,
    });
  });
});
