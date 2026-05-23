import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { subtleAccentOutlineHover } from '@/lib/interactiveHover';
import { FloatingCoachCard } from '@/components/merchant/coachmarks/FloatingCoachCard';
import { useTourContext, type TourStepDef } from '@/contexts/TourContext';

const STEP_SCROLL_DELAY_MS = 500;
const MAX_TARGET_RETRIES = 20;

const TOUR_PRIMARY_BUTTON_CLASS =
  'bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent';

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

function getScrollBlock(step: TourStepDef): ScrollLogicalPosition {
  if (step.scrollBlock) return step.scrollBlock;
  if (step.targetAttr === 'new-opening-btn') return 'nearest';
  if (step.skipScrollIntoView) return 'nearest';
  return 'center';
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
            className={cn('min-h-11 lg:min-h-9', subtleAccentOutlineHover)}
            onClick={onBack}
          >
            Back
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center">
        {isFinalStep ? (
          <Button
            type="button"
            size="sm"
            className={cn('h-9 min-h-11 max-w-[11rem] lg:min-h-9', TOUR_PRIMARY_BUTTON_CLASS)}
            onClick={onNext}
          >
            <span className="truncate">{finalCtaLabel}</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className={cn('h-9 min-h-11 lg:min-h-9', TOUR_PRIMARY_BUTTON_CLASS)}
            onClick={onNext}
          >
            Next
            <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TourTooltip() {
  const {
    isActive,
    isLoading,
    currentStepIndex,
    steps,
    next,
    back,
    skip,
    getQuickTourFinalCtaLabel,
  } = useTourContext();

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

  const scrollTargetIntoView = useCallback(
    (retryCount = 0) => {
      if (!currentStep) return;

      const el = findTourTarget(currentStep.targetAttr, currentStep.fallbackTargetAttr);

      if (!el) {
        if (retryCount < MAX_TARGET_RETRIES) {
          retryFrameRef.current = window.requestAnimationFrame(() => {
            scrollTargetIntoView(retryCount + 1);
          });
        }
        return;
      }

      if (!currentStep.skipScrollIntoView) {
        el.scrollIntoView({ block: getScrollBlock(currentStep), inline: 'nearest' });
      }
    },
    [currentStep]
  );

  const scheduleTargetScroll = useCallback(() => {
    clearTimers();
    delayTimeoutRef.current = window.setTimeout(() => {
      scrollTargetIntoView(0);
    }, STEP_SCROLL_DELAY_MS);
  }, [clearTimers, scrollTargetIntoView]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    scheduleTargetScroll();
    return clearTimers;
  }, [clearTimers, currentStepIndex, isActive, isLoading, scheduleTargetScroll]);

  if (isLoading || !isActive || !currentStep) {
    return null;
  }

  return createPortal(
    <FloatingCoachCard
      key={currentStepIndex}
      className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
      role="dialog"
      aria-labelledby="tour-tooltip-title"
    >
      <div className="flex max-h-[min(70vh,28rem)] flex-col p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <currentStep.icon className="h-5 w-5 flex-shrink-0 text-accent" />
            <span className="text-xs text-muted-foreground">
              {currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:pointer-events-none lg:min-h-8 lg:min-w-8"
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
          {currentStep.note ? (
            <p className="text-xs text-muted-foreground">{currentStep.note}</p>
          ) : null}
        </div>

        <div className="shrink-0">
          <TourTooltipFooter
            isFinalStep={isFinalStep}
            finalCtaLabel={isFinalStep ? getQuickTourFinalCtaLabel() : undefined}
            onBack={back}
            onNext={next}
            showBack={showBack}
          />
        </div>
      </div>
    </FloatingCoachCard>,
    document.body
  );
}
