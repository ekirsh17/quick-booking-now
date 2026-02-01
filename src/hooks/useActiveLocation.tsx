import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ActiveLocationState {
  locationId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useActiveLocation(): ActiveLocationState {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLocation = useCallback(async () => {
    if (!user?.id) {
      setLocationId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('default_location_id')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch default location:', error);
      setLocationId(null);
      setLoading(false);
      return;
    }

    const resolvedDefault = (data as { default_location_id?: string | null })?.default_location_id ?? null;
    if (resolvedDefault) {
      setLocationId(resolvedDefault);
      setLoading(false);
      return;
    }

    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (locationError) {
      console.error('Failed to resolve fallback location:', locationError);
      setLocationId(null);
    } else {
      setLocationId(location?.id ?? null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return {
    locationId,
    loading,
    refresh: fetchLocation,
  };
}
