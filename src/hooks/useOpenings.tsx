import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Opening, CreateOpeningInput, UpdateOpeningInput, ConflictCheckParams } from '@/types/openings';
import { toast } from '@/hooks/use-toast';

export const useOpenings = (startDate: Date, endDate: Date) => {
  const { user } = useAuth();
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOpenings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('slots')
        .select('*')
        .eq('merchant_id', user.id)
        .is('deleted_at', null)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
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
  }, [user, startDate.toISOString(), endDate.toISOString()]);

  useEffect(() => {
    fetchOpenings();
  }, [fetchOpenings]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('openings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'slots',
          filter: `merchant_id=eq.${user.id}`,
        },
        () => {
          fetchOpenings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOpenings]);

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
    const { data, error: checkError } = await supabase.rpc('check_slot_conflict', {
      p_merchant_id: params.merchant_id,
      p_staff_id: params.staff_id,
      p_start_time: params.start_time,
      p_end_time: params.end_time,
      p_slot_id: params.slot_id || null,
    });

    if (checkError) throw checkError;
    return data as boolean;
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
