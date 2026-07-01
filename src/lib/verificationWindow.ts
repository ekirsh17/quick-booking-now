export const VERIFICATION_WINDOW_NAME = 'email_forwarding_verification';

let activeVerificationWindow: Window | null = null;

export function getActiveVerificationWindow(): Window | null {
  return activeVerificationWindow;
}

export function clearActiveVerificationWindow(): void {
  activeVerificationWindow = null;
}

export function buildVerificationPopupFeatures(
  screenSize: { width: number; height: number } = {
    width: typeof globalThis.window !== 'undefined' ? globalThis.window.screen.width : 1200,
    height: typeof globalThis.window !== 'undefined' ? globalThis.window.screen.height : 800,
  },
): string {
  const width = 600;
  const height = 700;
  const left = screenSize.width / 2 - width / 2;
  const top = screenSize.height / 2 - height / 2;
  return `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`;
}

/**
 * Opens the provider verification UI in a single named window.
 * We intentionally call window.open only once — a second call when the sized
 * popup is "blocked" often opens a duplicate tab because the first attempt may
 * still create a tab while returning null.
 */
export function openVerificationWindow(
  url: string,
  openFn: Window['open'] = window.open.bind(window),
): Window | null {
  const popup = openFn(url, VERIFICATION_WINDOW_NAME, buildVerificationPopupFeatures());
  activeVerificationWindow = popup;
  return popup;
}

/**
 * Returns whether the verification window is closed.
 * When cross-origin access throws, returns false so polling continues.
 */
export function isVerificationWindowClosed(popup: Window | null): boolean {
  if (!popup) return true;

  try {
    return popup.closed;
  } catch {
    return false;
  }
}

/**
 * Returns true when the verification window still exists and can be focused.
 * Gmail/Outlook often sever opener access without setting closed=true, so we
 * probe with focus() when the user returns to OpenAlert.
 */
export function isVerificationWindowReachable(popup: Window | null): boolean {
  if (!popup) return false;

  try {
    if (popup.closed) return false;
    popup.focus();
    return true;
  } catch {
    return false;
  }
}

/**
 * Used when the user returns to OpenAlert after starting verification.
 */
export function shouldCompleteVerificationOnParentReturn(popup: Window | null): boolean {
  if (!popup) return true;
  return !isVerificationWindowReachable(popup);
}

export function focusVerificationWindow(popup: Window | null): void {
  if (!popup) return;

  try {
    popup.focus();
  } catch {
    // Cross-origin focus may fail; the window is still open.
  }
}

export function watchVerificationWindowClose(
  popup: Window,
  onComplete: () => void,
  options?: {
    pollMs?: number;
    timeoutMs?: number;
    setIntervalFn?: typeof window.setInterval;
    clearIntervalFn?: typeof window.clearInterval;
    setTimeoutFn?: typeof window.setTimeout;
    clearTimeoutFn?: typeof window.clearTimeout;
    onParentReturn?: () => void;
  },
): () => void {
  const pollMs = options?.pollMs ?? 500;
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000;
  const setIntervalFn = options?.setIntervalFn ?? window.setInterval.bind(window);
  const clearIntervalFn = options?.clearIntervalFn ?? window.clearInterval.bind(window);
  const setTimeoutFn = options?.setTimeoutFn ?? window.setTimeout.bind(window);
  const clearTimeoutFn = options?.clearTimeoutFn ?? window.clearTimeout.bind(window);

  let completed = false;

  const finish = () => {
    if (completed) return;
    completed = true;
    cleanup();
    clearActiveVerificationWindow();
    onComplete();
  };

  const pollTimer = setIntervalFn(() => {
    if (isVerificationWindowClosed(popup)) {
      finish();
    }
  }, pollMs);

  const timeout = setTimeoutFn(finish, timeoutMs);

  const handleParentReturn = () => {
    if (document.visibilityState !== 'visible') return;
    options?.onParentReturn?.();
    if (shouldCompleteVerificationOnParentReturn(popup)) {
      finish();
    }
  };

  window.addEventListener('focus', handleParentReturn);
  document.addEventListener('visibilitychange', handleParentReturn);

  const cleanup = () => {
    clearIntervalFn(pollTimer);
    clearTimeoutFn(timeout);
    window.removeEventListener('focus', handleParentReturn);
    document.removeEventListener('visibilitychange', handleParentReturn);
  };

  return cleanup;
}
