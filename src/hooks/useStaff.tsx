import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Staff } from '@/types/openings';

export const useStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [primaryStaff, setPrimaryStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('merchant_id', user.id)
          .eq('active', true)
          .order('is_primary', { ascending: false });

        if (error) throw error;

        setStaff(data as Staff[]);
        setPrimaryStaff((data as Staff[]).find(s => s.is_primary) || null);
      } catch (err) {
        console.error('Error fetching staff:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [user]);

  return {
    staff,
    primaryStaff,
    loading,
  };
};
