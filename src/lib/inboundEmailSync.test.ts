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

  it('leads setup instructions with booking platform recipient option', () => {
    expect(settingsSource).toContain('Recommended: Add this email as a notification recipient');
    expect(settingsSource).toContain('Alternative: Forward cancellation emails');
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
