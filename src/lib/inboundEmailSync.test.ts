import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTO_OPENINGS_CONNECTION_COPY,
  INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST,
  INBOUND_EMAIL_SYNC_SETUP_TOAST,
  getAutoOpeningsConnectionStatus,
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
        verifiedAt: null,
      }),
    ).toBe(true);
  });

  it('hides the button when status is active', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-test',
        status: 'active',
        verifiedAt: null,
      }),
    ).toBe(false);
  });

  it('hides the button when the merchant has acknowledged verification in the database', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-test',
        status: 'verification_received',
        verifiedAt: '2026-06-19T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('hides the button when no verification URL is available yet', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: '',
        status: 'pending',
        verifiedAt: null,
      }),
    ).toBe(false);
  });

  it('hides the button for booking-platform path once active even if URL remains in events', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-old',
        status: 'active',
        verifiedAt: null,
      }),
    ).toBe(false);
  });
});

describe('getAutoOpeningsConnectionStatus', () => {
  it('returns enabled when inbound email status is active', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'active',
        showVerifyButton: false,
        isLoading: false,
        hasLoadedStatus: true,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.synced);
  });

  it('returns verify when forwarding verification is still required', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'verification_received',
        showVerifyButton: true,
        isLoading: false,
        hasLoadedStatus: true,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.verify);
    expect(AUTO_OPENINGS_CONNECTION_COPY.verify.statusLine).toBe('Verify email');
  });

  it('returns awaiting first email after verification is acknowledged', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'verification_received',
        showVerifyButton: false,
        isLoading: false,
        hasLoadedStatus: true,
        verifiedAt: '2026-06-19T12:00:00.000Z',
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.pendingPlatform);
  });

  it('keeps verify hidden when events url is empty but verified_at is set', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: '',
        status: 'verification_received',
        verifiedAt: '2026-06-19T12:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('returns finish setup copy when inbound email status is still pending', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'pending',
        showVerifyButton: false,
        isLoading: false,
        hasLoadedStatus: true,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.pending);
  });

  it('returns loading only on initial fetch before status has loaded', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'pending',
        showVerifyButton: false,
        isLoading: true,
        hasLoadedStatus: false,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.loading);
  });

  it('does not return loading during background refetch after status has loaded', () => {
    expect(
      getAutoOpeningsConnectionStatus({
        status: 'pending',
        showVerifyButton: false,
        isLoading: true,
        hasLoadedStatus: true,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.pending);
  });

  it('does not use trailing periods in merchant-facing status lines', () => {
    for (const status of Object.values(AUTO_OPENINGS_CONNECTION_COPY)) {
      expect(status.statusLine.endsWith('.')).toBe(false);
    }
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

  it('uses toggle-driven EmailSyncSetupSheet with outline status actions', () => {
    expect(settingsSource).toContain('EmailSyncSetupSheet');
    expect(settingsSource).toContain('handleAutoOpeningsToggle');
    expect(settingsSource).toContain('autoOpeningsSetupPending');
    expect(settingsSource).toContain('handleEmailSyncSetupComplete');
    expect(settingsSource).not.toContain('lastEmailSyncPath');
    expect(settingsSource).not.toContain('getRecommendedEmailSyncPath');
    expect(settingsSource).toContain('Setup guide');
    expect(settingsSource).toContain('variant="outline"');
    expect(settingsSource).toContain('variant="default"');
    expect(settingsSource).toContain('subtleAccentOutlineHover');
    expect(settingsSource).not.toContain('Open setup guide');
    expect(settingsSource).not.toContain('Set up automatic openings');
    expect(settingsSource).not.toContain('Sync your booking platform to use this');
    expect(settingsSource).toContain('getAutoOpeningsConnectionStatus');
    expect(settingsSource).toContain('inboundEmailVerifiedAt');
    expect(settingsSource).not.toContain('showForwardingSetupHelp');
    expect(settingsSource).not.toContain('showSetupGuideLink');
    expect(settingsSource).not.toContain('ChevronDown');
    expect(settingsSource).not.toContain('forward cancellation emails here');
    expect(settingsSource).not.toMatch(/readOnly[\s\S]*inboundEmailAddress/);
  });

  it('right-aligns status actions with the toggle and uses amber pending', () => {
    expect(settingsSource).toContain('Automatically Create Openings');
    expect(settingsSource).toContain('ml-auto flex shrink-0 items-center gap-2');
    expect(settingsSource).toContain('variant === "pending" && "text-amber-600"');
    expect(settingsSource).toContain('italic tracking-wide');
    expect(settingsSource).not.toMatch(
      /variant === "pending" && "text-muted-foreground"/,
    );
  });

  it('stores platform-specific guide content in emailSyncSetupGuides', () => {
    expect(guidesSource).toContain('recipientSteps');
    expect(guidesSource).toContain('getForwardingGuide');
    expect(guidesSource).toContain("platform: 'booksy'");
    expect(guidesSource).toContain('AUTO_OPENINGS_SETUP_TITLE');
    expect(guidesSource).not.toContain('chipStep');
    expect(guidesSource).not.toContain('SETUP_EMAIL_CHIP');
    expect(guidesSource).not.toContain('Verify below');
  });

  it('matches add-opening responsive shell patterns in EmailSyncSetupSheet', () => {
    expect(sheetSource).toContain('useIsMobile');
    expect(sheetSource).toContain('side="bottom"');
    expect(sheetSource).toContain('max-h-[90vh]');
    expect(sheetSource).toContain('DialogContent');
    expect(sheetSource).toContain('sm:max-w-[600px]');
    expect(sheetSource).toContain('AUTO_OPENINGS_SETUP_TITLE');
    expect(sheetSource).toContain('EMAIL_SYNC_VERIFY_BUTTON_LABEL');
    expect(sheetSource).toContain('ProviderHelpLink');
    expect(sheetSource).toContain('forwardingGuide.officialHelpUrl');
    expect(sheetSource).toContain('SetupEmailInline');
    expect(sheetSource).toContain('Your email provider');
    expect(sheetSource).not.toContain('EMAIL_SYNC_PROVIDER_LABEL');
    expect(sheetSource).not.toContain('OpenAlertAddressBlock');
    expect(sheetSource).not.toContain('Turn on automatic openings');
  });

  it('prefetches inbound email while the setup sheet is open', () => {
    expect(settingsSource).toContain('autoOpeningsEnabled || emailSyncSetupOpen');
    expect(settingsSource).not.toContain('readEmailSyncGuideSeen');
    expect(settingsSource).not.toContain('markEmailSyncGuideSeen');
    expect(settingsSource).not.toContain('handleAutoOpeningsChange');
  });

  it('uses path-specific footer labels with onComplete path in EmailSyncSetupSheet', () => {
    expect(sheetSource).toContain('EMAIL_SYNC_SETUP_ENABLE_LABEL');
    expect(sheetSource).toContain('EMAIL_SYNC_SETUP_CLOSE_LABEL');
    expect(sheetSource).toContain('enableOnComplete');
    expect(sheetSource).toContain('onComplete');
    expect(sheetSource).toContain('onComplete?.(activeTab)');
    expect(sheetSource).not.toContain('onEnable');
    expect(sheetSource).not.toContain('EmailSyncSetupMode');
  });

  it('shows a loading state on the verify action while opening the popup', () => {
    expect(settingsSource).toContain('isOpeningVerification');
    expect(settingsSource).toContain('Opening…');
  });

  it('uses passive realtime sync instead of interval polling', () => {
    expect(hookSource).toContain('postgres_changes');
    expect(hookSource).toContain('email_inbound_events');
    expect(hookSource).not.toContain('POLL_FAST_MS');
    expect(hookSource).toContain('silent: true');
  });

  it('uses shared toast copy in the inbound email sync hook', () => {
    expect(hookSource).toContain('INBOUND_EMAIL_SYNC_SETUP_TOAST');
    expect(hookSource).not.toContain('Forwarding verified');
  });
});
