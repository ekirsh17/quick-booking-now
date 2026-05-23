import {
  SETUP_ITEM_IDS,
  type ActivationProfileSnapshot,
  type ActivationSetupCounts,
  type SetupCompletionMap,
  type SetupItemId,
} from '@/types/activationSetup';
import { validateAndNormalizeBookingUrl } from '@/utils/bookingUrl';

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

export function countCompletedItems(completion: SetupCompletionMap): number {
  return (Object.keys(completion) as SetupItemId[]).filter((id) => completion[id]).length;
}

export function isAllSetupComplete(completion: SetupCompletionMap): boolean {
  return countCompletedItems(completion) === SETUP_ITEM_IDS.length;
}

export function getFirstIncompleteSetupItem(
  completion: SetupCompletionMap
): SetupItemId | null {
  return SETUP_ITEM_IDS.find((id) => !completion[id]) ?? null;
}
