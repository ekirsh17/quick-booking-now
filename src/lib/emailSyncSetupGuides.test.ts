import { describe, expect, it } from 'vitest';
import { BOOKING_SYSTEM_OPTIONS } from '@/types/bookingSystems';
import {
  AUTO_OPENINGS_SETUP_TITLE,
  AUTO_OPENINGS_SETTINGS_SUBTITLE_GENERIC,
  AUTO_OPENINGS_SETUP_SHEET_SUBTITLE_GENERIC,
  EMAIL_CLIENT_OPTIONS,
  EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE,
  EMAIL_SYNC_PROVIDER_LABEL,
  EMAIL_SYNC_VERIFY_BUTTON_LABEL,
  getAllEmailSyncPlatformGuides,
  getAutoOpeningsSettingsSubtitle,
  getAutoOpeningsSetupSheetSubtitle,
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

  it('getRecommendedEmailSyncPath matches getDefaultEmailSyncTab', () => {
    expect(getRecommendedEmailSyncPath('square')).toBe('email_forwarding');
    expect(getRecommendedEmailSyncPath('booksy')).toBe('platform_recipient');
    expect(getRecommendedEmailSyncPath('square')).toBe(getDefaultEmailSyncTab('square'));
  });

  it('provides forwarding guides for every email client option', () => {
    expect(EMAIL_CLIENT_OPTIONS).toHaveLength(6);
    for (const option of EMAIL_CLIENT_OPTIONS) {
      const guide = getForwardingGuide(option.value);
      expect(guide.client).toBe(option.value);
      expect(guide.label).toBe(option.label);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      if (option.value === 'other') {
        expect(guide.officialHelpUrl).toBeUndefined();
      } else {
        expect(guide.officialHelpUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('yahoo forwarding guide notes Mail Plus and references email below', () => {
    const guide = getForwardingGuide('yahoo');
    expect(guide.steps[1]).toContain('Yahoo Mail Plus');
    expect(guide.steps[3]).toContain('the email below');
  });

  it('icloud forwarding guide uses web mail path', () => {
    const guide = getForwardingGuide('icloud');
    expect(guide.steps[0]).toBe('On a computer, go to icloud.com/mail and sign in');
  });

  it('other platform guide encourages forwarding fallback', () => {
    const guide = getEmailSyncGuide('other');
    expect(
      guide.recipientSteps.some((step) => step.toLowerCase().includes('forward email'))
    ).toBe(true);
  });

  it('booksy guide uses action-led copy referencing email below', () => {
    const guide = getEmailSyncGuide('booksy');
    expect(guide.recipientSteps[0]).toBe('On a computer, sign in to Booksy Biz');
    expect(guide.recipientSteps[2]).toContain('the email below');
  });

  it('gmail forwarding guide references email below and uses tap Verify wording', () => {
    const guide = getForwardingGuide('gmail');
    expect(guide.steps[2]).toContain('the email below');
    expect(guide.steps[3]).toContain('tap Verify');
    expect(guide.steps[3]).not.toContain('above');
  });

  it('exposes path intro helpers without em dashes', () => {
    expect(getPlatformPathIntro('Booksy')).toBe(
      'Add the email below in Booksy to receive booking notifications',
    );
    expect(getForwardingPathIntro('Booksy')).toBe(
      'Forward appointment emails from your booking platform'
    );
    expect(getPlatformPathIntro('Booksy')).not.toContain('—');
    expect(getForwardingPathIntro('Booksy')).not.toContain('—');
  });

  it('exposes rebranded setup copy constants', () => {
    expect(AUTO_OPENINGS_SETUP_TITLE).toBe('Automatically create openings');
    expect(getAutoOpeningsSetupSubtitle('Vagaro')).toBe(
      'When a client cancels on Vagaro, OpenAlert creates an opening and texts your waitlist',
    );
    expect(getAutoOpeningsSetupSheetSubtitle('setmore')).toBe(
      'Choose how you want to connect OpenAlert to Setmore',
    );
    expect(getAutoOpeningsSetupSheetSubtitle(null)).toBe(
      AUTO_OPENINGS_SETUP_SHEET_SUBTITLE_GENERIC,
    );
    expect(getAutoOpeningsSettingsSubtitle(null)).toBe(AUTO_OPENINGS_SETTINGS_SUBTITLE_GENERIC);
    expect(getAutoOpeningsSettingsSubtitle('booksy')).toContain('Booksy');
    expect(HELP_GUIDES_AUTO_OPENINGS_LABEL).toBe('Automatic Openings');
    expect(EMAIL_SYNC_PROVIDER_LABEL).toBe('Your email provider');
    expect(EMAIL_SYNC_EMPTY_PLATFORM_MESSAGE).toBe(
      'Pick your booking platform to see the exact steps'
    );
    expect(EMAIL_SYNC_VERIFY_BUTTON_LABEL).toBe('Verify email');
  });

  it('marks only limited platforms for the forwarding tab by default', () => {
    const limited = getAllEmailSyncPlatformGuides()
      .filter((guide) => guide.supportsDirectRecipient === 'limited')
      .map((guide) => guide.platform);

    expect(limited).toContain('square');
    expect(limited).toContain('glossgenius');
    expect(limited).not.toContain('booksy');
    expect(limited).not.toContain('other');
  });

  it('keeps forwarding guide steps aligned with verify CTA copy', () => {
    for (const option of EMAIL_CLIENT_OPTIONS) {
      const guide = getForwardingGuide(option.value);
      const verifyStep = guide.steps.find((step) => step.toLowerCase().includes('verify'));
      expect(verifyStep, `${option.value} should mention Verify`).toBeTruthy();
    }
  });
});
