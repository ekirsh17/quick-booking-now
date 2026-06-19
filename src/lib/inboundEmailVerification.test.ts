import { describe, expect, it } from 'vitest';
import {
  extractFirstUrl,
  isForwardingVerification,
  parseForwardingVerificationEmail,
  VERIFICATION_SUBJECT_MATCHERS,
} from '@inbound-verification';

describe('isForwardingVerification', () => {
  it('detects Gmail forwarding confirmation emails', () => {
    expect(
      isForwardingVerification(
        'Gmail Forwarding Confirmation - Receive Mail from user@gmail.com',
        'user@gmail.com has requested to automatically forward mail to your email address.',
      ),
    ).toBe(true);
  });

  it('detects Outlook-style forwarding verification emails', () => {
    expect(
      isForwardingVerification(
        'Verify your forwarding address',
        'Please confirm your request to forward mail.',
      ),
    ).toBe(true);
  });

  it('detects Yahoo-style forwarding confirmation emails', () => {
    expect(
      isForwardingVerification(
        'Yahoo Mail - Forwarding confirmation',
        'Confirm forwarding to complete setup.',
      ),
    ).toBe(true);
  });

  it('does not classify cancellation emails as verification', () => {
    expect(
      isForwardingVerification(
        'Appointment canceled: Fri 27 Jun 2025 at 10:00 AM',
        'Your appointment has been canceled.',
      ),
    ).toBe(false);
  });

  it('does not classify unrelated inbox mail as verification', () => {
    expect(
      isForwardingVerification(
        'Your weekly summary',
        'Here is what happened in your account this week.',
      ),
    ).toBe(false);
  });
});

describe('extractFirstUrl', () => {
  it('extracts the first https link from plain text', () => {
    expect(
      extractFirstUrl('Confirm here: https://mail.google.com/mail/vf-123 more text'),
    ).toBe('https://mail.google.com/mail/vf-123');
  });

  it('extracts links from html-like fragments', () => {
    expect(
      extractFirstUrl('<a href="https://account.live.com/Aliases/Verify?token=test">Verify</a>'),
    ).toBe('https://account.live.com/Aliases/Verify?token=test');
  });

  it('returns null when no link is present', () => {
    expect(extractFirstUrl('Your verification code is 12345678')).toBeNull();
  });
});

describe('parseForwardingVerificationEmail', () => {
  it('returns verification metadata for link-based provider emails', () => {
    const result = parseForwardingVerificationEmail(
      'Verify your forwarding address',
      'Click https://account.live.com/Aliases/Verify?token=test to confirm.',
    );

    expect(result.isVerification).toBe(true);
    expect(result.verificationUrl).toBe('https://account.live.com/Aliases/Verify?token=test');
  });

  it('returns no verification URL for non-verification mail', () => {
    const result = parseForwardingVerificationEmail(
      'New appointment booked',
      'A new appointment has been booked for Friday at 2:00 PM.',
    );

    expect(result.isVerification).toBe(false);
    expect(result.verificationUrl).toBeNull();
  });
});

describe('VERIFICATION_SUBJECT_MATCHERS', () => {
  it('includes generic matchers beyond Gmail-specific wording', () => {
    expect(VERIFICATION_SUBJECT_MATCHERS).toContain('verify forwarding address');
    expect(VERIFICATION_SUBJECT_MATCHERS).toContain('confirm your request to forward');
  });
});
