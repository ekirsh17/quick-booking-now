import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface MerchantProfile {
  business_name: string;
  phone: string;
  address: string | null;
  saved_appointment_names: string[] | null;
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
        .select('business_name, phone, address, saved_appointment_names, default_opening_duration')
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
