import { cn } from '@/lib/utils';

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

  return cn(
    FLOATING_ANCHOR_BASE,
    'z-[45] w-[min(calc(100vw_-_2rem_-_var(--setup-checklist-right-clearance,108px)),21.5rem)] min-w-[11.25rem] max-w-[21.5rem]'
  );
}
