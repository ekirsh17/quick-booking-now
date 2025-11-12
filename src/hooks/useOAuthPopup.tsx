import { useState, useCallback, useEffect } from 'react';

interface OAuthMessage {
  type: string;
  success: boolean;
  error?: string;
}

export const useOAuthPopup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);

  const openOAuthPopup = useCallback((
    url: string,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    setIsLoading(true);

    // Calculate centered position
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popupWindow = window.open(
      url,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popupWindow) {
      setIsLoading(false);
      onError('Popup blocked. Please allow popups for this site and try again.');
      return;
    }

    setPopup(popupWindow);

    // Set up message listener
    const messageHandler = (event: MessageEvent<OAuthMessage>) => {
      // Validate origin for security
      const allowedOrigins = [
        window.location.origin,
        import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, ''), // Remove trailing slash
      ].filter(Boolean);
      
      console.log('Received postMessage:', {
        origin: event.origin,
        data: event.data,
        allowedOrigins
      });

      const isAllowed = allowedOrigins.some(origin => 
        event.origin === origin || event.origin.startsWith(origin + '/')
      );
      
      console.log('Origin check:', { isAllowed, eventOrigin: event.origin });

      if (!isAllowed) {
        console.warn('Message from unauthorized origin:', event.origin);
        return;
      }

      if (event.data?.type === 'google-calendar-oauth') {
        console.log('Processing OAuth message:', event.data);
        cleanup();
        
        if (event.data.success) {
          onSuccess();
        } else {
          onError(event.data.error || 'OAuth failed');
        }
      }
    };

    window.addEventListener('message', messageHandler);

    // Set up polling to detect popup close
    const pollTimer = setInterval(() => {
      if (popupWindow.closed) {
        cleanup();
        onError('OAuth cancelled');
      }
    }, 500);

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      cleanup();
      onError('OAuth timed out');
    }, 5 * 60 * 1000);

    const cleanup = () => {
      window.removeEventListener('message', messageHandler);
      clearInterval(pollTimer);
      clearTimeout(timeout);
      setIsLoading(false);
      setPopup(null);
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
    };

    return cleanup;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (popup && !popup.closed) {
        popup.close();
      }
    };
  }, [popup]);

  return { openOAuthPopup, isLoading };
};
