export const VERIFICATION_SUBJECT_MATCHERS = [
  'forwarding confirmation',
  'gmail forwarding confirmation',
  'verify your forwarding',
  'confirm forwarding',
  'forwarding verification',
  'verify forwarding address',
  'email forwarding',
  'confirm your request to forward',
  'has requested to automatically forward',
];

export function isForwardingVerification(subject: string, text: string): boolean {
  const haystack = `${subject} ${text}`.toLowerCase();
  return VERIFICATION_SUBJECT_MATCHERS.some((matcher) => haystack.includes(matcher));
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s>"']+/i);
  return match?.[0] || null;
}

export function parseForwardingVerificationEmail(subject: string, text: string): {
  isVerification: boolean;
  verificationUrl: string | null;
} {
  const isVerification = isForwardingVerification(subject, text);
  return {
    isVerification,
    verificationUrl: isVerification ? extractFirstUrl(text) : null,
  };
}
