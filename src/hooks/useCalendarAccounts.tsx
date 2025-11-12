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
      const { data, error } = await supabase.functions.invoke('google-calendar-oauth-init');
      
      if (error) throw error;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to Google Calendar',
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
      const { data, error } = await supabase.functions.invoke('sync-calendar-events');
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: data?.synced 
          ? `Synced ${data.synced} calendar events`
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
