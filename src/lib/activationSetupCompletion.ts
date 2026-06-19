import {
  SETUP_ITEM_IDS,
  SETUP_ITEMS,
  type ActivationProfileSnapshot,
  type ActivationSetupCounts,
  type SetupCompletionMap,
  type SetupItemDefinition,
  type SetupItemId,
} from '@/types/activationSetup';
import { validateAndNormalizeBookingUrl } from '@/utils/bookingUrl';

export const HIDDEN_WHEN_HAS_BOOKING_PLATFORM: SetupItemId[] = [
  'appointment-defaults',
  'create-opening',
];

/**
 * External booking is "connected" when the merchant is on the external path
 * (use_booking_system true with a provider or booking URL), or when onboarding
 * recorded a platform before booking prefs were saved. Manual/native booking
 * (use_booking_system false) always returns false even if a stale provider exists.
 */
export function hasConnectedExternalBookingPlatform(
  profile: ActivationProfileSnapshot
): boolean {
  if (profile.use_booking_system === false) {
    return false;
  }

  if (profile.use_booking_system === true) {
    if (profile.booking_system_provider) {
      return true;
    }

    const url = profile.booking_url?.trim() ?? '';
    return Boolean(url && validateAndNormalizeBookingUrl(url).ok);
  }

  return Boolean(profile.booking_system_provider);
}

export function getApplicableSetupItemIds(
  profile: ActivationProfileSnapshot,
  options?: { previewAll?: boolean }
): SetupItemId[] {
  if (options?.previewAll) {
    return [...SETUP_ITEM_IDS];
  }

  if (!hasConnectedExternalBookingPlatform(profile)) {
    return [...SETUP_ITEM_IDS];
  }

  return SETUP_ITEM_IDS.filter((id) => !HIDDEN_WHEN_HAS_BOOKING_PLATFORM.includes(id));
}

export function getApplicableSetupItems(
  profile: ActivationProfileSnapshot,
  options?: { previewAll?: boolean }
): SetupItemDefinition[] {
  const ids = getApplicableSetupItemIds(profile, options);
  return SETUP_ITEMS.filter((item) => ids.includes(item.id));
}

export function isBookingMethodConfigured(profile: ActivationProfileSnapshot): boolean {
  if (profile.setup_booking_method_confirmed_at) return true;

  if (profile.use_booking_system) {
    const url = profile.booking_url?.trim() ?? '';
    return Boolean(
      profile.booking_system_provider &&
        url &&
        validateAndNormalizeBookingUrl(url).ok
    );
  }

  return profile.use_booking_system === false;
}

export function isBookingPlatformComplete(profile: ActivationProfileSnapshot): boolean {
  if (profile.setup_booking_method_confirmed_at && profile.setup_cancellation_confirmed_at) {
    return true;
  }

  if (!isBookingMethodConfigured(profile)) {
    return false;
  }

  if (!profile.use_booking_system) {
    return true;
  }

  if (profile.setup_cancellation_confirmed_at) {
    return true;
  }

  return profile.auto_openings_enabled !== null;
}

export function isAppointmentDefaultsComplete(
  profile: ActivationProfileSnapshot,
  counts: ActivationSetupCounts
): boolean {
  return Boolean(
    profile.default_opening_duration &&
      profile.default_opening_duration >= 5 &&
      counts.durationPresetsCount >= 1
  );
}

export function isStaffLocationsComplete(counts: ActivationSetupCounts): boolean {
  return counts.locationsCount >= 1 && counts.activeStaffCount >= 1;
}

export function isShareQrComplete(profile: ActivationProfileSnapshot): boolean {
  return Boolean(profile.setup_qr_engaged_at);
}

export function isCreateOpeningComplete(openingsCount: number): boolean {
  return openingsCount > 0;
}

export function computeSetupCompletion(
  profile: ActivationProfileSnapshot,
  counts: ActivationSetupCounts,
  openingsCount: number
): SetupCompletionMap {
  return {
    'booking-platform': isBookingPlatformComplete(profile),
    'appointment-defaults': isAppointmentDefaultsComplete(profile, counts),
    'staff-locations': isStaffLocationsComplete(counts),
    'share-qr': isShareQrComplete(profile),
    'create-opening': isCreateOpeningComplete(openingsCount),
  };
}

export function countCompletedItems(
  completion: SetupCompletionMap,
  applicableIds: readonly SetupItemId[] = SETUP_ITEM_IDS
): number {
  return applicableIds.filter((id) => completion[id]).length;
}

export function isAllSetupComplete(
  completion: SetupCompletionMap,
  applicableIds: readonly SetupItemId[] = SETUP_ITEM_IDS
): boolean {
  return applicableIds.length > 0 && applicableIds.every((id) => completion[id]);
}

export function getFirstIncompleteSetupItem(
  completion: SetupCompletionMap,
  applicableIds: readonly SetupItemId[] = SETUP_ITEM_IDS
): SetupItemId | null {
  return applicableIds.find((id) => !completion[id]) ?? null;
}
