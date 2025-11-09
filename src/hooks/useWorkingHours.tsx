import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { WorkingHours } from '@/types/openings';

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '10:00', end: '14:00' },
  sunday: { enabled: false, start: '10:00', end: '14:00' },
};

export const useWorkingHours = () => {
  const { user } = useAuth();
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkingHours = async () => {
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
    };

    fetchWorkingHours();
  }, [user]);

  return {
    workingHours,
    loading,
  };
};
