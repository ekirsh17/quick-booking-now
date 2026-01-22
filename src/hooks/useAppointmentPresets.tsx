import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AppointmentPreset {
  id: string;
  merchant_id: string;
  label: string;
  color_token?: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useAppointmentPresets = (merchantId?: string) => {
  const [presets, setPresets] = useState<AppointmentPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const toPresetError = (error: unknown): Error & { code?: string } => {
    if (error instanceof Error) {
      return error as Error & { code?: string };
    }
    const message = typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'Unknown error';
    const presetError = new Error(message) as Error & { code?: string };
    if (typeof error === 'object' && error && 'code' in error) {
      presetError.code = String((error as { code?: unknown }).code);
    }
    return presetError;
  };

  const fetchPresets = async () => {
    if (!merchantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('appointment_type_presets')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('position', { ascending: true });

      if (error) throw error;
      setPresets(data || []);
    } catch (error: unknown) {
      console.error('Error fetching presets:', error);
      toast({
        title: 'Error loading presets',
        description: 'Failed to load appointment types.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, [merchantId]);

  const createPreset = async (label: string, colorToken?: string) => {
    if (!merchantId) return null;

    try {
      // Get max position
      const maxPosition = presets.length > 0 
        ? Math.max(...presets.map(p => p.position)) 
        : -1;

      const { data, error } = await supabase
        .from('appointment_type_presets')
        .insert({
          merchant_id: merchantId,
          label: label.trim(),
          color_token: colorToken || null,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchPresets();
      return data;
    } catch (error: unknown) {
      const presetError = toPresetError(error);
      console.error('Error creating preset:', error);
      
      if (presetError.message.includes('Maximum 20')) {
        toast({
          title: 'Limit reached',
          description: 'You can have up to 20 appointment types.',
          variant: 'destructive',
        });
      } else if (presetError.code === '23505') {
        toast({
          title: 'Already exists',
          description: 'This appointment type already exists.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create appointment type.',
          variant: 'destructive',
        });
      }
      return null;
    }
  };

  const updatePreset = async (id: string, updates: Partial<AppointmentPreset>) => {
    try {
      const { error } = await supabase
        .from('appointment_type_presets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await fetchPresets();
    } catch (error: unknown) {
      console.error('Error updating preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to update appointment type.',
        variant: 'destructive',
      });
    }
  };

  const deletePreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointment_type_presets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchPresets();
    } catch (error: unknown) {
      console.error('Error deleting preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete appointment type.',
        variant: 'destructive',
      });
    }
  };

  const reorderPresets = async (reorderedPresets: AppointmentPreset[]) => {
    try {
      // Update positions
      const updates = reorderedPresets.map((preset, index) => ({
        id: preset.id,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('appointment_type_presets')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      await fetchPresets();
    } catch (error: unknown) {
      console.error('Error reordering presets:', error);
      toast({
        title: 'Error',
        description: 'Failed to reorder appointment types.',
        variant: 'destructive',
      });
    }
  };

  return {
    presets,
    loading,
    createPreset,
    updatePreset,
    deletePreset,
    reorderPresets,
    refetch: fetchPresets,
  };
};
