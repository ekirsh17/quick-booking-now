import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Matches `left-4` anchor on mobile. */
export const MOBILE_COACH_LEFT_INSET = '1rem';

/**
 * Space reserved on the right for bottom-right actions (Save on Settings, Add Opening FAB):
 * right gutter (1rem) + widest action (~7.5rem) + gap (0.75rem).
 */
export const MOBILE_COACH_RIGHT_RESERVE = '9.25rem';

/** Mobile max panel width (replaces 21.5rem below lg). */
export const MOBILE_COACH_PANEL_MAX = '17rem';

/** Left inset + right reserve — used in width calc on mobile. */
const MOBILE_COACH_HORIZONTAL_INSET = '10.25rem';

/**
 * Shared coach panel width for tour tooltips and setup checklist.
 * Must stay as static Tailwind strings (no template literals) so JIT emits the rules.
 */
export const FLOATING_COACH_PANEL_WIDTH_CLASS_MOBILE =
  'w-[min(calc(100vw_-_10.25rem),17rem)] min-w-[min(11.25rem,calc(100vw_-_10.25rem))] max-w-[17rem]';

export const FLOATING_COACH_PANEL_WIDTH_CLASS_DESKTOP =
  'lg:w-[min(calc(100vw_-_2rem),21.5rem)] lg:min-w-[11.25rem] lg:max-w-[21.5rem]';

export const FLOATING_COACH_PANEL_WIDTH_CLASS = cn(
  FLOATING_COACH_PANEL_WIDTH_CLASS_MOBILE,
  FLOATING_COACH_PANEL_WIDTH_CLASS_DESKTOP
);

const MOBILE_COACH_PANEL_WIDTH_STYLE: CSSProperties = {
  width: `min(calc(100vw - ${MOBILE_COACH_HORIZONTAL_INSET}), ${MOBILE_COACH_PANEL_MAX})`,
  minWidth: `min(11.25rem, calc(100vw - ${MOBILE_COACH_HORIZONTAL_INSET}))`,
  maxWidth: MOBILE_COACH_PANEL_MAX,
};

const DESKTOP_COACH_PANEL_WIDTH_STYLE: CSSProperties = {
  width: 'min(calc(100vw - 2rem), 21.5rem)',
  minWidth: '11.25rem',
  maxWidth: '21.5rem',
};

/** Inline width lock — Framer `motion.div` can ignore Tailwind width utilities. */
export function getFloatingCoachPanelWidthStyle(isMobile: boolean): CSSProperties {
  return isMobile ? MOBILE_COACH_PANEL_WIDTH_STYLE : DESKTOP_COACH_PANEL_WIDTH_STYLE;
}

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
