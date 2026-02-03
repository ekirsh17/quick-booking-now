import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type LocationOption = {
  id: string;
  name: string | null;
  time_zone: string | null;
};

interface ActiveLocationState {
  locationId: string | null;
  locations: LocationOption[];
  defaultLocationId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActiveLocationId: (id: string) => void;
}

const ACTIVE_LOCATION_EVENT = 'openalert:active-location-changed';
const LOCATIONS_UPDATED_EVENT = 'openalert:locations-updated';

const getStorageKey = (userId: string) => `openalert_active_location_${userId}`;

const getStoredLocationId = (userId: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(getStorageKey(userId));
  } catch {
    return null;
  }
};

const setStoredLocationId = (userId: string, locationId: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), locationId);
  } catch {
    // Ignore storage errors (private mode, etc.)
  }
};

export function useActiveLocation(): ActiveLocationState {
  const { user } = useAuth();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLocation = useCallback(async () => {
    if (!user?.id) {
      setLocationId(null);
      setLocations([]);
      setDefaultLocationId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [{ data: profile, error: profileError }, { data: locationList, error: locationError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('default_location_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('locations')
        .select('id, name, time_zone')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    if (profileError) {
      console.error('Failed to fetch default location:', profileError);
    }

    if (locationError) {
      console.error('Failed to fetch locations:', locationError);
    }

    const resolvedLocations = (locationList as LocationOption[]) || [];
    setLocations(resolvedLocations);

    const resolvedDefault = (profile as { default_location_id?: string | null })?.default_location_id ?? null;
    setDefaultLocationId(resolvedDefault);

    const storedId = getStoredLocationId(user.id);
    const hasStored = storedId && resolvedLocations.some((loc) => loc.id === storedId);
    const hasDefault = resolvedDefault && resolvedLocations.some((loc) => loc.id === resolvedDefault);

    const nextLocationId = hasStored
      ? (storedId as string)
      : hasDefault
        ? (resolvedDefault as string)
        : resolvedLocations[0]?.id ?? null;

    if (nextLocationId) {
      setStoredLocationId(user.id, nextLocationId);
    }

    setLocationId(nextLocationId);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActiveLocationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ locationId?: string }>).detail;
      if (detail?.locationId) {
        setLocationId(detail.locationId);
      }
    };

    const handleLocationsUpdated = () => {
      fetchLocation();
    };

    window.addEventListener(ACTIVE_LOCATION_EVENT, handleActiveLocationChange as EventListener);
    window.addEventListener(LOCATIONS_UPDATED_EVENT, handleLocationsUpdated);
    return () => {
      window.removeEventListener(ACTIVE_LOCATION_EVENT, handleActiveLocationChange as EventListener);
      window.removeEventListener(LOCATIONS_UPDATED_EVENT, handleLocationsUpdated);
    };
  }, [fetchLocation]);

  const setActiveLocationId = useCallback((nextLocationId: string) => {
    if (!user?.id || !nextLocationId) return;
    setLocationId(nextLocationId);
    setStoredLocationId(user.id, nextLocationId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACTIVE_LOCATION_EVENT, { detail: { locationId: nextLocationId } }));
    }
  }, [user?.id]);

  return {
    locationId,
    locations,
    defaultLocationId,
    loading,
    refresh: fetchLocation,
    setActiveLocationId,
  };
}
