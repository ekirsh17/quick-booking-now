import { useCallback, useEffect, useRef, useState } from 'react';

type OpenVerificationPopupOptions = {
  onComplete: () => void;
  onPopupBlocked?: () => void;
};

export function useExternalVerificationPopup() {
  const [isOpening, setIsOpening] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const openVerificationPopup = useCallback((
    url: string,
    { onComplete, onPopupBlocked }: OpenVerificationPopupOptions,
  ) => {
    cleanupRef.current?.();

    setIsOpening(true);

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popupWindow = window.open(
      url,
      'email_forwarding_verification',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    if (!popupWindow) {
      setIsOpening(false);
      window.open(url, '_blank', 'noopener,noreferrer');
      onPopupBlocked?.();
      return;
    }

    popupRef.current = popupWindow;

    const pollTimer = window.setInterval(() => {
      if (popupWindow.closed) {
        cleanup();
        onComplete();
      }
    }, 500);

    const timeout = window.setTimeout(() => {
      cleanup();
      onComplete();
    }, 5 * 60 * 1000);

    const cleanup = () => {
      window.clearInterval(pollTimer);
      window.clearTimeout(timeout);
      setIsOpening(false);
      popupRef.current = null;
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  return { openVerificationPopup, isOpeningVerification: isOpening };
}
