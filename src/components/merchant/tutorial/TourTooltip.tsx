import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { subtleAccentOutlineHover } from '@/lib/interactiveHover';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTourContext } from '@/contexts/TourContext';

const TOOLTIP_WIDTH = 300;
const STEP_REPOSITION_DELAY_MS = 500;
const MAX_TARGET_RETRIES = 20;
const MOBILE_BOTTOM_NAV_PX = 64;
const MOBILE_FAB_BOTTOM_PX = 80;
const MOBILE_FAB_HEIGHT_PX = 48;
const MOBILE_EDGE_PADDING = 12;
const POSITION_PADDING = 12;
const OVERLAP_GAP = 8;

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface ViewportChromeInsets {
  top: number;
  bottom: number;
}

interface TourPlacement {
  side: TooltipSide;
  top: number;
  left: number;
  width: number;
}

function getTooltipWidth(viewportWidth: number, isMobile: boolean): number {
  if (!isMobile) return TOOLTIP_WIDTH;
  return Math.min(TOOLTIP_WIDTH, Math.max(240, viewportWidth - MOBILE_EDGE_PADDING * 2));
}

function getViewportChromeInsets(isMobile: boolean): ViewportChromeInsets {
  if (!isMobile) {
    return { top: MOBILE_EDGE_PADDING, bottom: MOBILE_EDGE_PADDING };
  }

  return {
    top: MOBILE_EDGE_PADDING,
    bottom: MOBILE_BOTTOM_NAV_PX + MOBILE_FAB_BOTTOM_PX + MOBILE_FAB_HEIGHT_PX + 16,
  };
}

function computeTooltipPosition(
  rect: DOMRect,
  side: TooltipSide,
  tooltipWidth: number,
  tooltipHeight: number,
  padding = POSITION_PADDING
): { top: number; left: number } {
  let top = 0;
  let left = 0;

  if (side === 'bottom') {
    top = rect.bottom + padding;
    left = rect.left + rect.width / 2 - tooltipWidth / 2;
  } else if (side === 'top') {
    top = rect.top - tooltipHeight - padding;
    left = rect.left + rect.width / 2 - tooltipWidth / 2;
  } else if (side === 'left') {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.left - tooltipWidth - padding;
  } else if (side === 'right') {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.right + padding;
  }

  return { top, left };
}

function clampTooltipPosition(
  top: number,
  left: number,
  tooltipWidth: number,
  tooltipHeight: number,
  insets: ViewportChromeInsets
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    left: Math.max(MOBILE_EDGE_PADDING, Math.min(vw - tooltipWidth - MOBILE_EDGE_PADDING, left)),
    top: Math.max(insets.top, Math.min(vh - tooltipHeight - insets.bottom, top)),
  };
}

function rectsOverlap(
  tooltipTop: number,
  tooltipLeft: number,
  tooltipWidth: number,
  tooltipHeight: number,
  target: DOMRect,
  gap = OVERLAP_GAP
): boolean {
  const tooltipRight = tooltipLeft + tooltipWidth;
  const tooltipBottom = tooltipTop + tooltipHeight;

  return !(
    tooltipRight + gap < target.left ||
    tooltipLeft - gap > target.right ||
    tooltipBottom + gap < target.top ||
    tooltipTop - gap > target.bottom
  );
}

function getEffectiveSideForTour(
  rect: DOMRect,
  preferred: TooltipSide,
  tooltipHeight: number,
  tooltipWidth: number,
  insets: ViewportChromeInsets,
  targetAttr: string
): TooltipSide {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const targetMidY = rect.top + rect.height / 2;

  let side = preferred;

  if (targetAttr === 'new-opening-btn') {
    side = 'top';
  } else if (targetMidY > vh * 0.6 && preferred === 'bottom') {
    side = 'top';
  }

  if (side === 'bottom' && rect.bottom + tooltipHeight + POSITION_PADDING > vh - insets.bottom) {
    if (rect.top > tooltipHeight + insets.top + POSITION_PADDING) {
      side = 'top';
    }
  }
  if (side === 'top' && rect.top - tooltipHeight - POSITION_PADDING < insets.top) {
    if (vh - rect.bottom > tooltipHeight + insets.bottom + POSITION_PADDING) {
      side = 'bottom';
    }
  }
  if (side === 'left' && rect.left - tooltipWidth - POSITION_PADDING < MOBILE_EDGE_PADDING) {
    if (vw - rect.right > tooltipWidth + POSITION_PADDING) {
      side = 'right';
    }
  }
  if (side === 'right' && rect.right + tooltipWidth + POSITION_PADDING > vw - MOBILE_EDGE_PADDING) {
    if (rect.left > tooltipWidth + POSITION_PADDING) {
      side = 'left';
    }
  }

  return side;
}

