import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook to automatically sync bookings to Google Calendar in real-time
 * Listens for slot status changes to 'booked' and triggers calendar sync
 */
export const useBookingSync = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('Setting up real-time booking sync for merchant:', user.id);

    // Subscribe to slot changes
    const channel = supabase
      .channel('booking_sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'slots',
          filter: `merchant_id=eq.${user.id}`,
        },
        async (payload) => {
          const newSlot = payload.new as any;
          const oldSlot = payload.old as any;

          // Check if status changed to 'booked'
          if (newSlot.status === 'booked' && oldSlot?.status !== 'booked') {
            console.log('New booking detected, syncing to calendar:', newSlot.id);
            
            try {
              // Push this specific booking to calendar
              const { error } = await supabase.functions.invoke('push-bookings-to-calendar', {
                body: { slot_id: newSlot.id }
              });
              
              if (error) {
                console.error('Failed to sync booking to calendar:', error);
              } else {
                console.log('Successfully synced booking to calendar');
              }
            } catch (error) {
              console.error('Error syncing booking:', error);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up booking sync subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);
};
