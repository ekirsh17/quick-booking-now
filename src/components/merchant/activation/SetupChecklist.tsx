import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetupProgressRing } from '@/components/merchant/activation/SetupProgressRing';
import { cn } from '@/lib/utils';
import {
  FLOATING_COACH_PANEL_WIDTH_CLASS,
  getFloatingCoachPanelClasses,
} from '@/components/merchant/coachmarks/floatingPanelPosition';
import { OA_CHECKLIST_COLLAPSED_KEY } from '@/lib/setupChecklistAdmin';
import { useActivationContext } from '@/contexts/ActivationContext';
import { useTourContext } from '@/contexts/TourContext';
import { getSetupStepNumber, SETUP_ITEMS, type SetupItemId } from '@/types/activationSetup';

const PANEL_ID = 'activation-setup-checklist-panel';

const CHECKLIST_TITLE_FULL = 'Complete your setup';
const CHECKLIST_TITLE_MEDIUM = 'Complete setup';
const CHECKLIST_TITLE_SHORT = 'Setup';
const CHECKLIST_HEADER_RING_SIZE = 28;
/** Single title scale for collapsed chip and expanded header (pairs with 28px ring). */
const CHECKLIST_HEADER_TITLE_COLLAPSED_CLASS =
  'min-w-0 flex-1 truncate text-lg font-semibold leading-[1.2] tracking-tight text-foreground';
const CHECKLIST_HEADER_TITLE_EXPANDED_CLASS =
  'min-w-0 flex-1 text-lg font-semibold leading-[1.2] tracking-tight text-foreground break-normal';

const CHECKLIST_HEADER_CHEVRON_CLASS =
  'h-[1.125rem] w-[1.125rem] shrink-0 text-accent transition-transform';
/** Match expanded step rows: list px-2.5 + row px-2.5 aligns step circles with header ring. */
const CHECKLIST_HEADER_INSET_CLASS = 'pl-3 pr-5';

const CHECKLIST_EXPAND_COLLAPSE_TRANSITION = {
  duration: 0.25,
  ease: 'easeInOut' as const,
};

/** Orange check in → hold → check + card fade out together → dismiss. */
const CELEBRATION_HOLD_MS = 900;
const CELEBRATION_EXIT_DURATION_S = 0.32;
const CELEBRATION_DISMISS_MS =
  CELEBRATION_HOLD_MS + CELEBRATION_EXIT_DURATION_S * 1000 + 40;

const CHECKLIST_CARD_SURFACE =
  'rounded-xl border border-border bg-card text-foreground shadow-md ring-1 ring-border/60';

const CHECKLIST_STEP_TITLE_CLASS =
  'min-w-0 flex-1 whitespace-normal break-words text-[15px] font-normal leading-snug';
const CHECKLIST_CONFIRM_STEP_TITLE_CLASS =
  'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-normal leading-snug sm:overflow-visible sm:whitespace-normal';

type CelebrationPhase = 'accent' | 'exit' | null;

const celebrationExitTransition = {
  duration: CELEBRATION_EXIT_DURATION_S,
  ease: 'easeInOut' as const,
};

function readChecklistCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(OA_CHECKLIST_COLLAPSED_KEY) === 'true';
}

const SETUP_DONE_BUTTON_CLASS =
  'h-7 shrink-0 gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-accent shadow-none hover:bg-accent/20 hover:text-accent';

function SetupStepIndicator({
  stepNumber,
  isComplete,
  disabled,
  onUncomplete,
}: {
  stepNumber: number;
  isComplete: boolean;
  disabled?: boolean;
  onUncomplete?: () => void;
}) {
  if (isComplete) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onUncomplete}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          disabled && 'pointer-events-none opacity-50'
        )}
        aria-label={`Step ${stepNumber} completed. Mark incomplete`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
      </button>
    );
  }

  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 text-xs font-semibold tabular-nums text-muted-foreground"
      aria-hidden
    >
      {stepNumber}
    </span>
  );
}

function SetupChecklistCelebration({ phase }: { phase: CelebrationPhase }) {
  const showCelebration = phase === 'accent' || phase === 'exit';

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-10 text-center"
      role="status"
      aria-live="polite"
    >
      {showCelebration ? (
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={
            phase === 'exit'
              ? { scale: 0.65, opacity: 0 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            phase === 'exit'
              ? celebrationExitTransition
              : { type: 'spring', stiffness: 420, damping: 22 }
          }
        >
          <CheckCircle2
            className="h-[4.5rem] w-[4.5rem] text-accent"
            strokeWidth={1.75}
            aria-hidden
          />
          <p className="text-base font-semibold tracking-tight text-foreground">Setup complete</p>
        </motion.div>
      ) : null}
    </div>
  );
}

