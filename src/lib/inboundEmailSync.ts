export const INBOUND_EMAIL_SYNC_SETUP_TOAST = {
  title: 'Email sync set up',
} as const;

export const INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST = {
  title: 'Verification opened in a new tab',
  description: 'Complete verification there, then return to this page.',
} as const;

export function shouldShowInboundEmailVerifyButton(options: {
  verificationUrl: string;
  status: string;
  verificationDismissed: boolean;
}): boolean {
  const { verificationUrl, status, verificationDismissed } = options;
  return !!verificationUrl && status !== 'active' && !verificationDismissed;
}
