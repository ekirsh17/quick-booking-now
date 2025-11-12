import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface CalendarAccount {
  id: string;
  provider: string;
  email: string;
  status: string;
  connected_at: string;
  meta?: any;
}

export const useCalendarAccounts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchAccounts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_calendar_accounts')
        .select('*')
        .eq('merchant_id', user.id)
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
      console.log('Initiating Google Calendar OAuth...');
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth-init');
      
      if (error) {
        console.error('OAuth initialization error:', error);
        throw error;
      }
      
      if (data?.authUrl) {
        console.log('Opening OAuth URL:', data.authUrl);
        console.log('Debug info:', data.debug);
        
        // Use popup instead of redirect to avoid losing state
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.authUrl,
          'Google Calendar Authorization',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
        );
        
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          console.log('Popup blocked, redirecting instead...');
          // Fallback to redirect if popup is blocked
          window.location.href = data.authUrl;
        } else {
          console.log('OAuth popup opened successfully');
          
          // Listen for postMessage from popup
          const messageHandler = async (event: MessageEvent) => {
            if (event.data.type === 'CALENDAR_OAUTH_SUCCESS') {
              console.log('Calendar OAuth success message received');
              popup.close();
              
              // Initial sync: push all booked appointments to calendar
              try {
                await supabase.functions.invoke('push-bookings-to-calendar');
                toast({
                  title: 'Success',
                  description: 'Google Calendar connected and bookings synced',
                });
              } catch (error) {
                console.error('Error syncing initial bookings:', error);
                toast({
                  title: 'Connected',
                  description: 'Google Calendar connected. Use Sync Now to sync bookings.',
                });
              }
              
              fetchAccounts();
              window.removeEventListener('message', messageHandler);
            } else if (event.data.type === 'CALENDAR_OAUTH_ERROR') {
              console.error('Calendar OAuth error:', event.data.error);
              popup.close();
              toast({
                title: 'Connection Failed',
                description: event.data.error || 'Failed to connect Google Calendar',
                variant: 'destructive',
              });
              window.removeEventListener('message', messageHandler);
            }
          };
          
          window.addEventListener('message', messageHandler);
        }
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

  const disconnectAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('external_calendar_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Calendar account disconnected',
      });

      fetchAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect calendar account',
        variant: 'destructive',
      });
    }
  };

  const syncCalendar = async () => {
    setSyncing(true);
    try {
      // First pull events from Google Calendar (creates blocked slots)
      const { error: pullError } = await supabase.functions.invoke('sync-calendar-events');
      if (pullError) throw pullError;
      
      // Then push booked appointments to Google Calendar
      const { data, error: pushError } = await supabase.functions.invoke('push-bookings-to-calendar');
      if (pushError) throw pushError;
      
      toast({
        title: 'Success',
        description: data?.synced 
          ? `Synced ${data.synced} booked appointments to your calendar`
          : 'Calendar sync completed',
      });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: 'Error',
        description: 'Failed to sync calendar events',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAccounts();

    // Set up realtime subscription
    const channel = supabase
      .channel('calendar_accounts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'external_calendar_accounts',
          filter: `merchant_id=eq.${user?.id}`,
        },
        () => {
          fetchAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    accounts,
    loading,
    syncing,
    connectGoogle,
    disconnectAccount,
    syncCalendar,
    refetch: fetchAccounts,
  };
};
