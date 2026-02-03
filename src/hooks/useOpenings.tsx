import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Opening, CreateOpeningInput, UpdateOpeningInput, ConflictCheckParams } from '@/types/openings';
import { toast } from '@/hooks/use-toast';

export const useOpenings = (startDate: Date, endDate: Date, locationId?: string | null) => {
  const { user } = useAuth();
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const fetchOpenings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!locationId) {
      setOpenings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('slots')
        .select('*')
        .eq('merchant_id', user.id)
        .eq('location_id', locationId)
        .is('deleted_at', null)
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setOpenings(data as Opening[]);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching openings:', err);
    } finally {
      setLoading(false);
    }
  }, [user, locationId, startIso, endIso]);

  useEffect(() => {
    fetchOpenings();
  }, [fetchOpenings]);

  // Real-time subscription
  useEffect(() => {
    if (!user || !locationId) return;

    const channel = supabase
      .channel('openings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slots',
          filter: `merchant_id=eq.${user.id},location_id=eq.${locationId}`,
        },
        () => {
          fetchOpenings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, locationId, fetchOpenings]);

  const createOpening = async (input: CreateOpeningInput) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error: createError } = await supabase
      .from('slots')
      .insert({
        merchant_id: user.id,
        start_time: input.start_time,
        end_time: input.end_time,
        duration_minutes: input.duration_minutes,
        appointment_name: input.appointment_name || null,
        notes: input.notes || null,
        staff_id: input.staff_id || null,
        location_id: input.location_id || locationId || null,
        status: 'open',
      })
      .select()
      .single();

    if (createError) throw createError;
    
    // Don't show toast here - let the caller (handleSaveOpening) handle all toasts
    // This prevents duplicate toasts and allows better error handling

    return data;
  };

  const updateOpening = async (id: string, input: UpdateOpeningInput) => {
    const { data, error: updateError } = await supabase
      .from('slots')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    toast({
      title: "Opening updated",
      description: "Opening has been updated successfully",
    });

    return data;
  };

  const deleteOpening = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('slots')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    toast({
      title: "Opening deleted",
      description: "Opening has been removed from your calendar",
    });
  };

  const checkConflict = async (params: ConflictCheckParams): Promise<boolean> => {
    return false;
  };

  return {
    openings,
    loading,
    error,
    createOpening,
    updateOpening,
    deleteOpening,
    checkConflict,
    refetch: fetchOpenings,
  };
};
