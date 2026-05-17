import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface MerchantProfile {
  business_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  saved_appointment_names: string[] | null;
  saved_durations: number[] | null;
  default_opening_duration: number | null;
}

const MERCHANT_PROFILE_UPDATED_EVENT = 'openalert:merchant-profile-updated';

export const useMerchantProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (options?: { silent?: boolean }) => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('business_name, email, phone, address, saved_appointment_names, saved_durations, default_opening_duration')
      .eq('id', user.id)
      .single();

    if (data && !error) {
      setProfile(data);
    }

    if (!options?.silent) {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleProfileUpdated = () => {
      fetchProfile({ silent: true });
    };

    window.addEventListener(MERCHANT_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      window.removeEventListener(MERCHANT_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [fetchProfile]);

  return { profile, loading, refresh: fetchProfile };
};
