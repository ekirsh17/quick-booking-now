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
    expect(hookSource).toContain('writeVerificationAck');
    expect(hookSource).toContain('resolveVerificationDismissedState');
    expect(hookSource).toContain('tryCompleteVerificationOnReturn');
    expect(hookSource).toContain('writeVerificationFlowPending');
    expect(hookSource).toContain('shouldCompleteVerificationOnParentReturn');
    expect(hookSource).not.toContain(
      'setVerificationDismissed(false);\n    setHasLoadedStatus(false);',
    );
  });

  it('opens a single named verification window', () => {
    expect(popupSource).toContain('openVerificationWindow');
    expect(popupSource).toContain('watchVerificationWindowClose');
    expect(popupSource).not.toContain("window.open(url, '_blank'");
    expect(popupSource).not.toContain('window.open(url, VERIFICATION_WINDOW_NAME)');
  });

  it('dismisses the verify button for the session after popup completion', () => {
    expect(hookSource).toContain('setVerificationDismissed(true)');
    expect(hookSource).toContain('writeVerificationAck');
    expect(hookSource).toContain('verificationAcknowledged');
    expect(hookSource).toContain('INBOUND_EMAIL_SYNC_SETUP_TOAST');
  });
});
