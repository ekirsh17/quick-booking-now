export const EMAIL_SYNC_GUIDE_PARAM = 'emailSyncGuide';

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
