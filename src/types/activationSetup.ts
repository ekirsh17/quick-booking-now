export const SETUP_ITEM_IDS = [
  'booking-platform',
  'appointment-defaults',
  'staff-locations',
  'share-qr',
  'create-opening',
] as const;

export type SetupItemId = (typeof SETUP_ITEM_IDS)[number];

export type SetupSectionId =
  | 'booking-platform'
  | 'appointment-defaults'
  | 'staff-locations'
  | 'locations'
  | 'staff-members'
  | 'share-qr'
  | 'create-opening';

export interface SetupItemDefinition {
  id: SetupItemId;
  title: string;
  description: string;
}

/** Canonical onboarding order: foundation → defaults → team → growth → first opening. */
export const SETUP_ITEMS: SetupItemDefinition[] = [
  {
    id: 'booking-platform',
    title: 'Set booking preferences',
    description:
      'Optional booking link, cancellation email forwarding, and how customers confirm bookings',
  },
  {
    id: 'appointment-defaults',
    title: 'Review appointment defaults',
    description:
      'Confirm your default length, duration presets, and average appointment value for reporting',
  },
  {
    id: 'staff-locations',
    title: 'Review locations and staff',
    description: 'Confirm location and staff names; add more if you have multiple chairs or sites',
  },
  {
    id: 'share-qr',
    title: 'Share your waitlist',
    description: 'Download your QR or copy your link so customers can join your waitlist',
  },
  {
    id: 'create-opening',
    title: 'Post your first opening',
    description: 'Add a test opening and see how your waitlist gets notified',
  },
];

export function getSetupStepNumber(
  itemId: SetupItemId,
  items: readonly SetupItemDefinition[] = SETUP_ITEMS
): number {
  const index = items.findIndex((item) => item.id === itemId);
  return index >= 0 ? index + 1 : 0;
}

export interface ActivationProfileSnapshot {
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  time_zone: string | null;
  default_location_id: string | null;
  use_booking_system: boolean | null;
  booking_system_provider: string | null;
  booking_url: string | null;
  auto_openings_enabled: boolean | null;
  require_confirmation: boolean | null;
  inbound_email_status: string | null;
  inbound_email_verified_at: string | null;
  default_opening_duration: number | null;
  onboarding_completed_at: string | null;
  tutorial_dismissed_at: string | null;
  tutorial_tour_seen_at: string | null;
  setup_booking_method_confirmed_at: string | null;
  setup_cancellation_confirmed_at: string | null;
  setup_confirmation_confirmed_at: string | null;
  setup_qr_engaged_at: string | null;
}

export interface ActivationSetupCounts {
  durationPresetsCount: number;
  locationsCount: number;
  activeStaffCount: number;
}

export type SetupCompletionMap = Record<SetupItemId, boolean>;
