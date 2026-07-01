import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  EMAIL_SYNC_GUIDE_PARAM,
  buildEmailSyncGuideSettingsPath,
  isEmailSyncGuideDeepLinkActive,
} from './emailSyncSetupGuideState';

describe('emailSyncSetupGuideState', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        search: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the help-menu deep link into booking preferences', () => {
    expect(buildEmailSyncGuideSettingsPath()).toBe(
      '/merchant/settings/business?setupSection=booking-platform&emailSyncGuide=1',
    );
  });

  it('detects when the email sync guide deep link is active', () => {
    window.location.search = `?setupSection=booking-platform&${EMAIL_SYNC_GUIDE_PARAM}=1`;
    expect(isEmailSyncGuideDeepLinkActive()).toBe(true);
  });

  it('returns false when the deep link param is absent', () => {
    window.location.search = '?setupSection=booking-platform';
    expect(isEmailSyncGuideDeepLinkActive()).toBe(false);
  });
});
