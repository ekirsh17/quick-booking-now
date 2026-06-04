import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SETUP_FOCUS_NONCE_PARAM,
  SETUP_SECTION_FOCUS_EVENT,
  SETUP_SECTION_PARAM,
} from '@/lib/setupChecklistNavigation';

const PENDING_SETUP_SECTION_KEY = 'oa_pending_setup_section';

interface UseSetupSectionFocusOptions {
  /** Extra wait before scroll (e.g. after expanding a collapsible section). */
  scrollDelayMs?: number;
}

export function stashPendingSetupSectionFocus(sectionId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_SETUP_SECTION_KEY, sectionId);
}

export function clearPendingSetupSectionFocus(sectionId: string) {
  if (typeof window === 'undefined') return;
  if (window.sessionStorage.getItem(PENDING_SETUP_SECTION_KEY) === sectionId) {
    window.sessionStorage.removeItem(PENDING_SETUP_SECTION_KEY);
  }
}

function readPendingSetupSectionFocus(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PENDING_SETUP_SECTION_KEY);
}

function isSetupFocusTargetVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;

  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function findShareQrSetupTarget(): HTMLElement | null {
  const scope = window.matchMedia('(min-width: 1024px)').matches ? 'full' : 'qr';
  const target = document.querySelector<HTMLElement>(
    `[data-setup-section="share-qr"][data-setup-share-qr-scope="${scope}"]`
  );
  if (target && isSetupFocusTargetVisible(target)) return target;
  return null;
}

function findSetupSectionTarget(sectionId: string): HTMLElement | null {
  if (sectionId === 'share-qr') {
    const shareQrTarget = findShareQrSetupTarget();
    if (shareQrTarget) return shareQrTarget;
  }

  const matches = document.querySelectorAll<HTMLElement>(`[data-setup-section="${sectionId}"]`);
  for (const element of matches) {
    if (isSetupFocusTargetVisible(element)) return element;
  }
  return matches[0] ?? null;
}

function getSetupSectionScrollBlock(sectionId: string): ScrollLogicalPosition {
  return sectionId === 'create-opening' ? 'center' : 'start';
}

function focusSetupSectionTarget(
  sectionId: string,
  scrollDelayMs: number,
  onBeforeScroll?: (sectionId: string) => void,
  onFocused?: () => void
) {
  onBeforeScroll?.(sectionId);

  const tryFocus = (attempt: number) => {
    const target = findSetupSectionTarget(sectionId);
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: getSetupSectionScrollBlock(sectionId),
        inline: 'nearest',
      });
      target.classList.add('setup-section-highlight');
      clearPendingSetupSectionFocus(sectionId);
      onFocused?.();

      window.setTimeout(() => {
        target.classList.remove('setup-section-highlight');
      }, 2800);
      return;
    }

    if (attempt < 48) {
      window.setTimeout(() => tryFocus(attempt + 1), 80);
    }
  };

  window.setTimeout(() => tryFocus(0), scrollDelayMs);
}

export function scrollToSetupSection(sectionId: string, scrollDelayMs = 350) {
  focusSetupSectionTarget(sectionId, scrollDelayMs);
}

export function useSetupSectionFocus(
  onSectionFocus?: (sectionId: string) => void,
  options: UseSetupSectionFocusOptions = {}
) {
  const { scrollDelayMs = 350 } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRef = useRef<string | null>(null);
  const onSectionFocusRef = useRef(onSectionFocus);

  onSectionFocusRef.current = onSectionFocus;

  useEffect(() => {
    const handleCustomFocus = (event: Event) => {
      const sectionId = (event as CustomEvent<{ sectionId: string }>).detail?.sectionId;
      if (!sectionId) return;

      const focusKey = `${sectionId}:event:${Date.now()}`;
      if (handledRef.current === focusKey) return;
      handledRef.current = focusKey;

      focusSetupSectionTarget(sectionId, scrollDelayMs, onSectionFocusRef.current);
    };

    window.addEventListener(SETUP_SECTION_FOCUS_EVENT, handleCustomFocus);
    return () => window.removeEventListener(SETUP_SECTION_FOCUS_EVENT, handleCustomFocus);
  }, [scrollDelayMs]);

  useEffect(() => {
    const sectionId = searchParams.get(SETUP_SECTION_PARAM) ?? readPendingSetupSectionFocus();
    const focusNonce = searchParams.get(SETUP_FOCUS_NONCE_PARAM);

    if (!sectionId) {
      handledRef.current = null;
      return;
    }

    const focusKey = `${sectionId}:${focusNonce ?? 'pending'}`;
    if (handledRef.current === focusKey) return;

    handledRef.current = focusKey;

    const clearUrlParams = () => {
      if (!searchParams.get(SETUP_SECTION_PARAM) && !searchParams.get(SETUP_FOCUS_NONCE_PARAM)) {
        return;
      }

      const next = new URLSearchParams(searchParams);
      next.delete(SETUP_SECTION_PARAM);
      next.delete(SETUP_FOCUS_NONCE_PARAM);
      setSearchParams(next, { replace: true });
    };

    focusSetupSectionTarget(
      sectionId,
      scrollDelayMs,
      onSectionFocusRef.current,
      clearUrlParams
    );
  }, [scrollDelayMs, searchParams, setSearchParams]);
}
