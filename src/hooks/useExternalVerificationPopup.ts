import { useCallback, useEffect, useRef, useState } from 'react';
import {
  focusVerificationWindow,
  isVerificationWindowClosed,
  openVerificationWindow,
  watchVerificationWindowClose,
} from '@/lib/verificationWindow';

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

    const existingPopup = popupRef.current;
    if (existingPopup && !isVerificationWindowClosed(existingPopup)) {
      focusVerificationWindow(existingPopup);
      setIsOpening(true);
      return;
    }

    setIsOpening(true);

    const popupWindow = openVerificationWindow(url);

    if (!popupWindow) {
      setIsOpening(false);
      onPopupBlocked?.();
      return;
    }

    focusVerificationWindow(popupWindow);
    popupRef.current = popupWindow;

    const cleanup = watchVerificationWindowClose(popupWindow, () => {
      setIsOpening(false);
      popupRef.current = null;
      cleanupRef.current = null;
      onComplete();
    });

    cleanupRef.current = () => {
      cleanup();
      setIsOpening(false);
      popupRef.current = null;
      cleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return { openVerificationPopup, isOpeningVerification: isOpening };
}
