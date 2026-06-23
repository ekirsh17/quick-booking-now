import type { EmailSyncPathKind } from '@/lib/emailSyncSetupGuides';

export const INBOUND_EMAIL_SYNC_SETUP_TOAST = {
  title: 'Email sync set up',
} as const;

export const INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST = {
  title: 'Verification opened in a new tab',
  description: 'Complete verification there, then return to this page.',
} as const;

export type AutoOpeningsConnectionVariant = 'synced' | 'verify' | 'pending' | 'loading';

export type AutoOpeningsConnectionStatus = {
  statusLine: string;
  variant: AutoOpeningsConnectionVariant;
};

export const AUTO_OPENINGS_CONNECTION_COPY = {
  synced: {
    statusLine: 'Enabled',
    variant: 'synced' as const,
  },
  verify: {
    statusLine: 'Verify email',
    variant: 'verify' as const,
  },
  pendingForwarding: {
    statusLine: 'Awaiting verification',
    variant: 'pending' as const,
  },
  pendingPlatform: {
    statusLine: 'Awaiting first email',
    variant: 'pending' as const,
  },
  loading: {
    statusLine: 'Setting up…',
    variant: 'loading' as const,
  },
} satisfies Record<string, AutoOpeningsConnectionStatus>;

export function shouldShowInboundEmailVerifyButton(options: {
  verificationUrl: string;
  status: string;
  verificationDismissed: boolean;
}): boolean {
  const { verificationUrl, status, verificationDismissed } = options;
  return !!verificationUrl && status !== 'active' && !verificationDismissed;
}

export function getAutoOpeningsConnectionStatus(options: {
  status: string;
  showVerifyButton: boolean;
  isLoading: boolean;
  hasLoadedStatus: boolean;
  setupPath?: EmailSyncPathKind | null;
  verificationAcknowledged?: boolean;
}): AutoOpeningsConnectionStatus {
  const {
    status,
    showVerifyButton,
    isLoading,
    hasLoadedStatus,
    setupPath,
    verificationAcknowledged = false,
  } = options;

  if (isLoading && !hasLoadedStatus && status !== 'active') {
    return AUTO_OPENINGS_CONNECTION_COPY.loading;
  }

  if (status === 'active') {
    return AUTO_OPENINGS_CONNECTION_COPY.synced;
  }

  if (showVerifyButton) {
    return AUTO_OPENINGS_CONNECTION_COPY.verify;
  }

  if (status === 'verification_received' && verificationAcknowledged) {
    return AUTO_OPENINGS_CONNECTION_COPY.pendingPlatform;
  }

  if (setupPath === 'platform_recipient') {
    return AUTO_OPENINGS_CONNECTION_COPY.pendingPlatform;
  }

  return AUTO_OPENINGS_CONNECTION_COPY.pendingForwarding;
}
