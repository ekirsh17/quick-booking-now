import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DurationPreset {
  id: string;
  merchant_id: string;
  label: string;
  duration_minutes: number;
  color_token?: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useDurationPresets = (merchantId?: string) => {
  const [presets, setPresets] = useState<DurationPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPresets = async () => {
    if (!merchantId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('duration_presets')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('position', { ascending: true });

      if (error) throw error;
      setPresets(data || []);
    } catch (error) {
      console.error('Error fetching duration presets:', error);
      toast({
        title: 'Error loading duration presets',
        description: 'Failed to load duration options.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, [merchantId]);

  const createPreset = async (label: string, durationMinutes: number, colorToken?: string) => {
    if (!merchantId) return null;

    try {
      // Get max position
      const maxPosition = presets.length > 0 
        ? Math.max(...presets.map(p => p.position)) 
        : -1;

      const { data, error } = await supabase
        .from('duration_presets')
        .insert({
          merchant_id: merchantId,
          label: label.trim(),
          duration_minutes: durationMinutes,
          color_token: colorToken || null,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      
      await fetchPresets();
      return data;
    } catch (error: any) {
      console.error('Error creating duration preset:', error);
      
      if (error.message?.includes('Maximum 20')) {
        toast({
          title: 'Limit reached',
          description: 'You can have up to 20 duration presets.',
          variant: 'destructive',
        });
      } else if (error.code === '23505') {
        toast({
          title: 'Already exists',
          description: 'This duration preset already exists.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create duration preset.',
          variant: 'destructive',
        });
      }
      return null;
    }
  };

  const updatePreset = async (id: string, updates: Partial<DurationPreset>) => {
    try {
      const { error } = await supabase
        .from('duration_presets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      await fetchPresets();
    } catch (error) {
      console.error('Error updating duration preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to update duration preset.',
        variant: 'destructive',
      });
    }
  };

  const deletePreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('duration_presets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchPresets();
    } catch (error) {
      console.error('Error deleting duration preset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete duration preset.',
        variant: 'destructive',
      });
    }
  };

  const reorderPresets = async (reorderedPresets: DurationPreset[]) => {
    try {
      // Update positions
      const updates = reorderedPresets.map((preset, index) => ({
        id: preset.id,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('duration_presets')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      await fetchPresets();
    } catch (error) {
      console.error('Error reordering duration presets:', error);
      toast({
        title: 'Error',
        description: 'Failed to reorder duration presets.',
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
