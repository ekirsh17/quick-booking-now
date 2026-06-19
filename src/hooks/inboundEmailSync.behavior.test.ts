import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSrc = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('inbound email sync hook and popup wiring', () => {
  const popupSource = readSrc('src/hooks/useExternalVerificationPopup.ts');
  const hookSource = readSrc('src/hooks/useInboundEmailSync.ts');

  it('uses a dedicated popup window name for forwarding verification', () => {
    expect(popupSource).toContain("'email_forwarding_verification'");
    expect(popupSource).toContain('const width = 600');
    expect(popupSource).toContain('const height = 700');
  });

  it('completes the flow when the popup closes', () => {
    expect(popupSource).toContain('popupWindow.closed');
    expect(popupSource).toContain('onComplete()');
  });

  it('falls back to a new tab when popups are blocked', () => {
    expect(popupSource).toContain("window.open(url, '_blank', 'noopener,noreferrer')");
    expect(popupSource).toContain('onPopupBlocked?.()');
  });

  it('polls until active and refetches on focus while enabled', () => {
    expect(hookSource).toContain('POLL_FAST_MS');
    expect(hookSource).toContain('POLL_SLOW_MS');
    expect(hookSource).toContain("inboundEmailStatus === 'active'");
    expect(hookSource).toContain('visibilitychange');
    expect(hookSource).toContain('refetchIfStale');
  });

  it('dismisses the verify button for the session after popup completion', () => {
    expect(hookSource).toContain('setVerificationDismissed(true)');
    expect(hookSource).toContain('INBOUND_EMAIL_SYNC_SETUP_TOAST');
  });
});
