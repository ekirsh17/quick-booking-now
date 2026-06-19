import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useExternalVerificationPopup } from '@/hooks/useExternalVerificationPopup';
import {
  INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST,
  INBOUND_EMAIL_SYNC_SETUP_TOAST,
  shouldShowInboundEmailVerifyButton,
} from '@/lib/inboundEmailSync';

const POLL_FAST_MS = 5_000;
const POLL_FAST_DURATION_MS = 3 * 60 * 1000;
const POLL_SLOW_MS = 30_000;
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
  const [isLoading, setIsLoading] = useState(false);
  const [verificationDismissed, setVerificationDismissed] = useState(false);

  const lastFetchAtRef = useRef(0);
  const inboundEmailStatusRef = useRef(inboundEmailStatus);

  inboundEmailStatusRef.current = inboundEmailStatus;

  const fetchInboundEmailConfig = useCallback(async () => {
    if (!enabled) {
      setInboundEmailAddress('');
      setInboundEmailStatus('');
      setInboundEmailVerificationUrl('');
      return;
    }

    setIsLoading(true);

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
    } finally {
      lastFetchAtRef.current = Date.now();
      setIsLoading(false);
    }
  }, [enabled, userId]);

  const refetchIfStale = useCallback(() => {
    if (!enabled) return;
    if (Date.now() - lastFetchAtRef.current < FOCUS_REFETCH_STALE_MS) return;
    void fetchInboundEmailConfig();
  }, [enabled, fetchInboundEmailConfig]);

  useEffect(() => {
    setVerificationDismissed(false);
    void fetchInboundEmailConfig();
  }, [fetchInboundEmailConfig]);

  useEffect(() => {
    setVerificationDismissed(false);
  }, [userId]);

  useEffect(() => {
    if (!enabled || inboundEmailStatus === 'active') return;

    const poll = () => {
      if (inboundEmailStatusRef.current === 'active') return;
      void fetchInboundEmailConfig();
    };

    let slowIntervalId: ReturnType<typeof setInterval> | null = null;

    const fastIntervalId = window.setInterval(poll, POLL_FAST_MS);

    const slowSwitchTimeoutId = window.setTimeout(() => {
      window.clearInterval(fastIntervalId);
      slowIntervalId = window.setInterval(poll, POLL_SLOW_MS);
    }, POLL_FAST_DURATION_MS);

    return () => {
      window.clearInterval(fastIntervalId);
      window.clearTimeout(slowSwitchTimeoutId);
      if (slowIntervalId) window.clearInterval(slowIntervalId);
    };
  }, [enabled, inboundEmailStatus, fetchInboundEmailConfig]);

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
        void fetchInboundEmailConfig();
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
    isLoading,
    showVerifyButton,
    isOpeningVerification,
    openForwardingVerification,
    refetch: fetchInboundEmailConfig,
  };
}
