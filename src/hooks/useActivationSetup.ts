import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import {
  computeSetupCompletion,
  countCompletedItems,
  getFirstIncompleteSetupItem,
  isAllSetupComplete,
} from '@/lib/activationSetupCompletion';
import { addManuallyCompletedItem, addManuallyIncompleteItem } from '@/lib/setupChecklistAdmin';
import type {
  ActivationProfileSnapshot,
  ActivationSetupCounts,
  SetupCompletionMap,
  SetupItemId,
} from '@/types/activationSetup';

const PROFILE_SELECT_CORE = [
  'business_name',
  'email',
  'phone',
  'address',
  'time_zone',
  'default_location_id',
  'use_booking_system',
  'booking_system_provider',
  'booking_url',
  'auto_openings_enabled',
  'require_confirmation',
  'inbound_email_status',
  'inbound_email_verified_at',
  'default_opening_duration',
  'onboarding_completed_at',
  'tutorial_dismissed_at',
  'tutorial_tour_seen_at',
].join(', ');

const PROFILE_SELECT_SETUP =
  'setup_booking_method_confirmed_at, setup_cancellation_confirmed_at, setup_confirmation_confirmed_at, setup_qr_engaged_at';

const EMPTY_COUNTS: ActivationSetupCounts = {
  durationPresetsCount: 0,
  locationsCount: 0,
  activeStaffCount: 0,
};

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST204' ||
    Boolean(error.message?.includes('does not exist')) ||
    Boolean(error.message?.includes('schema cache'))
  );
}

