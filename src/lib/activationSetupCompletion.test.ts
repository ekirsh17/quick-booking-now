import { describe, expect, it } from 'vitest';
import {
  countCompletedItems,
  getApplicableSetupItemIds,
  getApplicableSetupItems,
  isAllSetupComplete,
} from './activationSetupCompletion';
import { SETUP_ITEM_IDS, type ActivationProfileSnapshot } from '@/types/activationSetup';

const baseProfile: ActivationProfileSnapshot = {
  business_name: null,
  email: null,
  phone: null,
  address: null,
  time_zone: null,
  default_location_id: null,
  use_booking_system: null,
  booking_system_provider: null,
  booking_url: null,
  auto_openings_enabled: null,
  require_confirmation: null,
  inbound_email_status: null,
  inbound_email_verified_at: null,
  default_opening_duration: null,
  onboarding_completed_at: null,
  tutorial_dismissed_at: null,
  tutorial_tour_seen_at: null,
  setup_booking_method_confirmed_at: null,
  setup_cancellation_confirmed_at: null,
  setup_confirmation_confirmed_at: null,
  setup_qr_engaged_at: null,
};

describe('getApplicableSetupItemIds', () => {
  it('returns all steps when no booking platform is set', () => {
    expect(getApplicableSetupItemIds(baseProfile)).toEqual([...SETUP_ITEM_IDS]);
  });

  it('hides appointment defaults and create opening when a platform is set', () => {
    const ids = getApplicableSetupItemIds({
      ...baseProfile,
      booking_system_provider: 'booksy',
    });

    expect(ids).toEqual(['booking-platform', 'staff-locations', 'share-qr']);
    expect(ids).not.toContain('appointment-defaults');
    expect(ids).not.toContain('create-opening');
  });

  it('returns all steps in preview mode even with a platform', () => {
    expect(
      getApplicableSetupItemIds(
        { ...baseProfile, booking_system_provider: 'square' },
        { previewAll: true }
      )
    ).toEqual([...SETUP_ITEM_IDS]);
  });
});

describe('applicable setup completion', () => {
  it('counts completion only for applicable steps', () => {
    const completion = {
      'booking-platform': true,
      'appointment-defaults': false,
      'staff-locations': true,
      'share-qr': false,
      'create-opening': false,
    };
    const applicableIds = getApplicableSetupItemIds({
      ...baseProfile,
      booking_system_provider: 'booksy',
    });

    expect(countCompletedItems(completion, applicableIds)).toBe(2);
    expect(isAllSetupComplete(completion, applicableIds)).toBe(false);
  });

  it('maps applicable items in canonical order', () => {
    const items = getApplicableSetupItems({
      ...baseProfile,
      booking_system_provider: 'fresha',
    });

    expect(items.map((item) => item.id)).toEqual([
      'booking-platform',
      'staff-locations',
      'share-qr',
    ]);
  });
});
