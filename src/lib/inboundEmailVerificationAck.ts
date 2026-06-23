const VERIFICATION_ACK_PREFIX = 'emailSyncVerificationAck:';
const VERIFICATION_FLOW_PREFIX = 'emailSyncVerificationFlow:';

export function getVerificationAckStorageKey(userId: string): string {
  return `${VERIFICATION_ACK_PREFIX}${userId}`;
}

export function readVerificationAck(userId: string | null): string | null {
  if (!userId || typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(getVerificationAckStorageKey(userId));
}

export function writeVerificationAck(userId: string, verificationUrl: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(getVerificationAckStorageKey(userId), verificationUrl);
}

export function clearVerificationAck(userId: string | null): void {
  if (!userId || typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(getVerificationAckStorageKey(userId));
}

export function isVerificationAcknowledgedForUrl(
  userId: string | null,
  verificationUrl: string,
): boolean {
  if (!userId || !verificationUrl) return false;
  return readVerificationAck(userId) === verificationUrl;
}

/**
 * Derives whether the verify CTA should stay dismissed for the current URL.
 * When the events query temporarily returns no URL, keep dismissal if an ack exists.
 */
export function resolveVerificationDismissedState(options: {
  userId: string | null;
  verificationUrl: string;
  storedAckUrl?: string | null;
}): boolean {
  const { userId, verificationUrl, storedAckUrl = readVerificationAck(userId) } = options;

  if (!userId) return false;
  if (!verificationUrl) return !!storedAckUrl;
  return storedAckUrl === verificationUrl;
}

/**
 * Clears a stale ack when the server reports a different verification URL.
 */
export function reconcileVerificationAckForUrl(
  userId: string | null,
  verificationUrl: string,
): void {
  if (!userId || !verificationUrl) return;

  const storedAckUrl = readVerificationAck(userId);
  if (storedAckUrl && storedAckUrl !== verificationUrl) {
    clearVerificationAck(userId);
  }
}

export function getVerificationFlowStorageKey(userId: string): string {
  return `${VERIFICATION_FLOW_PREFIX}${userId}`;
}

export function writeVerificationFlowPending(userId: string, verificationUrl: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(getVerificationFlowStorageKey(userId), verificationUrl);
}

export function readVerificationFlowPending(userId: string | null): string | null {
  if (!userId || typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(getVerificationFlowStorageKey(userId));
}

export function clearVerificationFlowPending(userId: string | null): void {
  if (!userId || typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(getVerificationFlowStorageKey(userId));
}
