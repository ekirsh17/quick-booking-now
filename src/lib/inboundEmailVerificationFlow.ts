const VERIFICATION_FLOW_PREFIX = 'emailSyncVerificationFlow:';

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
