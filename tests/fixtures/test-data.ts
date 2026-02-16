/**
 * Test data constants for E2E tests
 * Based on existing Supabase data
 */

// Test merchant ID from existing profiles table
export const TEST_MERCHANT_ID = '64c4378e-34dd-4abf-b90e-c0ab7f861f6d';
export const TEST_MERCHANT_PHONE = '+15165879844';
export const TEST_MERCHANT_NAME = 'Merchant SMS Test';

// Sample open slot for testing
export const TEST_OPEN_SLOT_ID = '23f5fcff-58a2-44af-9a9e-6846f3cb194a';

// Routes
export const ROUTES = {
  // Public routes
  landing: '/',
  notifyMe: (merchantId: string) => `/notify/${merchantId}`,
  qrRedirect: (shortCode: string) => `/r/${shortCode}`,
  claimBooking: (slotId: string) => `/claim/${slotId}`,
  bookingConfirmed: (slotId: string) => `/booking-confirmed/${slotId}`,
  myNotifications: '/my-notifications',
  tools: '/tools',
  notFound: '/404-test-route',
  
  // Consumer routes
  consumerSignIn: '/consumer/sign-in',
  consumerSettings: '/consumer/settings',
  
  // Merchant routes
  merchantLogin: '/merchant/login',
  merchantOnboarding: '/merchant/onboarding',
  merchantOpenings: '/merchant/openings',
  merchantAnalytics: '/merchant/analytics',
  merchantSettings: '/merchant/settings',
  merchantQRCode: '/merchant/qr-code',
  merchantNotifyList: '/merchant/waitlist',
} as const;

// Test selectors (data-testid attributes we expect or common selectors)
export const SELECTORS = {
  // Auth
  phoneInput: 'input[type="tel"], input[placeholder*="555"]',
  otpInput: 'input[maxlength="6"]',
  continueButton: 'button:has-text("Continue")',
  
  // Navigation
  adminToggle: '[aria-label="Open admin panel"]',
  adminPanel: 'text=Admin Panel',
  
  // Forms
  businessNameInput: '#business-name',
  saveButton: 'button:has-text("Save")',
  
  // Calendar/Openings
  addOpeningButton: 'button:has-text("Add Opening")',
  openingModal: '[role="dialog"]',
} as const;

// Timeouts
export const TIMEOUTS = {
  navigation: 10000,
  animation: 500,
  toast: 5000,
} as const;
