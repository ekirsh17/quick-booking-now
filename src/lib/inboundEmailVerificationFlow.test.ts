import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  clearVerificationFlowPending,
  readVerificationFlowPending,
  writeVerificationFlowPending,
} from './inboundEmailVerificationFlow';

describe('inboundEmailVerificationFlow', () => {
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

  it('tracks in-progress verification flow in session storage', () => {
    writeVerificationFlowPending(userId, verificationUrl);
    expect(readVerificationFlowPending(userId)).toBe(verificationUrl);
    clearVerificationFlowPending(userId);
    expect(readVerificationFlowPending(userId)).toBeNull();
  });
});
