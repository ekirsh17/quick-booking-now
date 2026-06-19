import { describe, expect, it } from 'vitest';
import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';
import {
  AUTO_OPENINGS_SETUP_TITLE,
  getAllEmailSyncPlatformGuides,
  getAutoOpeningsSetupSubtitle,
  getDefaultEmailSyncTab,
  getEmailSyncGuide,
  getForwardingGuide,
  getPlatformLabel,
  HELP_GUIDES_AUTO_OPENINGS_LABEL,
  isBookingSystemSlug,
} from './emailSyncSetupGuides';

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

  it('provides forwarding guides for gmail, outlook, and other', () => {
    for (const client of ['gmail', 'outlook', 'other'] as const) {
      const guide = getForwardingGuide(client);
      expect(guide.client).toBe(client);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('other platform guide encourages forwarding fallback', () => {
    const guide = getEmailSyncGuide('other');
    expect(guide.recipientSteps.some((step) => step.toLowerCase().includes('forward email'))).toBe(
      true
    );
  });

  it('exposes rebranded setup copy constants', () => {
    expect(AUTO_OPENINGS_SETUP_TITLE).toBe('Automatically create openings');
    expect(getAutoOpeningsSetupSubtitle('Vagaro')).toContain('Vagaro');
    expect(HELP_GUIDES_AUTO_OPENINGS_LABEL).toBe('Automatic openings setup');
  });
});
