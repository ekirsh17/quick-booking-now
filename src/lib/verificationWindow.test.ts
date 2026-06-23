import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  VERIFICATION_WINDOW_NAME,
  buildVerificationPopupFeatures,
  focusVerificationWindow,
  isVerificationWindowClosed,
  isVerificationWindowReachable,
  openVerificationWindow,
  shouldCompleteVerificationOnParentReturn,
  watchVerificationWindowClose,
} from './verificationWindow';

describe('verificationWindow', () => {
  it('builds sized popup feature string', () => {
    const features = buildVerificationPopupFeatures({ width: 1200, height: 800 });
    expect(features).toContain('width=600');
    expect(features).toContain('height=700');
    expect(features).toContain('left=300');
    expect(features).toContain('top=50');
  });

  it('opens exactly one named window', () => {
    const openFn = vi.fn(() => ({ closed: false, focus: vi.fn() }) as unknown as Window);
    const popup = openVerificationWindow('https://mail.google.com/vf', openFn);

    expect(openFn).toHaveBeenCalledTimes(1);
    expect(openFn).toHaveBeenCalledWith(
      'https://mail.google.com/vf',
      VERIFICATION_WINDOW_NAME,
      expect.stringContaining('width=600'),
    );
    expect(popup).toBeTruthy();
  });

  it('does not retry when the first open returns null', () => {
    const openFn = vi.fn(() => null);
    const popup = openVerificationWindow('https://mail.google.com/vf', openFn);

    expect(openFn).toHaveBeenCalledTimes(1);
    expect(popup).toBeNull();
  });

  it('treats a closed window as closed', () => {
    expect(isVerificationWindowClosed({ closed: true } as Window)).toBe(true);
    expect(isVerificationWindowClosed({ closed: false } as Window)).toBe(false);
    expect(isVerificationWindowClosed(null)).toBe(true);
  });

  it('treats cross-origin closed access errors as still open during polling', () => {
    const popup = {
      get closed() {
        throw new DOMException('Blocked a frame with origin', 'SecurityError');
      },
    } as Window;

    expect(isVerificationWindowClosed(popup)).toBe(false);
    expect(isVerificationWindowReachable(popup)).toBe(false);
    expect(shouldCompleteVerificationOnParentReturn(popup)).toBe(true);
  });

  it('treats a closed verification window as unreachable', () => {
    const popup = { closed: true, focus: vi.fn() } as unknown as Window;
    expect(isVerificationWindowReachable(popup)).toBe(false);
    expect(shouldCompleteVerificationOnParentReturn(popup)).toBe(true);
  });

  it('treats a live verification window as reachable', () => {
    const focus = vi.fn();
    const popup = { closed: false, focus } as unknown as Window;
    expect(isVerificationWindowReachable(popup)).toBe(true);
    expect(shouldCompleteVerificationOnParentReturn(popup)).toBe(false);
    expect(focus).toHaveBeenCalled();
  });

  it('ignores focus errors on cross-origin windows', () => {
    const popup = {
      focus: () => {
        throw new DOMException('Blocked a frame with origin', 'SecurityError');
      },
    } as unknown as Window;

    expect(() => focusVerificationWindow(popup)).not.toThrow();
  });
});

describe('watchVerificationWindowClose', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('completes when the popup closes during polling', () => {
    vi.useFakeTimers();
    const popup = { closed: false } as Window;
    const onComplete = vi.fn();
    const intervals: Array<() => void> = [];

    watchVerificationWindowClose(popup, onComplete, {
      pollMs: 100,
      timeoutMs: 10_000,
      setIntervalFn: (fn) => {
        intervals.push(fn as () => void);
        return intervals.length;
      },
      clearIntervalFn: vi.fn(),
      setTimeoutFn: vi.fn(() => 0),
      clearTimeoutFn: vi.fn(),
    });

    popup.closed = true;
    intervals[0]();

    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('completes when the parent regains focus and the popup is closed', () => {
    const popup = { closed: true, focus: vi.fn() } as unknown as Window;
    const onComplete = vi.fn();
    let focusHandler: (() => void) | undefined;

    vi.mocked(window.addEventListener).mockImplementation((type: string, listener: EventListener) => {
      if (type === 'focus') focusHandler = listener as () => void;
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    watchVerificationWindowClose(popup, onComplete, {
      setIntervalFn: vi.fn(() => 0),
      clearIntervalFn: vi.fn(),
      setTimeoutFn: vi.fn(() => 0),
      clearTimeoutFn: vi.fn(),
    });

    focusHandler?.();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