function resolveTourPlacement(
  targetRect: DOMRect,
  preferred: TooltipSide,
  tooltipWidth: number,
  tooltipHeight: number,
  targetAttr: string,
  isMobile: boolean
): TourPlacement | null {
  const insets = getViewportChromeInsets(isMobile);
  const preferredSide = getEffectiveSideForTour(
    targetRect,
    preferred,
    tooltipHeight,
    tooltipWidth,
    insets,
    targetAttr
  );

  const sidesToTry: TooltipSide[] = [preferredSide, 'top', 'bottom', 'left', 'right'].filter(
    (side, index, arr) => arr.indexOf(side) === index
  );

  for (const side of sidesToTry) {
    const raw = computeTooltipPosition(targetRect, side, tooltipWidth, tooltipHeight);
    const { top, left } = clampTooltipPosition(raw.top, raw.left, tooltipWidth, tooltipHeight, insets);

    if (!rectsOverlap(top, left, tooltipWidth, tooltipHeight, targetRect)) {
      return { side, top, left, width: tooltipWidth };
    }
  }

  return null;
}

function getTopFallbackPlacement(tooltipWidth: number): TourPlacement {
  return {
    side: 'bottom',
    top: MOBILE_EDGE_PADDING,
    left: MOBILE_EDGE_PADDING,
    width: tooltipWidth,
  };
}

function getCaretEdge(tooltipSide: TooltipSide): TooltipSide {
  const map: Record<TooltipSide, TooltipSide> = {
    bottom: 'top',
    top: 'bottom',
    left: 'right',
    right: 'left',
  };
  return map[tooltipSide];
}

function getCaretOffset(
  side: TooltipSide,
  targetRect: DOMRect,
  position: { top: number; left: number },
  tooltipWidth: number,
  tooltipHeight: number
): number {
  if (side === 'top' || side === 'bottom') {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    return Math.max(16, Math.min(tooltipWidth - 16, targetCenterX - position.left));
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  return Math.max(16, Math.min(tooltipHeight - 16, targetCenterY - position.top));
}

function findVisibleTourTarget(attr: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour-target="${attr}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return node;
    }
  }
  return null;
}

function findTourTarget(primaryAttr: string, fallbackAttr?: string): HTMLElement | null {
  const primary = findVisibleTourTarget(primaryAttr);
  if (primary) return primary;
  if (fallbackAttr) return findVisibleTourTarget(fallbackAttr);
  return null;
}

function getScrollBlock(targetAttr: string): ScrollLogicalPosition {
  if (targetAttr === 'new-opening-btn') return 'nearest';
  return 'center';
}

function TourCaret({ side, alignOffset }: { side: TooltipSide; alignOffset: number }) {
  const base = 'absolute h-3 w-3 rotate-45 border-border bg-card';

  if (side === 'top') {
    return (
      <div
        className={cn(base, 'border-l border-t -top-1.5')}
        style={{ left: alignOffset, transform: 'translateX(-50%) rotate(45deg)' }}
      />
    );
  }
  if (side === 'bottom') {
    return (
      <div
        className={cn(base, 'border-r border-b -bottom-1.5')}
        style={{ left: alignOffset, transform: 'translateX(-50%) rotate(45deg)' }}
      />
    );
  }
  if (side === 'left') {
    return (
      <div
        className={cn(base, 'border-b border-l -left-1.5')}
        style={{ top: alignOffset, transform: 'translateY(-50%) rotate(45deg)' }}
      />
    );
  }
  return (
    <div
      className={cn(base, 'border-r border-t -right-1.5')}
      style={{ top: alignOffset, transform: 'translateY(-50%) rotate(45deg)' }}
    />
  );
}

