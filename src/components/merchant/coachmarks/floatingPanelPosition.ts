import { cn } from '@/lib/utils';

/** Room for setup checklist chip beside the coach card on mobile. */
export const FLOATING_COACH_CHECKLIST_CLEARANCE_PX = 108;

export const FLOATING_COACH_PANEL_WIDTH_CLASS =
  'w-[min(calc(100vw_-_2rem_-_var(--setup-checklist-right-clearance,0px)),21.5rem)] min-w-[11.25rem] max-w-[21.5rem]';

/** Tour coach card: full mobile width (checklist hidden during tour; no FAB clearance). */
export const FLOATING_COACH_TOUR_PANEL_WIDTH_CLASS =
  'w-[min(calc(100vw_-_2rem),21.5rem)] min-w-[11.25rem] max-w-[21.5rem]';

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

export function getFloatingCoachClasses(variant: 'panel' | 'tour-panel' | 'chip'): string {
  if (variant === 'chip') {
    return cn(
      FLOATING_ANCHOR_BASE,
      'z-40 min-h-11 min-w-11 touch-manipulation'
    );
  }

  const widthClass =
    variant === 'tour-panel' ? FLOATING_COACH_TOUR_PANEL_WIDTH_CLASS : FLOATING_COACH_PANEL_WIDTH_CLASS;

  return cn(FLOATING_ANCHOR_BASE, 'z-[45]', widthClass);
}