const EMPTY_PROFILE: ActivationProfileSnapshot = {
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

export function useActivationSetup() {
  const { user } = useAuth();
  const { locations } = useActiveLocation();
  const [profile, setProfile] = useState<ActivationProfileSnapshot>(EMPTY_PROFILE);
  const [setupCounts, setSetupCounts] = useState<ActivationSetupCounts>(EMPTY_COUNTS);
  const [openingsCount, setOpeningsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: { silent?: boolean }): Promise<SetupItemId | null> => {
    if (!user?.id) {
      setProfile(EMPTY_PROFILE);
      setSetupCounts(EMPTY_COUNTS);
      setOpeningsCount(0);
      setLoading(false);
      return null;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    const [
      { data: profileCore, error: profileCoreError },
      { data: profileSetup, error: profileSetupError },
      { count: openingsCountResult, error: openingsError },
      { count: durationPresetsCount, error: durationPresetsError },
      { count: locationsCount, error: locationsError },
      { count: activeStaffCount, error: staffError },
    ] = await Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT_CORE).eq('id', user.id).maybeSingle(),
      supabase.from('profiles').select(PROFILE_SELECT_SETUP).eq('id', user.id).maybeSingle(),
      supabase
        .from('slots')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.id),
      supabase
        .from('duration_presets')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.id),
      supabase
        .from('locations')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.id),
      supabase
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('active', true),
    ]);

    if (profileCoreError) {
      console.error('Failed to load activation setup profile:', profileCoreError);
    }

    if (profileSetupError && !isMissingColumnError(profileSetupError)) {
      console.error('Failed to load activation setup timestamps:', profileSetupError);
    }

    if (durationPresetsError) {
      console.error('Failed to count duration presets for activation setup:', durationPresetsError);
    }
    if (locationsError) {
      console.error('Failed to count locations for activation setup:', locationsError);
    }
    if (staffError) {
      console.error('Failed to count staff for activation setup:', staffError);
    }

    const nextOpeningsCount = openingsError ? 0 : (openingsCountResult ?? 0);
    if (openingsError) {
      console.error('Failed to count openings for activation setup:', openingsError);
    }
    setOpeningsCount(nextOpeningsCount);

    const nextCounts: ActivationSetupCounts = {
      durationPresetsCount: durationPresetsError ? 0 : (durationPresetsCount ?? 0),
      locationsCount: locationsError ? locations.length : (locationsCount ?? locations.length),
      activeStaffCount: staffError ? 0 : (activeStaffCount ?? 0),
    };
    setSetupCounts(nextCounts);

    if (!options?.silent) {
      setLoading(false);
    }

    if (!profileCore || profileCoreError) {
      return null;
    }

    const setupFields = isMissingColumnError(profileSetupError)
      ? {
          setup_booking_method_confirmed_at: null,
          setup_cancellation_confirmed_at: null,
          setup_confirmation_confirmed_at: null,
          setup_qr_engaged_at: null,
        }
      : {
          setup_booking_method_confirmed_at:
            (profileSetup as ActivationProfileSnapshot | null)?.setup_booking_method_confirmed_at ??
            null,
          setup_cancellation_confirmed_at:
            (profileSetup as ActivationProfileSnapshot | null)?.setup_cancellation_confirmed_at ??
            null,
          setup_confirmation_confirmed_at:
            (profileSetup as ActivationProfileSnapshot | null)?.setup_confirmation_confirmed_at ??
            null,
          setup_qr_engaged_at:
            (profileSetup as ActivationProfileSnapshot | null)?.setup_qr_engaged_at ?? null,
        };

    const mergedProfile: ActivationProfileSnapshot = {
      ...(profileCore as ActivationProfileSnapshot),
      ...setupFields,
    };

    setProfile(mergedProfile);

    const nextCompletion = computeSetupCompletion(mergedProfile, nextCounts, nextOpeningsCount);

    return getFirstIncompleteSetupItem(nextCompletion);
  }, [locations.length, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completion = useMemo<SetupCompletionMap>(
    () => computeSetupCompletion(profile, setupCounts, openingsCount),
    [openingsCount, profile, setupCounts]
  );

  const completedCount = useMemo(() => countCompletedItems(completion), [completion]);
  const allComplete = useMemo(() => isAllSetupComplete(completion), [completion]);
  const isActivationEligible = Boolean(profile.onboarding_completed_at);

  const markQrEngaged = useCallback(async () => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ setup_qr_engaged_at: now })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to mark QR setup engagement:', error);
      return;
    }

    setProfile((current) => ({ ...current, setup_qr_engaged_at: now }));
  }, [user?.id]);

  const markSetupItemComplete = useCallback(
    async (itemId: SetupItemId) => {
      if (!user?.id) return;

      addManuallyCompletedItem(itemId);

      const now = new Date().toISOString();
      const updates: Partial<ActivationProfileSnapshot> = {};

      switch (itemId) {
        case 'booking-platform':
          updates.setup_booking_method_confirmed_at = now;
          updates.setup_cancellation_confirmed_at = now;
          break;
        case 'share-qr':
          updates.setup_qr_engaged_at = now;
          break;
        default:
          break;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

        if (error) {
          console.error('Failed to persist setup item completion:', error);
        } else {
          setProfile((current) => ({ ...current, ...updates }));
        }
      }

      await refresh({ silent: true });
    },
    [refresh, user?.id]
  );

  const markSetupItemIncomplete = useCallback(
    async (itemId: SetupItemId) => {
      if (!user?.id) return;

      addManuallyIncompleteItem(itemId);
      await refresh({ silent: true });
    },
    [refresh, user?.id]
  );

  const dismissWelcome = useCallback(async () => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ tutorial_dismissed_at: now })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to dismiss welcome modal:', error);
      return;
    }

    setProfile((current) => ({ ...current, tutorial_dismissed_at: now }));
  }, [user?.id]);

  return {
    profile,
    completion,
    completedCount,
    allComplete,
    isActivationEligible,
    loading,
    openingsCount,
    refresh,
    markQrEngaged,
    markSetupItemComplete,
    markSetupItemIncomplete,
    dismissWelcome,
    showWelcomeModal: isActivationEligible && !profile.tutorial_dismissed_at && !loading,
    showSetupChecklist: isActivationEligible && !allComplete && !loading,
    showSuccessCard: isActivationEligible && allComplete && !loading,
  };
}
