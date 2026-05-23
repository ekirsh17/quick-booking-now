import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetupProgressRing } from '@/components/merchant/activation/SetupProgressRing';
import { cn } from '@/lib/utils';
import { getFloatingCoachClasses } from '@/components/merchant/coachmarks/floatingPanelPosition';
import { OA_CHECKLIST_COLLAPSED_KEY } from '@/lib/setupChecklistAdmin';
import { useActivationContext } from '@/contexts/ActivationContext';
import { useTourContext } from '@/contexts/TourContext';
import { getSetupStepNumber, SETUP_ITEMS, type SetupItemId } from '@/types/activationSetup';

const PANEL_ID = 'activation-setup-checklist-panel';

const CHECKLIST_TITLE = 'Complete your setup';
const CHECKLIST_HEADER_RING_SIZE = 28;
/** Single title scale for collapsed chip and expanded header (pairs with 28px ring). */
const CHECKLIST_HEADER_TITLE_CLASS =
  'min-w-0 flex-1 truncate text-lg font-semibold leading-[1.2] tracking-tight text-foreground';

/** Orange check in → hold → check + card fade out together → dismiss. */
const CELEBRATION_HOLD_MS = 900;
const CELEBRATION_EXIT_DURATION_S = 0.32;
const CELEBRATION_DISMISS_MS =
  CELEBRATION_HOLD_MS + CELEBRATION_EXIT_DURATION_S * 1000 + 40;

const CHECKLIST_CARD_SURFACE =
  'rounded-xl border border-border bg-card text-foreground shadow-md ring-1 ring-border/60';

const CHECKLIST_COLLAPSED_SURFACE =
  'rounded-xl border-0 bg-card text-foreground shadow-md';

const CHECKLIST_HEADER_CHEVRON_CLASS = 'h-[1.125rem] w-[1.125rem] shrink-0 text-accent transition-transform';

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

  const [isExpanded, setIsExpanded] = useState(() => !readChecklistCollapsed());
  const [markingCompleteId, setMarkingCompleteId] = useState<SetupItemId | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<SetupItemId | null>(null);
  const [dismissChecklist, setDismissChecklist] = useState(false);
  const [celebrationPhase, setCelebrationPhase] = useState<CelebrationPhase>(null);
  const celebrationStartedRef = useRef(false);

  const totalCount = SETUP_ITEMS.length;
  const allItemsComplete = allComplete || completedCount >= totalCount;
  const isCelebrating = celebrationPhase !== null;
  /** Stay mounted after last item completes so celebration can run (context hides checklist when allComplete). */
  const keepVisibleForCompletion = allItemsComplete && !dismissChecklist;
  const isChecklistVisible = showSetupChecklist || keepVisibleForCompletion;

  const orderedItems = SETUP_ITEMS;

  useEffect(() => {
    if (!allItemsComplete) {
      celebrationStartedRef.current = false;
      setCelebrationPhase(null);
      setDismissChecklist(false);
      return;
    }

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
    };
  }, [allItemsComplete]);

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

  const collapseChecklist = useCallback(() => {
    if (isCelebrating) return;
    setPendingConfirmId(null);
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
              : isTourHandoffEntrance
                ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0.3, ease: 'easeInOut' }
          }
          className={cn(
            isExpanded
              ? cn(getFloatingCoachClasses('panel'), CHECKLIST_CARD_SURFACE, 'rounded-xl')
              : getFloatingCoachClasses('chip')
          )}
        >
          <AnimatePresence mode="wait">
            {!isExpanded ? (
              <motion.button
                key="setup-checklist-collapsed"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                onClick={expandChecklist}
                aria-expanded={false}
                aria-controls={PANEL_ID}
                aria-label={`${CHECKLIST_TITLE}, ${completedCount} of ${totalCount} complete`}
                className={cn(
                  CHECKLIST_COLLAPSED_SURFACE,
                  'flex w-[min(calc(100vw-2rem),20.5rem)] max-w-[20.5rem] items-center gap-2.5 py-3 pl-3 pr-3.5 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
              >
                <SetupProgressRing
                  completed={completedCount}
                  total={totalCount}
                  size={CHECKLIST_HEADER_RING_SIZE}
                />
                <span className={CHECKLIST_HEADER_TITLE_CLASS}>{CHECKLIST_TITLE}</span>
                <ChevronDown
                  className={cn(CHECKLIST_HEADER_CHEVRON_CLASS, 'rotate-180')}
                  aria-hidden
                />
              </motion.button>
            ) : (
              <motion.div
                key="setup-checklist-expanded"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                id="activation-setup-checklist"
                aria-labelledby="setup-checklist-title"
                aria-expanded
                className={cn(
                  'overflow-hidden rounded-xl',
                  focusChecklist && !isCelebrating && 'ring-2 ring-accent/35 ring-offset-2'
                )}
              >
                <div id={PANEL_ID} className="flex flex-col">
                  {isCelebrating ? (
                    <SetupChecklistCelebration phase={celebrationPhase} />
                  ) : (
                    <>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3.5 py-3">
                        <button
                          type="button"
                          onClick={collapseChecklist}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                          aria-expanded={isExpanded}
                        >
                          <SetupProgressRing
                            completed={completedCount}
                            total={totalCount}
                            size={CHECKLIST_HEADER_RING_SIZE}
                          />
                          <p id="setup-checklist-title" className={CHECKLIST_HEADER_TITLE_CLASS}>
                            {CHECKLIST_TITLE}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={collapseChecklist}
                          className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label="Collapse setup checklist"
                        >
                          <ChevronDown className={cn(CHECKLIST_HEADER_CHEVRON_CLASS, 'rotate-0')} aria-hidden />
                        </button>
                      </div>

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
                                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[15px] font-normal leading-snug text-muted-foreground line-through decoration-muted-foreground/60">
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
                                          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[15px] font-normal leading-snug">
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
                                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[15px] font-normal leading-snug">
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
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
