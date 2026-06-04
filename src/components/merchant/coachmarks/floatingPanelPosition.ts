import { cn } from '@/lib/utils';

/** Room for setup checklist chip beside the coach card on mobile. */
export const FLOATING_COACH_CHECKLIST_CLEARANCE_PX = 108;
/** Collapsed openings FAB (48px) + `right-3` inset + gap before coach card. */
export const FLOATING_COACH_COMPACT_FAB_CLEARANCE_PX = 72;

export const FLOATING_COACH_PANEL_WIDTH_CLASS =
  'w-[min(calc(100vw_-_2rem_-_var(--setup-checklist-right-clearance,0px)),21.5rem)] min-w-[11.25rem] max-w-[21.5rem]';

/**
 * Shared anchor for tour coachmarks and setup checklist:
 * - Mobile: bottom-left above nav (`left-4`, `bottom-[88px]`)
 * - Desktop (lg+): bottom-right (`lg:right-8`, `lg:bottom-8`)
 */
const FLOATING_ANCHOR_BASE =
  'fixed bottom-[88px] left-4 right-auto translate-x-0 lg:bottom-8 lg:right-8 lg:left-auto';

export function getFloatingCoachAnchorClasses(): string {
  return FLOATING_ANCHOR_BASE;
}

export function getFloatingCoachClasses(variant: 'panel' | 'chip'): string {
  if (variant === 'chip') {
    return cn(
      FLOATING_ANCHOR_BASE,
      'z-40 min-h-11 min-w-11 touch-manipulation'
    );
  }

  return cn(FLOATING_ANCHOR_BASE, 'z-[45]', FLOATING_COACH_PANEL_WIDTH_CLASS);
}
