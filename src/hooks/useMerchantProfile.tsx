import { useState, useEffect } from 'react';
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

export const useMerchantProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('business_name, email, phone, address, saved_appointment_names, saved_durations, default_opening_duration')
        .eq('id', user.id)
        .single();
      
      if (data && !error) {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return { profile, loading };
};