export function SetupChecklist() {
  const { isTourActive } = useTourContext();
  const {
    showWelcomeModal,
    showSetupChecklist,
    loading,
    completion,
    completedCount,
    allComplete,
    navigateToSetupItem,
    markSetupItemComplete,
    markSetupItemIncomplete,
    focusChecklist,
    expandSetupChecklistRequest,
    reopenSetupChecklistRequest,
    collapseSetupChecklistRequest,
    checklistHandoffEntrance,
  } = useActivationContext();

  const totalCount = SETUP_ITEMS.length;
  const allItemsComplete = allComplete || completedCount >= totalCount;
  const [isExpanded, setIsExpanded] = useState(() => !readChecklistCollapsed());
  const [markingCompleteId, setMarkingCompleteId] = useState<SetupItemId | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<SetupItemId | null>(null);
  const [dismissChecklist, setDismissChecklist] = useState(false);
  const [headerTitle, setHeaderTitle] = useState(CHECKLIST_TITLE_FULL);
  const [completionHydrated, setCompletionHydrated] = useState(false);
  const [celebrationPhase, setCelebrationPhase] = useState<CelebrationPhase>(null);
  const celebrationStartedRef = useRef(false);
  const previousAllItemsCompleteRef = useRef(false);
  const checklistRootRef = useRef<HTMLDivElement | null>(null);
  const titleFitSlotRef = useRef<HTMLSpanElement | null>(null);
  const fullTitleMeasureRef = useRef<HTMLSpanElement | null>(null);
  const mediumTitleMeasureRef = useRef<HTMLSpanElement | null>(null);
  const shortTitleMeasureRef = useRef<HTMLSpanElement | null>(null);

  const isCelebrating = celebrationPhase !== null;
  /** Stay mounted after last item completes so celebration can run (context hides checklist when allComplete). */
  const keepVisibleForCompletion =
    completionHydrated && allItemsComplete && !dismissChecklist;
  const isChecklistVisible = showSetupChecklist || keepVisibleForCompletion;

  const orderedItems = SETUP_ITEMS;

  useEffect(() => {
    if (loading) return;

    if (!completionHydrated) {
      setCompletionHydrated(true);
      previousAllItemsCompleteRef.current = allItemsComplete;
      if (allItemsComplete) {
        setDismissChecklist(true);
      }
      return;
    }

    const wasAllItemsComplete = previousAllItemsCompleteRef.current;
    previousAllItemsCompleteRef.current = allItemsComplete;

    if (!allItemsComplete) {
      celebrationStartedRef.current = false;
      setCelebrationPhase(null);
      setDismissChecklist(false);
      return;
    }

    // Avoid replaying celebration when completion was already settled (e.g. refresh).
    if (wasAllItemsComplete) return;

    if (celebrationStartedRef.current) return;
    celebrationStartedRef.current = true;

    setIsExpanded(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
    }

    setCelebrationPhase('accent');

    const toExit = window.setTimeout(() => setCelebrationPhase('exit'), CELEBRATION_HOLD_MS);
    const toDismiss = window.setTimeout(() => {
      setCelebrationPhase(null);
      setDismissChecklist(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(OA_CHECKLIST_COLLAPSED_KEY, 'true');
      }
    }, CELEBRATION_DISMISS_MS);

    return () => {
      window.clearTimeout(toExit);
      window.clearTimeout(toDismiss);
      /**
       * In React StrictMode (dev), effects run setup -> cleanup -> setup on mount.
       * Resetting this guard here ensures the second setup can re-arm timers.
       */
      celebrationStartedRef.current = false;
    };
  }, [allItemsComplete, completionHydrated, loading]);

  useEffect(() => {
    if (!expandSetupChecklistRequest || isCelebrating) return;
    setIsExpanded(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
    }
  }, [expandSetupChecklistRequest, isCelebrating]);

  useEffect(() => {
    if (!reopenSetupChecklistRequest) return;
    setDismissChecklist(false);
    setIsExpanded(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
    }
  }, [reopenSetupChecklistRequest]);

  useEffect(() => {
    if (!collapseSetupChecklistRequest || isCelebrating) return;
    setIsExpanded(false);
  }, [collapseSetupChecklistRequest, isCelebrating]);

  useEffect(() => {
    if (!isChecklistVisible) return;

    const updateHeaderTitle = () => {
      const slot = titleFitSlotRef.current;
      const full = fullTitleMeasureRef.current;
      const medium = mediumTitleMeasureRef.current;
      const short = shortTitleMeasureRef.current;
      if (!slot || !full || !medium || !short) return;

      const availableWidth = slot.clientWidth;
      const fullWidth = full.getBoundingClientRect().width;
      const mediumWidth = medium.getBoundingClientRect().width;
      const nextTitle =
        fullWidth <= availableWidth
          ? CHECKLIST_TITLE_FULL
          : mediumWidth <= availableWidth
            ? CHECKLIST_TITLE_MEDIUM
            : CHECKLIST_TITLE_SHORT;

      setHeaderTitle((current) => (current === nextTitle ? current : nextTitle));
    };

    updateHeaderTitle();
    window.addEventListener('resize', updateHeaderTitle);

    const observer = new ResizeObserver(updateHeaderTitle);
    if (checklistRootRef.current) {
      observer.observe(checklistRootRef.current);
    }
    if (titleFitSlotRef.current) {
      observer.observe(titleFitSlotRef.current);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeaderTitle);
    };
  }, [isChecklistVisible, isExpanded]);

  const collapseChecklist = useCallback(() => {
    if (isCelebrating) return;
    setIsExpanded(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OA_CHECKLIST_COLLAPSED_KEY, 'true');
    }
  }, [isCelebrating]);

  const expandChecklist = useCallback(() => {
    if (isCelebrating) return;
    setIsExpanded(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
    }
  }, [isCelebrating]);

  const toggleChecklist = useCallback(() => {
    if (isExpanded) {
      collapseChecklist();
    } else {
      expandChecklist();
    }
  }, [collapseChecklist, expandChecklist, isExpanded]);

  const handleToggleItem = useCallback(
    async (itemId: SetupItemId, checked: boolean) => {
      setMarkingCompleteId(itemId);
      try {
        if (checked) {
          await markSetupItemComplete(itemId);
        } else {
          await markSetupItemIncomplete(itemId);
        }
      } finally {
        setMarkingCompleteId((current) => (current === itemId ? null : current));
      }
    },
    [markSetupItemComplete, markSetupItemIncomplete]
  );

  const handleConfirmComplete = useCallback(
    async (itemId: SetupItemId) => {
      setPendingConfirmId(null);
      setMarkingCompleteId(itemId);
      try {
        await markSetupItemComplete(itemId);
      } finally {
        setMarkingCompleteId((current) => (current === itemId ? null : current));
      }
    },
    [markSetupItemComplete]
  );

  const handleActivateStep = useCallback(
    (itemId: SetupItemId) => {
      setPendingConfirmId(itemId);
      navigateToSetupItem(itemId);
    },
    [navigateToSetupItem]
  );

  const handleDismissStep = useCallback(() => {
    setPendingConfirmId(null);
  }, []);

  const handleNavigateToStep = useCallback(
    (itemId: SetupItemId) => {
      navigateToSetupItem(itemId);
    },
    [navigateToSetupItem]
  );

  if (isTourActive || showWelcomeModal) return null;
  if (!isChecklistVisible) return null;

  const isExitingCelebration = celebrationPhase === 'exit';
  const isTourHandoffEntrance = checklistHandoffEntrance && !isExitingCelebration;

  return createPortal(
    <AnimatePresence>
      {!dismissChecklist ? (
        <motion.div
          key="setup-checklist-root"
          ref={checklistRootRef}
          initial={
            isTourHandoffEntrance ? { opacity: 0, y: 18, scale: 0.96 } : { opacity: 0, y: 10, scale: 1 }
          }
          animate={
            isExitingCelebration
              ? { opacity: 0, y: 8, scale: 0.92 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={{ opacity: 0, y: 14, scale: 0.96 }}
          transition={
            isExitingCelebration
              ? celebrationExitTransition
              : {
                  duration: isTourHandoffEntrance ? 0.45 : 0.3,
                  ease: isTourHandoffEntrance ? ([0.22, 1, 0.36, 1] as const) : 'easeInOut',
                  layout: CHECKLIST_EXPAND_COLLAPSE_TRANSITION,
                }
          }
          className={cn(
            getFloatingCoachPanelClasses(),
            CHECKLIST_CARD_SURFACE,
            'overflow-hidden rounded-xl',
            focusChecklist && !isCelebrating && 'ring-2 ring-accent/35 ring-offset-2'
          )}
        >
          <div
            id="activation-setup-checklist"
            aria-labelledby="setup-checklist-title"
            className="flex flex-col"
          >
            {isCelebrating ? (
              <div id={PANEL_ID}>
                <SetupChecklistCelebration phase={celebrationPhase} />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleChecklist}
                  aria-expanded={isExpanded}
                  aria-controls={PANEL_ID}
                  aria-label={`${headerTitle}, ${completedCount} of ${totalCount} complete`}
                  className={cn(
                    'flex w-full min-h-11 items-center gap-2.5 py-3 text-left',
                    CHECKLIST_HEADER_INSET_CLASS,
                    isExpanded && 'border-b border-border bg-muted/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
                  )}
                >
                  <SetupProgressRing
                    completed={completedCount}
                    total={totalCount}
                    size={CHECKLIST_HEADER_RING_SIZE}
                  />
                  <span
                    id="setup-checklist-title"
                    className={
                      isExpanded
                        ? CHECKLIST_HEADER_TITLE_EXPANDED_CLASS
                        : CHECKLIST_HEADER_TITLE_COLLAPSED_CLASS
                    }
                  >
                    {headerTitle}
                  </span>
                  <ChevronDown
                    className={cn(
                      CHECKLIST_HEADER_CHEVRON_CLASS,
                      'ml-auto',
                      isExpanded ? 'rotate-0' : 'rotate-180'
                    )}
                    aria-hidden
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded ? (
                    <motion.div
                      id={PANEL_ID}
                      key="setup-checklist-steps"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={CHECKLIST_EXPAND_COLLAPSE_TRANSITION}
                      className="overflow-hidden"
                    >
                      <div className="px-2.5 py-2">
                        <ul className="space-y-0" aria-label="Setup steps">
                          <AnimatePresence initial={false}>
                            {orderedItems.map((item) => {
                              const isComplete = completion[item.id];
                              const isMarking = markingCompleteId === item.id;
                              const isConfirming = pendingConfirmId === item.id;
                              const stepNumber = getSetupStepNumber(item.id);

                              return (
                                <motion.li
                                  key={item.id}
                                  layout
                                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                  className="overflow-hidden rounded-lg"
                                >
                                  <div
                                    className={cn(
                                      'flex w-full min-h-11 gap-2.5 px-2.5 py-2',
                                      'items-center',
                                      !isComplete && !isConfirming && 'hover:bg-muted/50',
                                      isComplete && 'opacity-65'
                                    )}
                                  >
                                    <SetupStepIndicator
                                      stepNumber={stepNumber}
                                      isComplete={isComplete}
                                      disabled={isMarking}
                                      onUncomplete={
                                        isComplete
                                          ? () => void handleToggleItem(item.id, false)
                                          : undefined
                                      }
                                    />
                                    {isComplete ? (
                                      <span
                                        className="flex min-w-0 flex-1 items-center px-0.5"
                                        aria-hidden
                                      >
                                        <span className={cn(CHECKLIST_STEP_TITLE_CLASS, 'text-muted-foreground line-through decoration-muted-foreground/60')}>
                                          {item.title}
                                        </span>
                                      </span>
                                    ) : isConfirming ? (
                                      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 sm:gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleNavigateToStep(item.id)}
                                          title={item.title}
                                          className="flex min-w-0 flex-1 items-center px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
                                        >
                                          <span className={CHECKLIST_CONFIRM_STEP_TITLE_CLASS}>
                                            {item.title}
                                          </span>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={handleDismissStep}
                                            disabled={isMarking}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/80 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
                                            aria-label={`Cancel ${item.title}`}
                                          >
                                            <X className="h-3.5 w-3.5" aria-hidden />
                                          </button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            disabled={isMarking}
                                            className={SETUP_DONE_BUTTON_CLASS}
                                            onClick={() => void handleConfirmComplete(item.id)}
                                          >
                                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                            Done
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleActivateStep(item.id)}
                                        title={item.title}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md"
                                      >
                                        <span className={CHECKLIST_STEP_TITLE_CLASS}>
                                          {item.title}
                                        </span>
                                        <ChevronRight
                                          className="h-4 w-4 shrink-0 text-muted-foreground/70"
                                          aria-hidden
                                        />
                                      </button>
                                    )}
                                  </div>
                                </motion.li>
                              );
                            })}
                          </AnimatePresence>
                        </ul>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            )}
          </div>
          <div
            aria-hidden
            className={cn(
              FLOATING_COACH_PANEL_WIDTH_CLASS,
              'pointer-events-none absolute opacity-0',
              'flex items-center gap-2.5 py-3',
              CHECKLIST_HEADER_INSET_CLASS
            )}
          >
            <span className="h-[28px] w-[28px] shrink-0" />
            <span ref={titleFitSlotRef} className={CHECKLIST_HEADER_TITLE_COLLAPSED_CLASS} />
            <span className="h-[1.125rem] w-[1.125rem] shrink-0" />
            <span
              ref={fullTitleMeasureRef}
              className="absolute whitespace-nowrap text-lg font-semibold leading-[1.2] tracking-tight"
            >
              {CHECKLIST_TITLE_FULL}
            </span>
            <span
              ref={mediumTitleMeasureRef}
              className="absolute whitespace-nowrap text-lg font-semibold leading-[1.2] tracking-tight"
            >
              {CHECKLIST_TITLE_MEDIUM}
            </span>
            <span
              ref={shortTitleMeasureRef}
              className="absolute whitespace-nowrap text-lg font-semibold leading-[1.2] tracking-tight"
            >
              {CHECKLIST_TITLE_SHORT}
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
