import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { WorkingHours } from '@/types/openings';

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, start: '06:00', end: '20:00' },
  tuesday: { enabled: true, start: '06:00', end: '20:00' },
  wednesday: { enabled: true, start: '06:00', end: '20:00' },
  thursday: { enabled: true, start: '06:00', end: '20:00' },
  friday: { enabled: true, start: '06:00', end: '20:00' },
  saturday: { enabled: true, start: '06:00', end: '20:00' },
  sunday: { enabled: true, start: '06:00', end: '20:00' },
};

export const useWorkingHours = () => {
  const { user } = useAuth();
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [loading, setLoading] = useState(true);

  const fetchWorkingHours = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('working_hours')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.working_hours) {
        setWorkingHours(data.working_hours as WorkingHours);
      }
    } catch (err) {
      console.error('Error fetching working hours:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkingHours();
  }, [fetchWorkingHours]);

  // Real-time subscription for working hours changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('working-hours-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          fetchWorkingHours();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchWorkingHours]);

  return {
    workingHours,
    loading,
  };
};
