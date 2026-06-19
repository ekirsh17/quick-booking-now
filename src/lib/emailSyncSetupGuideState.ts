export const OA_EMAIL_SYNC_GUIDE_SEEN_KEY = 'oa_email_sync_guide_seen';
export const EMAIL_SYNC_GUIDE_PARAM = 'emailSyncGuide';

export function readEmailSyncGuideSeen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OA_EMAIL_SYNC_GUIDE_SEEN_KEY) === 'true';
}

export function markEmailSyncGuideSeen(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OA_EMAIL_SYNC_GUIDE_SEEN_KEY, 'true');
}

export function buildEmailSyncGuideSettingsPath(): string {
  const params = new URLSearchParams();
  params.set('setupSection', 'booking-platform');
  params.set(EMAIL_SYNC_GUIDE_PARAM, '1');
  return `/merchant/settings/business?${params.toString()}`;
}

export function isEmailSyncGuideDeepLinkActive(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(EMAIL_SYNC_GUIDE_PARAM) === '1';
}
