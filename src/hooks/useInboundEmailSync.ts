import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useExternalVerificationPopup } from '@/hooks/useExternalVerificationPopup';
import {
  INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST,
  INBOUND_EMAIL_SYNC_SETUP_TOAST,
  shouldShowInboundEmailVerifyButton,
} from '@/lib/inboundEmailSync';

const FOCUS_REFETCH_STALE_MS = 10_000;

type UseInboundEmailSyncOptions = {
  enabled: boolean;
  userId: string | null;
};

export function useInboundEmailSync({ enabled, userId }: UseInboundEmailSyncOptions) {
  const { toast } = useToast();
  const { openVerificationPopup, isOpeningVerification } = useExternalVerificationPopup();

  const [inboundEmailAddress, setInboundEmailAddress] = useState('');
  const [inboundEmailStatus, setInboundEmailStatus] = useState('');
  const [inboundEmailVerificationUrl, setInboundEmailVerificationUrl] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [hasLoadedStatus, setHasLoadedStatus] = useState(false);
  const [verificationDismissed, setVerificationDismissed] = useState(false);

  const lastFetchAtRef = useRef(0);
  const hasLoadedStatusRef = useRef(false);

  const fetchInboundEmailConfig = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!enabled) {
        setInboundEmailAddress('');
        setInboundEmailStatus('');
        setInboundEmailVerificationUrl('');
        setHasLoadedStatus(false);
        hasLoadedStatusRef.current = false;
        return;
      }

      if (!silent && !hasLoadedStatusRef.current) {
        setIsInitialLoading(true);
      }

      try {
        const { data, error } = await supabase.rpc('ensure_inbound_email');
        if (error) {
          console.error('Failed to ensure inbound email:', error);
          return;
        }

        const config = Array.isArray(data) ? data[0] : data;
        if (config?.inbound_email_address) {
          setInboundEmailAddress(config.inbound_email_address);
        }
        if (config?.inbound_email_status) {
          setInboundEmailStatus(config.inbound_email_status);
        }

        if (userId) {
          const { data: events } = await supabase
            .from('email_inbound_events')
            .select('parsed_data, event_type, created_at')
            .eq('merchant_id', userId)
            .eq('event_type', 'forwarding_verification')
            .order('created_at', { ascending: false })
            .limit(1);

          const latest = events?.[0];
          const verificationUrl =
            (latest?.parsed_data as { verification_url?: string } | null)?.verification_url || '';
          setInboundEmailVerificationUrl(verificationUrl);
        }

        setHasLoadedStatus(true);
        hasLoadedStatusRef.current = true;
      } finally {
        lastFetchAtRef.current = Date.now();
        setIsInitialLoading(false);
      }
    },
    [enabled, userId]
  );

  const refetchIfStale = useCallback(() => {
    if (!enabled) return;
    if (Date.now() - lastFetchAtRef.current < FOCUS_REFETCH_STALE_MS) return;
    void fetchInboundEmailConfig({ silent: true });
  }, [enabled, fetchInboundEmailConfig]);

  useEffect(() => {
    setVerificationDismissed(false);
    setHasLoadedStatus(false);
    hasLoadedStatusRef.current = false;
    void fetchInboundEmailConfig();
  }, [fetchInboundEmailConfig]);

  useEffect(() => {
    setVerificationDismissed(false);
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase
      .channel(`inbound-email-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          void fetchInboundEmailConfig({ silent: true });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_inbound_events',
          filter: `merchant_id=eq.${userId}`,
        },
        () => {
          void fetchInboundEmailConfig({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId, fetchInboundEmailConfig]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetchIfStale();
      }
    };

    const handleFocus = () => {
      refetchIfStale();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, refetchIfStale]);

  const openForwardingVerification = useCallback(() => {
    if (!inboundEmailVerificationUrl) return;

    openVerificationPopup(inboundEmailVerificationUrl, {
      onComplete: () => {
        setVerificationDismissed(true);
        toast({ title: INBOUND_EMAIL_SYNC_SETUP_TOAST.title });
        void fetchInboundEmailConfig({ silent: true });
      },
      onPopupBlocked: () => {
        toast({
          title: INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.title,
          description: INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.description,
        });
      },
    });
  }, [inboundEmailVerificationUrl, openVerificationPopup, toast, fetchInboundEmailConfig]);

  const showVerifyButton = shouldShowInboundEmailVerifyButton({
    verificationUrl: inboundEmailVerificationUrl,
    status: inboundEmailStatus,
    verificationDismissed,
  });

  return {
    inboundEmailAddress,
    inboundEmailStatus,
    inboundEmailVerificationUrl,
    isLoading: isInitialLoading,
    hasLoadedStatus,
    showVerifyButton,
    isOpeningVerification,
    openForwardingVerification,
    refetch: () => fetchInboundEmailConfig({ silent: true }),
  };
}
