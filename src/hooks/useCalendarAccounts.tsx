import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useOAuthPopup } from './useOAuthPopup';

export interface CalendarAccount {
  id: string;
  provider: string;
  email: string;
  status: string;
  connected_at: string;
  meta?: any;
}

export const useCalendarAccounts = (locationId?: string | null) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { openOAuthPopup, isLoading: oauthLoading } = useOAuthPopup();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchAccounts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!locationId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_calendar_accounts')
        .select('*')
        .eq('merchant_id', user.id)
        .eq('location_id', locationId)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching calendar accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const connectGoogle = async () => {
    try {
      if (!locationId) {
        toast({
          title: 'Select a location',
          description: 'Choose a location before connecting a calendar.',
          variant: 'destructive',
        });
        return;
      }
      console.log('Initiating Google Calendar OAuth...');
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth-init', {
        body: { locationId },
      });
      
      if (error) {
        console.error('OAuth initialization error:', error);
        throw error;
      }
      
      if (data?.authUrl) {
        console.log('Opening OAuth popup:', data.authUrl);
        const authUrl = data.authUrl as string;
        
        openOAuthPopup(
          authUrl,
          // Success callback
          async () => {
            console.log('OAuth success via popup');
            
            // Trigger initial sync
            try {
              const { data: syncData, error: syncError } = await supabase.functions.invoke('push-bookings-to-calendar', {
                body: { locationId },
              });
              if (syncError) throw syncError;
              
              toast({
                title: 'Success',
                description: syncData?.synced 
                  ? `Calendar connected! ${syncData.synced} booking${syncData.synced > 1 ? 's' : ''} synced.`
                  : 'Google Calendar connected successfully',
              });
            } catch (error) {
              console.error('Error syncing initial bookings:', error);
              toast({
                title: 'Connected',
                description: 'Google Calendar connected. Use Sync Now to sync bookings.',
              });
            }
            
            // Refresh accounts list
            fetchAccounts();
          },
          // Error callback
          (errorMsg: string) => {
            console.error('OAuth error via popup:', errorMsg);
            
            if (errorMsg === 'Popup blocked. Please allow popups for this site and try again.') {
              toast({
                title: 'Popup Blocked',
                description: 'Please allow popups for this site and try again.',
                variant: 'destructive',
              });
            } else if (errorMsg !== 'OAuth cancelled') {
              toast({
                title: 'Connection Error',
                description: errorMsg || 'Failed to connect to Google Calendar',
                variant: 'destructive',
              });
            }
          }
        );
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to Google Calendar. Check the setup guide for details.',
        variant: 'destructive',
      });
    }
  };

  const disconnectAccount = async (accountId: string, deleteEvents: boolean) => {
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-calendar-events', {
        body: { accountId, deleteEvents }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: data?.message || 'Calendar account disconnected',
      });

      fetchAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect calendar account',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const syncCalendar = async () => {
    if (!locationId) {
      toast({
        title: 'Select a location',
        description: 'Choose a location before syncing calendars.',
        variant: 'destructive',
      });
      return;
    }
    setSyncing(true);
    try {
      // Push booked appointments to Google Calendar (one-way sync)
      const { data, error } = await supabase.functions.invoke('push-bookings-to-calendar', {
        body: { locationId },
      });
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: data?.synced 
          ? `Synced ${data.synced} booked appointment${data.synced > 1 ? 's' : ''} to your calendar`
          : 'Calendar sync completed',
      });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync calendar',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    if (!user || !locationId) {
      return;
    }

    // Set up realtime subscription
    const channel = supabase
      .channel('calendar_accounts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'external_calendar_accounts',
          filter: `merchant_id=eq.${user.id},location_id=eq.${locationId}`,
        },
        () => {
          fetchAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, locationId]);

  return {
    accounts,
    loading,
    syncing,
    disconnecting,
    oauthLoading,
    connectGoogle,
    disconnectAccount,
    syncCalendar,
    refetch: fetchAccounts,
  };
};
