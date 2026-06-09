import { cn } from '@/lib/utils';

/**
 * Shared coach panel width for tour tooltips and setup checklist.
 * Must stay as static Tailwind strings (no template literals) so JIT emits the rules.
 */
export const FLOATING_COACH_PANEL_WIDTH_CLASS =
  'w-[min(calc(100vw_-_2rem),21.5rem)] min-w-[11.25rem] max-w-[21.5rem]';

/**
 * Shared anchor for tour coachmarks and setup checklist:
 * - Mobile: bottom-left above nav (`left-4`, `bottom-[88px]`)
 * - Desktop (lg+): bottom-right (`lg:right-8`, `lg:bottom-8`)
 */
const FLOATING_ANCHOR_BASE =
  'fixed bottom-[88px] left-4 right-auto translate-x-0 lg:bottom-8 lg:right-8 lg:left-auto';

export function getFloatingCoachPanelClasses(): string {
  return cn(FLOATING_ANCHOR_BASE, 'z-[45]', FLOATING_COACH_PANEL_WIDTH_CLASS);
}
