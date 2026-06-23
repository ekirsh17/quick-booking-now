import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useExternalVerificationPopup } from '@/hooks/useExternalVerificationPopup';
import {
  INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST,
  INBOUND_EMAIL_SYNC_SETUP_TOAST,
  shouldShowInboundEmailVerifyButton,
} from '@/lib/inboundEmailSync';
import {
  clearVerificationFlowPending,
  reconcileVerificationAckForUrl,
  readVerificationFlowPending,
  resolveVerificationDismissedState,
  writeVerificationAck,
  writeVerificationFlowPending,
} from '@/lib/inboundEmailVerificationAck';
import {
  getActiveVerificationWindow,
  shouldCompleteVerificationOnParentReturn,
} from '@/lib/verificationWindow';

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
  const verificationFlowStartedRef = useRef(false);
  const inboundEmailStatusRef = useRef(inboundEmailStatus);
  const verificationDismissedRef = useRef(verificationDismissed);
  const inboundEmailVerificationUrlRef = useRef(inboundEmailVerificationUrl);
  const verificationCompletionHandledRef = useRef(false);

  useEffect(() => {
    inboundEmailStatusRef.current = inboundEmailStatus;
  }, [inboundEmailStatus]);

  useEffect(() => {
    verificationDismissedRef.current = verificationDismissed;
  }, [verificationDismissed]);

  useEffect(() => {
    inboundEmailVerificationUrlRef.current = inboundEmailVerificationUrl;
  }, [inboundEmailVerificationUrl]);

  const applyVerificationAckState = useCallback(
    (verificationUrl: string) => {
      reconcileVerificationAckForUrl(userId, verificationUrl);
      setVerificationDismissed(
        resolveVerificationDismissedState({ userId, verificationUrl }),
      );
    },
    [userId],
  );

  const acknowledgeForwardingVerification = useCallback(
    (verificationUrl: string) => {
      if (verificationCompletionHandledRef.current) return;
      verificationCompletionHandledRef.current = true;

      if (userId && verificationUrl) {
        writeVerificationAck(userId, verificationUrl);
        clearVerificationFlowPending(userId);
      }
      setVerificationDismissed(true);
      verificationFlowStartedRef.current = false;
    },
    [userId],
  );

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
          if (config.inbound_email_status === 'active') {
            verificationFlowStartedRef.current = false;
          }
        }

        let verificationUrl = '';
        if (userId) {
          const { data: events } = await supabase
            .from('email_inbound_events')
            .select('parsed_data, event_type, created_at')
            .eq('merchant_id', userId)
            .eq('event_type', 'forwarding_verification')
            .order('created_at', { ascending: false })
            .limit(1);

          const latest = events?.[0];
          verificationUrl =
            (latest?.parsed_data as { verification_url?: string } | null)?.verification_url || '';
          setInboundEmailVerificationUrl(verificationUrl);
          applyVerificationAckState(verificationUrl);
        } else {
          setInboundEmailVerificationUrl('');
          setVerificationDismissed(false);
        }

        setHasLoadedStatus(true);
        hasLoadedStatusRef.current = true;
      } finally {
        lastFetchAtRef.current = Date.now();
        setIsInitialLoading(false);
      }
    },
    [enabled, userId, applyVerificationAckState],
  );

  const completeForwardingVerification = useCallback(
    (verificationUrl: string) => {
      if (!verificationUrl || verificationDismissedRef.current) return;
      if (verificationCompletionHandledRef.current) return;

      acknowledgeForwardingVerification(verificationUrl);
      toast({ title: INBOUND_EMAIL_SYNC_SETUP_TOAST.title });
      void fetchInboundEmailConfig({ silent: true });
    },
    [acknowledgeForwardingVerification, toast, fetchInboundEmailConfig],
  );

  const tryCompleteVerificationOnReturn = useCallback(() => {
    if (document.visibilityState !== 'visible') return;

    const currentUrl = inboundEmailVerificationUrlRef.current;
    const pendingUrl = readVerificationFlowPending(userId);

    if (!verificationFlowStartedRef.current) {
      if (!pendingUrl || pendingUrl !== currentUrl) return;
      verificationFlowStartedRef.current = true;
    }

    if (!shouldCompleteVerificationOnParentReturn(getActiveVerificationWindow())) return;
    if (!currentUrl) return;

    completeForwardingVerification(currentUrl);
  }, [userId, completeForwardingVerification]);

  const refetchIfStale = useCallback(() => {
    if (!enabled) return;

    const awaitingFirstEmailAfterVerify =
      verificationDismissedRef.current &&
      inboundEmailStatusRef.current === 'verification_received';
    const bypassStaleGuard =
      verificationFlowStartedRef.current || awaitingFirstEmailAfterVerify;

    if (!bypassStaleGuard && Date.now() - lastFetchAtRef.current < FOCUS_REFETCH_STALE_MS) {
      return;
    }

    void fetchInboundEmailConfig({ silent: true });
  }, [enabled, fetchInboundEmailConfig]);

  useEffect(() => {
    setHasLoadedStatus(false);
    hasLoadedStatusRef.current = false;
    void fetchInboundEmailConfig();
  }, [fetchInboundEmailConfig]);

  useEffect(() => {
    verificationFlowStartedRef.current = !!readVerificationFlowPending(userId);
    verificationCompletionHandledRef.current = false;
    setVerificationDismissed(
      resolveVerificationDismissedState({
        userId,
        verificationUrl: inboundEmailVerificationUrlRef.current,
      }),
    );
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
        },
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
        },
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
        tryCompleteVerificationOnReturn();
        refetchIfStale();
      }
    };

    const handleFocus = () => {
      tryCompleteVerificationOnReturn();
      refetchIfStale();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, refetchIfStale, tryCompleteVerificationOnReturn]);

  const openForwardingVerification = useCallback(() => {
    if (!inboundEmailVerificationUrl) return;

    verificationCompletionHandledRef.current = false;
    verificationFlowStartedRef.current = true;
    if (userId) {
      writeVerificationFlowPending(userId, inboundEmailVerificationUrl);
    }

    openVerificationPopup(inboundEmailVerificationUrl, {
      onComplete: () => {
        completeForwardingVerification(inboundEmailVerificationUrl);
      },
      onPopupBlocked: () => {
        toast({
          title: INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.title,
          description: INBOUND_EMAIL_SYNC_POPUP_BLOCKED_TOAST.description,
        });
      },
    });
  }, [
    inboundEmailVerificationUrl,
    openVerificationPopup,
    toast,
    userId,
    completeForwardingVerification,
  ]);

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
    verificationAcknowledged: verificationDismissed,
    isOpeningVerification,
    openForwardingVerification,
    refetch: () => fetchInboundEmailConfig({ silent: true }),
  };
}
