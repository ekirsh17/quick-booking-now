import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTourContext } from '@/contexts/TourContext';

const TOOLTIP_WIDTH = 300;
const STEP_REPOSITION_DELAY_MS = 500;
const MAX_TARGET_RETRIES = 20;

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

function computeTooltipPosition(
  rect: DOMRect,
  side: TooltipSide,
  tooltipWidth = TOOLTIP_WIDTH,
  tooltipHeight = 200,
  padding = 12
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

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

  left = Math.max(8, Math.min(vw - tooltipWidth - 8, left));
  top = Math.max(8, Math.min(vh - tooltipHeight - 8, top));

  return { top, left };
}

function getEffectiveSide(
  rect: DOMRect,
  preferred: TooltipSide,
  tooltipHeight: number
): TooltipSide {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  if (preferred === 'bottom' && rect.bottom + tooltipHeight + 24 > vh && rect.top > tooltipHeight + 24) {
    return 'top';
  }
  if (preferred === 'top' && rect.top - tooltipHeight - 24 < 0 && vh - rect.bottom > tooltipHeight + 24) {
    return 'bottom';
  }
  if (preferred === 'left' && rect.left - TOOLTIP_WIDTH - 24 < 0 && vw - rect.right > TOOLTIP_WIDTH + 24) {
    return 'right';
  }
  if (preferred === 'right' && rect.right + TOOLTIP_WIDTH + 24 > vw && rect.left > TOOLTIP_WIDTH + 24) {
    return 'left';
  }

  return preferred;
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
  if (targetAttr === 'booking-rules-auto-openings' || targetAttr === 'booking-rules-section') {
    return 'center';
  }
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
  currentStepIndex,
  totalSteps,
  isFinalStep,
  finalCtaLabel,
  onBack,
  onNext,
  onSkip,
  showBack,
}: {
  currentStepIndex: number;
  totalSteps: number;
  isFinalStep: boolean;
  finalCtaLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  showBack: boolean;
}) {
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <button
            type="button"
            className="text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={onSkip}
          >
            {isFinalStep ? "I'll explore on my own" : 'Skip tour'}
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }, (_, index) => (
              <div
                key={index}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  index === currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showBack ? (
            <Button type="button" variant="ghost" size="sm" className="h-9 min-h-9" onClick={onBack}>
              Back
            </Button>
          ) : null}
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
    </div>
  );
}

export function TourTooltip() {
  const { isActive, isLoading, currentStepIndex, steps, next, back, skip } = useTourContext();

  const isMobile = useIsMobile();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
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

  const finishPositioning = useCallback(
    (rect: DOMRect) => {
      setTargetRect(rect);

      if (isMobile) {
        setTooltipPosition(null);
        setIsTooltipReady(true);
        return;
      }

      const measuredHeight = tooltipRef.current?.offsetHeight ?? 200;
      const side = getEffectiveSide(rect, currentStep!.preferredSide, measuredHeight);
      setEffectiveSide(side);

      const position = computeTooltipPosition(rect, side, TOOLTIP_WIDTH, measuredHeight);
      setTooltipPosition(position);

      if (side === 'top' || side === 'bottom') {
        const targetCenterX = rect.left + rect.width / 2;
        setCaretOffset(Math.max(16, Math.min(TOOLTIP_WIDTH - 16, targetCenterX - position.left)));
      } else {
        const targetCenterY = rect.top + rect.height / 2;
        setCaretOffset(Math.max(16, Math.min(measuredHeight - 16, targetCenterY - position.top)));
      }

      setIsTooltipReady(true);
    },
    [currentStep, isMobile]
  );

  const updateTarget = useCallback(
    (retryCount = 0) => {
      if (!currentStep) {
        setTargetRect(null);
        setTooltipPosition(null);
        setIsTooltipReady(false);
        return;
      }

      const el = findTourTarget(currentStep.targetAttr, currentStep.fallbackTargetAttr);

      if (!el) {
        setTargetRect(null);
        setTooltipPosition(null);
        setIsTooltipReady(false);

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
      finishPositioning(rect);
    },
    [currentStep, finishPositioning]
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
    if (!isActive || isLoading || isMobile || !targetRect || !currentStep || !tooltipRef.current || !isTooltipReady) {
      return;
    }

    const measuredHeight = tooltipRef.current.offsetHeight;
    const side = getEffectiveSide(targetRect, currentStep.preferredSide, measuredHeight);
    setEffectiveSide(side);

    const position = computeTooltipPosition(targetRect, side, TOOLTIP_WIDTH, measuredHeight);
    setTooltipPosition(position);

    if (side === 'top' || side === 'bottom') {
      const targetCenterX = targetRect.left + targetRect.width / 2;
      setCaretOffset(Math.max(16, Math.min(TOOLTIP_WIDTH - 16, targetCenterX - position.left)));
    } else {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      setCaretOffset(Math.max(16, Math.min(measuredHeight - 16, targetCenterY - position.top)));
    }
  }, [currentStep, isActive, isLoading, isMobile, isTooltipReady, targetRect]);

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

  const tooltipStyle = isMobile
    ? {
        position: 'fixed' as const,
        bottom: 'max(5rem, calc(5rem + env(safe-area-inset-bottom, 0px)))',
        left: 12,
        right: 12,
        zIndex: 52,
      }
    : tooltipPosition
      ? {
          position: 'fixed' as const,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          width: TOOLTIP_WIDTH,
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
      {!isMobile && hasAnchor && isTooltipReady ? (
        <TourCaret side={caretEdge} alignOffset={caretOffset} />
      ) : null}

      <div className="flex max-h-[min(70vh,28rem)] flex-col p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <currentStep.icon className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={skip}
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </Button>
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
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            isFinalStep={isFinalStep}
            finalCtaLabel={currentStep.finalCtaLabel}
            onBack={back}
            onNext={next}
            onSkip={skip}
            showBack={showBack}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
