import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TOUR_HIGHLIGHT_CLASSES, useTourContext } from '@/contexts/TourContext';

const TOOLTIP_WIDTH = 300;
const STEP_REPOSITION_DELAY_MS = 500;
const MAX_TARGET_RETRIES = 20;

function computeTooltipPosition(
  rect: DOMRect,
  side: 'top' | 'bottom' | 'left' | 'right',
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
  preferred: 'top' | 'bottom' | 'left' | 'right',
  tooltipHeight: number
): 'top' | 'bottom' | 'left' | 'right' {
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

function removeHighlight(target: HTMLElement | null) {
  if (!target) return;
  target.classList.remove(...TOUR_HIGHLIGHT_CLASSES);
}

function addHighlight(target: HTMLElement) {
  target.classList.add(...TOUR_HIGHLIGHT_CLASSES);
}

function findTourTarget(attr: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour-target="${attr}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return node;
    }
  }
  return nodes[0] ?? null;
}

function TourCaret({ side, alignOffset }: { side: 'top' | 'bottom' | 'left' | 'right'; alignOffset: number }) {
  const base = 'absolute w-3 h-3 border-border bg-card rotate-45';

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
        className={cn(base, 'border-l border-b -left-1.5')}
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

export function TourTooltip() {
  const {
    isActive,
    isLoading,
    currentStepIndex,
    steps,
    inboundEmailAddress,
    next,
    back,
    skip,
  } = useTourContext();

  const isMobile = useIsMobile();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [effectiveSide, setEffectiveSide] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [caretOffset, setCaretOffset] = useState(TOOLTIP_WIDTH / 2);
  const [copied, setCopied] = useState(false);

  const targetElementRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const retryFrameRef = useRef<number | null>(null);
  const delayTimeoutRef = useRef<number | null>(null);

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const isFinalStep = Boolean(currentStep?.isFinal);

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
        setTargetRect(null);
        setTooltipPosition(null);
        return;
      }

      const el = findTourTarget(currentStep.targetAttr);

      if (!el) {
        removeHighlight(targetElementRef.current);
        targetElementRef.current = null;
        setTargetRect(null);
        setTooltipPosition(null);

        if (retryCount < MAX_TARGET_RETRIES) {
          retryFrameRef.current = window.requestAnimationFrame(() => {
            updateTarget(retryCount + 1);
          });
        }
        return;
      }

      if (targetElementRef.current && targetElementRef.current !== el) {
        removeHighlight(targetElementRef.current);
      }

      targetElementRef.current = el;
      addHighlight(el);

      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      if (isMobile) {
        setTooltipPosition(null);
        return;
      }

      const measuredHeight = tooltipRef.current?.offsetHeight ?? 200;
      const side = getEffectiveSide(rect, currentStep.preferredSide, measuredHeight);
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
    },
    [currentStep, isMobile]
  );

  const scheduleTargetUpdate = useCallback(() => {
    clearTimers();
    removeHighlight(targetElementRef.current);
    targetElementRef.current = null;
    setTargetRect(null);
    setTooltipPosition(null);

    delayTimeoutRef.current = window.setTimeout(() => {
      updateTarget(0);
    }, STEP_REPOSITION_DELAY_MS);
  }, [clearTimers, updateTarget]);

  useEffect(() => {
    if (!isActive || isLoading) return;
    scheduleTargetUpdate();
    return () => {
      clearTimers();
      removeHighlight(targetElementRef.current);
      targetElementRef.current = null;
    };
  }, [clearTimers, currentStepIndex, isActive, isLoading, scheduleTargetUpdate]);

  useLayoutEffect(() => {
    if (!isActive || isLoading || isMobile || !targetRect || !currentStep || !tooltipRef.current) {
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
  }, [currentStep, isActive, isLoading, isMobile, targetRect, copied]);

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

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    setCopied(false);
  }, [currentStepIndex]);

  if (isLoading || !isActive || !currentStep) {
    return null;
  }

  const handleCopyEmail = async () => {
    if (!inboundEmailAddress) return;
    try {
      await navigator.clipboard.writeText(inboundEmailAddress);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy inbound email:', error);
    }
  };

  const overlayPadding = 6;
  const showSpotlight = Boolean(targetRect);

  const tooltipStyle = isMobile
    ? {
        position: 'fixed' as const,
        bottom: 80,
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
      : {
          position: 'fixed' as const,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: TOOLTIP_WIDTH,
          zIndex: 52,
        };

  const content = (
    <>
      {showSpotlight && targetRect ? (
        <>
          <div
            className="fixed left-0 right-0 z-50 pointer-events-none bg-black/40"
            style={{ top: 0, height: Math.max(0, targetRect.top - overlayPadding) }}
          />
          <div
            className="fixed left-0 right-0 bottom-0 z-50 pointer-events-none bg-black/40"
            style={{ top: targetRect.bottom + overlayPadding }}
          />
          <div
            className="fixed z-50 pointer-events-none bg-black/40"
            style={{
              top: targetRect.top - overlayPadding,
              left: 0,
              width: Math.max(0, targetRect.left - overlayPadding),
              height: targetRect.height + overlayPadding * 2,
            }}
          />
          <div
            className="fixed z-50 pointer-events-none bg-black/40"
            style={{
              top: targetRect.top - overlayPadding,
              left: targetRect.right + overlayPadding,
              right: 0,
              height: targetRect.height + overlayPadding * 2,
            }}
          />
        </>
      ) : null}

      <div
        key={currentStepIndex}
        ref={tooltipRef}
        className={cn(
          'rounded-xl border bg-card shadow-xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200',
          !isMobile && !tooltipPosition && !showSpotlight && 'translate-x-[-50%] translate-y-[-50%]'
        )}
        style={tooltipStyle}
        role="dialog"
        aria-labelledby="tour-tooltip-title"
      >
        {!isMobile && showSpotlight ? <TourCaret side={effectiveSide} alignOffset={caretOffset} /> : null}

        <div className="p-4">
          <div className="flex items-center justify-between gap-2 border-b pb-3">
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

          <div className="space-y-2 pt-3">
            <h2 id="tour-tooltip-title" className="text-base font-semibold leading-snug">
              {currentStep.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{currentStep.body}</p>

            {currentStep.showEmailCopy ? (
              inboundEmailAddress ? (
                <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                  <code className="truncate text-sm text-foreground">{inboundEmailAddress}</code>
                  <Button type="button" variant="outline" size="sm" className="h-9 min-w-16 shrink-0" onClick={() => void handleCopyEmail()}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  Your forwarding email will appear in Booking Rules.
                </p>
              )
            ) : null}

            {currentStep.note ? (
              <p className="mt-1 text-xs text-muted-foreground">{currentStep.note}</p>
            ) : null}
          </div>

          <div className="mt-4 border-t pt-3">
            {isFinalStep ? (
              <div className="space-y-2">
                <Button type="button" className="h-11 w-full" onClick={next}>
                  {currentStep.finalCtaLabel}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" className="h-11 w-full" onClick={skip}>
                  I&apos;ll explore on my own
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  {!isFinalStep ? (
                    <div className="flex items-center gap-1.5">
                      {steps.map((step, index) => (
                        <div
                          key={step.id}
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            index === currentStepIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    {currentStepIndex > 0 ? (
                      <Button type="button" variant="ghost" size="sm" className="h-9 min-h-9" onClick={back}>
                        Back
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" className="h-9 min-h-9" onClick={next}>
                      Next
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex justify-center">
                  <Button type="button" variant="ghost" size="sm" className="h-9 min-h-9 text-xs text-muted-foreground" onClick={skip}>
                    Skip tour
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
