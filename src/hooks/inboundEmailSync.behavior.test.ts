import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSrc = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('inbound email sync hook and popup wiring', () => {
  const popupSource = readSrc('src/hooks/useExternalVerificationPopup.ts');
  const verificationWindowSource = readSrc('src/lib/verificationWindow.ts');
  const hookSource = readSrc('src/hooks/useInboundEmailSync.ts');

  it('uses a dedicated popup window name for forwarding verification', () => {
    expect(verificationWindowSource).toContain("'email_forwarding_verification'");
    expect(verificationWindowSource).toContain('const width = 600');
    expect(verificationWindowSource).toContain('const height = 700');
  });

  it('completes the flow when the popup closes', () => {
    expect(verificationWindowSource).toContain('isVerificationWindowClosed');
    expect(verificationWindowSource).toContain('watchVerificationWindowClose');
    expect(popupSource).toContain('onComplete()');
  });

  it('uses passive realtime sync and refetches on focus while enabled', () => {
    expect(hookSource).toContain('postgres_changes');
    expect(hookSource).toContain('email_inbound_events');
    expect(hookSource).not.toContain('POLL_FAST_MS');
    expect(hookSource).toContain('visibilitychange');
    expect(hookSource).toContain('refetchIfStale');
    expect(hookSource).toContain('verificationFlowStartedRef');
    expect(hookSource).toContain('acknowledge_inbound_email_verification');
    expect(hookSource).toContain('tryCompleteVerificationOnReturn');
    expect(hookSource).toContain('writeVerificationFlowPending');
    expect(hookSource).toContain('shouldCompleteVerificationOnParentReturn');
    expect(hookSource).not.toContain(
      'setVerificationDismissed(false);\n    setHasLoadedStatus(false);',
    );
    expect(hookSource).not.toContain('inboundEmailVerificationAck');
  });

  it('opens a single named verification window', () => {
    expect(popupSource).toContain('openVerificationWindow');
    expect(popupSource).toContain('watchVerificationWindowClose');
    expect(popupSource).not.toContain("window.open(url, '_blank'");
    expect(popupSource).not.toContain('window.open(url, VERIFICATION_WINDOW_NAME)');
  });

  it('persists verify acknowledgment via RPC after popup completion', () => {
    expect(hookSource).toContain('acknowledge_inbound_email_verification');
    expect(hookSource).toContain('setInboundEmailVerifiedAt');
    expect(hookSource).toContain('inboundEmailVerifiedAt');
    expect(hookSource).toContain('INBOUND_EMAIL_SYNC_SETUP_TOAST');
  });
});

describe('email sync setup sheet wiring', () => {
  const sheetSource = readSrc('src/components/merchant/settings/EmailSyncSetupSheet.tsx');

  it('only shows verify in the forwarding tab of the setup sheet', () => {
    expect(sheetSource).toContain("showVerifyButton && activeTab === 'email_forwarding'");
    expect(sheetSource).toContain('EMAIL_SYNC_VERIFY_BUTTON_LABEL');
    expect(sheetSource).toContain('EMAIL_FORWARDING_TAB_LABEL');
    expect(sheetSource).toContain('getPlatformSetupTabLabel');
    expect(sheetSource).toContain('getAutoOpeningsSetupSheetSubtitle');
  });

  it('uses dynamic footer labels and reports the active tab on complete', () => {
    expect(sheetSource).toContain('EMAIL_SYNC_SETUP_ENABLE_LABEL');
    expect(sheetSource).toContain('EMAIL_SYNC_SETUP_CLOSE_LABEL');
    expect(sheetSource).toContain('enableOnComplete');
    expect(sheetSource).toContain('onComplete?.(activeTab)');
    expect(sheetSource).not.toContain('onEnable');
    expect(sheetSource).not.toContain('>Done<');
  });
});
