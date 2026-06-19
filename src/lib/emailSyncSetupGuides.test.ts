import { describe, expect, it } from 'vitest';
import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';
import {
  AUTO_OPENINGS_SETUP_TITLE,
  chipStep,
  EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE,
  EMAIL_SYNC_PROVIDER_LABEL,
  EMAIL_SYNC_VERIFY_BUTTON_LABEL,
  getAllEmailSyncPlatformGuides,
  getAutoOpeningsSetupSubtitle,
  getDefaultEmailSyncTab,
  getEmailSyncGuide,
  getForwardingGuide,
  getForwardingPathIntro,
  getPlatformLabel,
  getPlatformPathIntro,
  getRecommendedEmailSyncPath,
  HELP_GUIDES_AUTO_OPENINGS_LABEL,
  isBookingSystemSlug,
  OPENALERT_ADDRESS_CHIP,
  type EmailSyncStep,
} from './emailSyncSetupGuides';

function stepToText(step: EmailSyncStep): string {
  if (typeof step === 'string') return step;
  return `${step.before}${OPENALERT_ADDRESS_CHIP}${step.after}`;
}

describe('emailSyncSetupGuides', () => {
  it('provides a guide for every booking system option', () => {
    const guides = getAllEmailSyncPlatformGuides();
    expect(guides).toHaveLength(BOOKING_SYSTEM_OPTIONS.length);
    for (const option of BOOKING_SYSTEM_OPTIONS) {
      expect(isBookingSystemSlug(option.value)).toBe(true);
      const guide = getEmailSyncGuide(option.value);
      expect(guide.platform).toBe(option.value);
      expect(guide.platformLabel).toBe(option.label);
      expect(guide.recipientSteps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns generic guide for unknown or null provider', () => {
    expect(getEmailSyncGuide(null).platform).toBe('other');
    expect(getEmailSyncGuide(undefined).platform).toBe('other');
    expect(getEmailSyncGuide('unknown-platform').platform).toBe('other');
  });

  it('getPlatformLabel falls back to generic label', () => {
    expect(getPlatformLabel('booksy')).toBe('Booksy');
    expect(getPlatformLabel(null)).toBe('your booking platform');
  });

  it('defaults limited platforms to forwarding tab', () => {
    expect(getDefaultEmailSyncTab('square')).toBe('email_forwarding');
    expect(getDefaultEmailSyncTab('glossgenius')).toBe('email_forwarding');
    expect(getDefaultEmailSyncTab('booksy')).toBe('platform_recipient');
  });

  it('getRecommendedEmailSyncPath matches getDefaultEmailSyncTab', () => {
    expect(getRecommendedEmailSyncPath('square')).toBe('email_forwarding');
    expect(getRecommendedEmailSyncPath('booksy')).toBe('platform_recipient');
    expect(getRecommendedEmailSyncPath('square')).toBe(getDefaultEmailSyncTab('square'));
  });

  it('provides forwarding guides for gmail, outlook, and other', () => {
    for (const client of ['gmail', 'outlook', 'other'] as const) {
      const guide = getForwardingGuide(client);
      expect(guide.client).toBe(client);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('other platform guide encourages forwarding fallback', () => {
    const guide = getEmailSyncGuide('other');
    expect(
      guide.recipientSteps.some((step) => stepToText(step).toLowerCase().includes('forward email'))
    ).toBe(true);
  });

  it('booksy guide uses action-led copy with inline address chip', () => {
    const guide = getEmailSyncGuide('booksy');
    expect(guide.recipientSteps[0]).toBe('On a computer, sign in to Booksy Biz');
    expect(guide.recipientSteps[2]).toEqual(
      chipStep('Add ', ' as an email that gets cancellation alerts')
    );
  });

  it('gmail forwarding guide uses chip on paste step', () => {
    const guide = getForwardingGuide('gmail');
    expect(guide.steps[2]).toEqual(chipStep('Click "Add a forwarding address" and paste ', ''));
  });

  it('exposes path intro helpers', () => {
    expect(getPlatformPathIntro('Booksy')).toContain('Booksy');
    expect(getForwardingPathIntro('Booksy')).toContain("won't let you add another email");
  });

  it('exposes rebranded setup copy constants', () => {
    expect(AUTO_OPENINGS_SETUP_TITLE).toBe('Automatically create openings');
    expect(getAutoOpeningsSetupSubtitle('Vagaro')).toContain('Vagaro');
    expect(HELP_GUIDES_AUTO_OPENINGS_LABEL).toBe('Automatic openings setup');
    expect(EMAIL_SYNC_PROVIDER_LABEL).toBe('Which email do cancellations go to?');
    expect(EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE).toBe(
      'Pick your booking platform to see the exact steps'
    );
    expect(EMAIL_SYNC_VERIFY_BUTTON_LABEL).toBe('Verify forwarding');
  });
});
