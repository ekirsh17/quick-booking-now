import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST,
  INBOUND_EMAIL_SYNC_SETUP_TOAST,
  shouldShowInboundEmailVerifyButton,
} from './inboundEmailSync';

const readSrc = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('shouldShowInboundEmailVerifyButton', () => {
  it('shows the button when a verification URL exists and setup is incomplete', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-test',
        status: 'verification_received',
        verificationDismissed: false,
      }),
    ).toBe(true);
  });

  it('hides the button when status is active', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-test',
        status: 'active',
        verificationDismissed: false,
      }),
    ).toBe(false);
  });

  it('hides the button when the user dismissed verification for the session', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-test',
        status: 'verification_received',
        verificationDismissed: true,
      }),
    ).toBe(false);
  });

  it('hides the button when no verification URL is available yet', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: '',
        status: 'pending',
        verificationDismissed: false,
      }),
    ).toBe(false);
  });

  it('hides the button for booking-platform path once active even if URL remains in events', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-old',
        status: 'active',
        verificationDismissed: false,
      }),
    ).toBe(false);
  });
});

describe('inbound email sync toast copy', () => {
  it('uses concise setup confirmation copy', () => {
    expect(INBOUND_EMAIL_SYNC_SETUP_TOAST.title).toBe('Email sync set up');
  });

  it('keeps popup-blocked guidance actionable', () => {
    expect(INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.title).toContain('new tab');
    expect(INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.description).toContain('return to this page');
  });
});

describe('email sync UI regression guards', () => {
  const settingsSource = readSrc('src/pages/merchant/Settings.tsx');
  const hookSource = readSrc('src/hooks/useInboundEmailSync.ts');
  const guidesSource = readSrc('src/lib/emailSyncSetupGuides.ts');
  const sheetSource = readSrc('src/components/merchant/settings/EmailSyncSetupSheet.tsx');

  it('removes the persistent setup status line from Settings', () => {
    expect(settingsSource).not.toContain('Setup status:');
    expect(settingsSource).not.toContain('forwardingStatusLabel');
    expect(settingsSource).not.toContain('showForwardingStatus');
  });

  it('wires Settings through useInboundEmailSync', () => {
    expect(settingsSource).toContain('useInboundEmailSync');
    expect(settingsSource).toContain('showVerifyButton');
    expect(settingsSource).toContain('openForwardingVerification');
  });

  it('does not reference removed inbound email state setters in fetchProfile', () => {
    expect(settingsSource).not.toContain('setInboundEmailStatus');
    expect(settingsSource).not.toContain('setInboundEmailVerifiedAt');
  });

  it('does not open verification links directly in a new tab from Settings', () => {
    expect(settingsSource).not.toMatch(
      /window\.open\(inboundEmailVerificationUrl,\s*"_blank"/,
    );
  });

  it('uses Set up button and EmailSyncSetupSheet instead of inline address field', () => {
    expect(settingsSource).toContain('EmailSyncSetupSheet');
    expect(settingsSource).toContain('Set up');
    expect(settingsSource).toContain('variant="outline"');
    expect(settingsSource).toContain('subtleAccentOutlineHover');
    expect(settingsSource).toContain('openEmailSyncSetup');
    expect(settingsSource).not.toContain('showForwardingSetupHelp');
    expect(settingsSource).not.toContain('ChevronDown');
    expect(settingsSource).not.toContain('forward cancellation emails here');
    expect(settingsSource).not.toMatch(/readOnly[\s\S]*inboundEmailAddress/);
  });

  it('stores platform-specific guide content in emailSyncSetupGuides', () => {
    expect(guidesSource).toContain('recipientSteps');
    expect(guidesSource).toContain('getForwardingGuide');
    expect(guidesSource).toContain("platform: 'booksy'");
    expect(guidesSource).toContain('AUTO_OPENINGS_SETUP_TITLE');
  });

  it('matches add-opening responsive shell patterns in EmailSyncSetupSheet', () => {
    expect(sheetSource).toContain('useIsMobile');
    expect(sheetSource).toContain('side="bottom"');
    expect(sheetSource).toContain('h-[85vh]');
    expect(sheetSource).toContain('DialogContent');
    expect(sheetSource).toContain('sm:max-w-[600px]');
    expect(sheetSource).toContain('AUTO_OPENINGS_SETUP_TITLE');
    expect(sheetSource).toContain('Email provider');
  });

  it('auto-opens setup guide on first auto-openings enable', () => {
    expect(settingsSource).toContain('readEmailSyncGuideSeen');
    expect(settingsSource).toContain('markEmailSyncGuideSeen');
    expect(settingsSource).toContain('handleAutoOpeningsChange');
  });

  it('shows a loading state on the verify button while opening the popup', () => {
    expect(settingsSource).toContain('isOpeningVerification');
    expect(settingsSource).toContain('Opening verification');
  });

  it('uses shared toast copy in the inbound email sync hook', () => {
    expect(hookSource).toContain('INBOUND_EMAIL_SYNC_SETUP_TOAST');
    expect(hookSource).not.toContain('Forwarding verified');
  });
});
