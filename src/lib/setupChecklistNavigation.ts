import type { SetupItemId, SetupSectionId } from '@/types/activationSetup';

export const SETUP_SECTION_PARAM = 'setupSection';
export const SETUP_FOCUS_NONCE_PARAM = 'setupFocus';
export const SETUP_CHECKLIST_PREVIEW_PARAM = 'setupChecklist';
export const SETUP_QUERY_PARAM = 'setup';
export const SETUP_TOUR_HANDOFF_VALUE = 'handoff';
export const SETUP_SECTION_FOCUS_EVENT = 'oa-focus-setup-section';

/** Section to scroll/highlight when a checklist item is activated. */
export function getSetupFocusSectionForItem(itemId: SetupItemId): SetupSectionId | null {
  switch (itemId) {
    case 'booking-platform':
    case 'appointment-defaults':
    case 'share-qr':
    case 'create-opening':
      return itemId;
    case 'staff-locations':
      return 'staff-locations';
    default:
      return null;
  }
}

export function shouldFocusSetupSection(itemId: SetupItemId): boolean {
  return getSetupFocusSectionForItem(itemId) !== null;
}

export function getSetupSectionForItem(itemId: SetupItemId): SetupSectionId | null {
  switch (itemId) {
    case 'booking-platform':
    case 'appointment-defaults':
    case 'staff-locations':
      return itemId;
    default:
      return null;
  }
}

export function getSetupItemNavigatePath(itemId: SetupItemId): string {
  switch (itemId) {
    case 'booking-platform':
    case 'appointment-defaults': {
      const params = new URLSearchParams();
      params.set(SETUP_FOCUS_NONCE_PARAM, String(Date.now()));
      params.set(SETUP_SECTION_PARAM, itemId);
      return `/merchant/settings/business?${params.toString()}`;
    }
    case 'staff-locations': {
      const params = new URLSearchParams();
      params.set(SETUP_FOCUS_NONCE_PARAM, String(Date.now()));
      params.set(SETUP_SECTION_PARAM, 'staff-locations');
      return `/merchant/settings/staff-locations?${params.toString()}`;
    }
    case 'share-qr': {
      const params = new URLSearchParams();
      params.set(SETUP_FOCUS_NONCE_PARAM, String(Date.now()));
      params.set(SETUP_SECTION_PARAM, 'share-qr');
      return `/merchant/qr-code?${params.toString()}`;
    }
    case 'create-opening': {
      const params = new URLSearchParams();
      params.set(SETUP_FOCUS_NONCE_PARAM, String(Date.now()));
      params.set(SETUP_SECTION_PARAM, 'create-opening');
      return `/merchant/openings?${params.toString()}`;
    }
    default:
      return '/merchant/openings';
  }
}
