import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AUTO_OPENINGS_CONNECTION_COPY,
  getAutoOpeningsConnectionStatus,
  shouldShowInboundEmailVerifyButton,
} from './inboundEmailSync';
import {
  clearVerificationFlowPending,
  readVerificationFlowPending,
  writeVerificationFlowPending,
} from './inboundEmailVerificationFlow';
import {
  getDefaultEmailSyncTab,
  getRecommendedEmailSyncPath,
} from './emailSyncSetupGuides';
import {
  isVerificationWindowReachable,
  shouldCompleteVerificationOnParentReturn,
} from './verificationWindow';

const userId = 'merchant-abc';
const verificationUrl = 'https://mail.google.com/mail/vf-test';
const verifiedAt = '2026-06-19T12:00:00.000Z';

describe('auto-openings connection status lifecycle', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  it('maps the main merchant-facing states', () => {
    const cases: Array<{
      name: string;
      status: string;
      showVerifyButton: boolean;
      verifiedAt: string | null;
      expected: (typeof AUTO_OPENINGS_CONNECTION_COPY)[keyof typeof AUTO_OPENINGS_CONNECTION_COPY];
    }> = [
      {
        name: 'fully enabled',
        status: 'active',
        showVerifyButton: false,
        verifiedAt: null,
        expected: AUTO_OPENINGS_CONNECTION_COPY.synced,
      },
      {
        name: 'needs provider verify',
        status: 'verification_received',
        showVerifyButton: true,
        verifiedAt: null,
        expected: AUTO_OPENINGS_CONNECTION_COPY.verify,
      },
      {
        name: 'awaiting first email after verify ack',
        status: 'verification_received',
        showVerifyButton: false,
        verifiedAt,
        expected: AUTO_OPENINGS_CONNECTION_COPY.pendingPlatform,
      },
      {
        name: 'pending before any inbound email activity',
        status: 'pending',
        showVerifyButton: false,
        verifiedAt: null,
        expected: AUTO_OPENINGS_CONNECTION_COPY.pending,
      },
    ];

    for (const testCase of cases) {
      expect(
        getAutoOpeningsConnectionStatus({
          status: testCase.status,
          showVerifyButton: testCase.showVerifyButton,
          isLoading: false,
          hasLoadedStatus: true,
          verifiedAt: testCase.verifiedAt,
        }),
        testCase.name,
      ).toEqual(testCase.expected);
    }
  });

  it('simulates closing the provider tab and returning to Settings', () => {
    writeVerificationFlowPending(userId, verificationUrl);

    const popupStillReportsOpen = {
      closed: false,
      focus: () => {
        throw new DOMException('Blocked a frame with origin', 'SecurityError');
      },
    } as unknown as Window;

    expect(isVerificationWindowReachable(popupStillReportsOpen)).toBe(false);
    expect(shouldCompleteVerificationOnParentReturn(popupStillReportsOpen)).toBe(true);

    clearVerificationFlowPending(userId);

    expect(readVerificationFlowPending(userId)).toBeNull();

    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl,
        status: 'verification_received',
        verifiedAt,
      }),
    ).toBe(false);

    expect(
      getAutoOpeningsConnectionStatus({
        status: 'verification_received',
        showVerifyButton: false,
        isLoading: false,
        hasLoadedStatus: true,
        verifiedAt,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.pendingPlatform);
  });

  it('re-shows verify when verified_at is cleared for a new forwarding verification', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: 'https://mail.google.com/mail/vf-new',
        status: 'verification_received',
        verifiedAt: null,
      }),
    ).toBe(true);
  });

  it('hides verify when verified_at is set even if verification url is temporarily empty', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl: '',
        status: 'verification_received',
        verifiedAt,
      }),
    ).toBe(false);
  });

  it('hides verify once inbound email status is active even if old url remains', () => {
    expect(
      shouldShowInboundEmailVerifyButton({
        verificationUrl,
        status: 'active',
        verifiedAt: null,
      }),
    ).toBe(false);

    expect(
      getAutoOpeningsConnectionStatus({
        status: 'active',
        showVerifyButton: false,
        isLoading: false,
        hasLoadedStatus: true,
        verifiedAt: null,
      }),
    ).toEqual(AUTO_OPENINGS_CONNECTION_COPY.synced);
  });
});

describe('auto-openings setup guide path selection', () => {
  it('recommends forwarding for limited platforms and recipient for supported platforms', () => {
    expect(getRecommendedEmailSyncPath('square')).toBe('email_forwarding');
    expect(getRecommendedEmailSyncPath('glossgenius')).toBe('email_forwarding');
    expect(getRecommendedEmailSyncPath('booksy')).toBe('platform_recipient');
    expect(getRecommendedEmailSyncPath('vagaro')).toBe('platform_recipient');
    expect(getDefaultEmailSyncTab('square')).toBe(getRecommendedEmailSyncPath('square'));
  });

  it('defaults unknown platforms to the recipient tab first', () => {
    expect(getRecommendedEmailSyncPath('other')).toBe('platform_recipient');
    expect(getRecommendedEmailSyncPath(null)).toBe('platform_recipient');
  });
});