function TourTooltipFooter({
  isFinalStep,
  finalCtaLabel,
  onBack,
  onNext,
  showBack,
}: {
  isFinalStep: boolean;
  finalCtaLabel?: string;
  onBack: () => void;
  onNext: () => void;
  showBack: boolean;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
      <div className="flex min-w-0 items-center">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('h-9 min-h-9', subtleAccentOutlineHover)}
            onClick={onBack}
          >
            Back
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
        {isFinalStep ? (
          <Button type="button" size="sm" className="h-9 min-h-9 max-w-[11rem]" onClick={onNext}>
            <span className="truncate">{finalCtaLabel}</span>
          </Button>
        ) : (
          <Button type="button" size="sm" className="h-9 min-h-9" onClick={onNext}>
            Next
            <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TourTooltip() {
  const { isActive, isLoading, currentStepIndex, steps, next, back, skip } = useTourContext();

  const isMobile = useIsMobile();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(TOOLTIP_WIDTH);
  const [effectiveSide, setEffectiveSide] = useState<TooltipSide>('bottom');
  const [caretOffset, setCaretOffset] = useState(TOOLTIP_WIDTH / 2);
  const [isTooltipReady, setIsTooltipReady] = useState(false);

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const retryFrameRef = useRef<number | null>(null);
  const delayTimeoutRef = useRef<number | null>(null);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isFinalStep = Boolean(currentStep?.isFinal);
  const showBack = currentStepIndex > 0;

  const applyPlacement = useCallback(
    (rect: DOMRect | null) => {
      if (!currentStep) {
        setTargetRect(null);
        setTooltipPosition(null);
        setIsTooltipReady(false);
        return;
      }

      const width = getTooltipWidth(window.innerWidth, isMobile);
      setTooltipWidth(width);

      if (!rect) {
        const fallback = getTopFallbackPlacement(width);
        setTargetRect(null);
        setEffectiveSide(fallback.side);
        setTooltipPosition({ top: fallback.top, left: fallback.left });
        setCaretOffset(width / 2);
        setIsTooltipReady(true);
        return;
      }

      setTargetRect(rect);

      const measuredHeight = tooltipRef.current?.offsetHeight ?? 200;
      const placement =
        resolveTourPlacement(
          rect,
          currentStep.preferredSide,
          width,
          measuredHeight,
          currentStep.targetAttr,
          isMobile
        ) ?? getTopFallbackPlacement(width);

      setEffectiveSide(placement.side);
      setTooltipPosition({ top: placement.top, left: placement.left });

      if (rect) {
        setCaretOffset(
          getCaretOffset(placement.side, rect, { top: placement.top, left: placement.left }, width, measuredHeight)
        );
      } else {
        setCaretOffset(width / 2);
      }

      setIsTooltipReady(true);
    },
    [currentStep, isMobile]
  );

  const clearTimers = useCallback(() => {
    if (delayTimeoutRef.current != null) {
      window.clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }
    if (retryFrameRef.current != null) {
      window.cancelAnimationFrame(retryFrameRef.current);
      retryFrameRef.current = null;
    }
  }, []);

  const updateTarget = useCallback(
    (retryCount = 0) => {
      if (!currentStep) {
        applyPlacement(null);
        return;
      }

      const el = findTourTarget(currentStep.targetAttr, currentStep.fallbackTargetAttr);

      if (!el) {
        applyPlacement(null);

        if (retryCount < MAX_TARGET_RETRIES) {
          retryFrameRef.current = window.requestAnimationFrame(() => {
            updateTarget(retryCount + 1);
          });
        }
        return;
      }

      const scrollBlock = getScrollBlock(currentStep.targetAttr);
      el.scrollIntoView({ block: scrollBlock, inline: 'nearest' });

      const rect = el.getBoundingClientRect();
      applyPlacement(rect);
    },
    [applyPlacement, currentStep]
  );

  const scheduleTargetUpdate = useCallback(() => {
    clearTimers();
    setTargetRect(null);
    setTooltipPosition(null);
    setIsTooltipReady(false);

    delayTimeoutRef.current = window.setTimeout(() => {
      updateTarget(0);
    }, STEP_REPOSITION_DELAY_MS);
  }, [clearTimers, updateTarget]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    scheduleTargetUpdate();
    return clearTimers;
  }, [clearTimers, currentStepIndex, isActive, isLoading, scheduleTargetUpdate]);

  useLayoutEffect(() => {
    if (!isActive || isLoading || !currentStep || !tooltipRef.current || !targetRect) {
      return;
    }

    applyPlacement(targetRect);
  }, [applyPlacement, currentStep, isActive, isLoading, targetRect]);

  useEffect(() => {
    if (!isActive || isLoading) return;

    let resizeTimeout: number | null = null;
    const handleResize = () => {
      if (resizeTimeout != null) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        updateTarget(0);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout != null) window.clearTimeout(resizeTimeout);
    };
  }, [isActive, isLoading, updateTarget]);

  if (isLoading || !isActive || !currentStep) {
    return null;
  }

  const caretEdge = getCaretEdge(effectiveSide);
  const hasAnchor = Boolean(targetRect);
  const showCaret = hasAnchor && isTooltipReady;

  const tooltipStyle = tooltipPosition
    ? {
        position: 'fixed' as const,
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        width: tooltipWidth,
        zIndex: 52,
      }
    : undefined;

  const content = (
    <div
      ref={tooltipRef}
      className={cn(
        'rounded-xl border bg-card shadow-xl transition-opacity duration-150',
        isTooltipReady ? 'opacity-100' : 'pointer-events-none opacity-0'
      )}
      style={tooltipStyle}
      role="dialog"
      aria-labelledby="tour-tooltip-title"
    >
      {showCaret ? <TourCaret side={caretEdge} alignOffset={caretOffset} /> : null}

      <div className="flex max-h-[min(70vh,28rem)] flex-col p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <currentStep.icon className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            onClick={skip}
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Skip tour</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-3">
          <h2 id="tour-tooltip-title" className="text-base font-semibold leading-snug">
            {currentStep.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{currentStep.body}</p>
          {currentStep.note ? <p className="text-xs text-muted-foreground">{currentStep.note}</p> : null}
        </div>

        <div className="shrink-0">
          <TourTooltipFooter
            isFinalStep={isFinalStep}
            finalCtaLabel={currentStep.finalCtaLabel}
            onBack={back}
            onNext={next}
            showBack={showBack}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
