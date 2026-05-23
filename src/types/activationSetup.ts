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
    title: 'Link your booking software',
    description: 'Connect where customers book so openings and alerts stay in sync',
  },
  {
    id: 'appointment-defaults',
    title: 'Set your usual appointment length',
    description: 'Pick defaults so posting an opening takes seconds',
  },
  {
    id: 'staff-locations',
    title: 'Add your team and locations',
    description: 'Make sure the right person and place show on every opening',
  },
  {
    id: 'share-qr',
    title: 'Get customers on your waitlist',
    description: 'Share your QR or link so people can hear about openings',
  },
  {
    id: 'create-opening',
    title: 'Post your first opening',
    description: 'Send a test alert and see how filling a slot works',
  },
];

export function getSetupStepNumber(itemId: SetupItemId): number {
  const index = SETUP_ITEMS.findIndex((item) => item.id === itemId);
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
