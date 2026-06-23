import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  clearVerificationAck,
  clearVerificationFlowPending,
  isVerificationAcknowledgedForUrl,
  readVerificationFlowPending,
  reconcileVerificationAckForUrl,
  resolveVerificationDismissedState,
  writeVerificationAck,
  writeVerificationFlowPending,
} from './inboundEmailVerificationAck';

describe('inboundEmailVerificationAck', () => {
  const userId = 'user-123';
  const verificationUrl = 'https://mail.google.com/mail/vf-test';
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

  it('stores and reads acknowledgment keyed by user id', () => {
    writeVerificationAck(userId, verificationUrl);
    expect(isVerificationAcknowledgedForUrl(userId, verificationUrl)).toBe(true);
  });

  it('matches acknowledgment only for the same verification url', () => {
    writeVerificationAck(userId, verificationUrl);
    expect(isVerificationAcknowledgedForUrl(userId, 'https://mail.google.com/mail/vf-new')).toBe(
      false,
    );
  });

  it('clears acknowledgment for a user', () => {
    writeVerificationAck(userId, verificationUrl);
    clearVerificationAck(userId);
    expect(isVerificationAcknowledgedForUrl(userId, verificationUrl)).toBe(false);
  });

  it('keeps dismissal when events url is temporarily empty but ack exists', () => {
    writeVerificationAck(userId, verificationUrl);
    expect(
      resolveVerificationDismissedState({
        userId,
        verificationUrl: '',
        storedAckUrl: verificationUrl,
      }),
    ).toBe(true);
  });

  it('clears dismissal when a new verification url arrives', () => {
    writeVerificationAck(userId, verificationUrl);
    const newUrl = 'https://mail.google.com/mail/vf-new';

    reconcileVerificationAckForUrl(userId, newUrl);

    expect(
      resolveVerificationDismissedState({
        userId,
        verificationUrl: newUrl,
        storedAckUrl: null,
      }),
    ).toBe(false);
  });

  it('restores dismissal when stored ack matches current url', () => {
    writeVerificationAck(userId, verificationUrl);
    expect(
      resolveVerificationDismissedState({
        userId,
        verificationUrl,
        storedAckUrl: verificationUrl,
      }),
    ).toBe(true);
  });

  it('tracks in-progress verification flow in session storage', () => {
    writeVerificationFlowPending(userId, verificationUrl);
    expect(readVerificationFlowPending(userId)).toBe(verificationUrl);
    clearVerificationFlowPending(userId);
    expect(readVerificationFlowPending(userId)).toBeNull();
  });
});
