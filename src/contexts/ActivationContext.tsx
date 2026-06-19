import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useActivationSetup } from '@/hooks/useActivationSetup';
import { useTourContext } from '@/contexts/TourContext';
import {
  buildEmptySetupCompletion,
  enableSetupChecklistPreview,
  isSetupChecklistPreviewActive,
  mergeSetupCompletion,
  OA_CHECKLIST_COLLAPSED_KEY,
  OA_SETUP_CHECKLIST_PREVIEW_EVENT,
  clearChecklistDismissed,
  persistChecklistDismissed,
  readChecklistDismissed,
  readManuallyCompletedItems,
  readManuallyIncompleteItems,
} from '@/lib/setupChecklistAdmin';
import {
  getSetupFocusSectionForItem,
  getSetupItemNavigatePath,
  SETUP_CHECKLIST_PREVIEW_PARAM,
  SETUP_QUERY_PARAM,
  SETUP_SECTION_FOCUS_EVENT,
  SETUP_TOUR_HANDOFF_VALUE,
  shouldFocusSetupSection,
} from '@/lib/setupChecklistNavigation';

const TOUR_CHECKLIST_HANDOFF_DELAY_MS = 420;
import { stashPendingSetupSectionFocus } from '@/lib/setupSectionFocus';
import { countCompletedItems, getApplicableSetupItemIds, getApplicableSetupItems, getFirstIncompleteSetupItem, isAllSetupComplete } from '@/lib/activationSetupCompletion';
import type {
  ActivationProfileSnapshot,
  SetupCompletionMap,
  SetupItemDefinition,
  SetupItemId,
} from '@/types/activationSetup';

interface ActivationContextValue {
  profile: ActivationProfileSnapshot;
  completion: SetupCompletionMap;
  applicableSetupItems: SetupItemDefinition[];
  completedCount: number;
  allComplete: boolean;
  showWelcomeModal: boolean;
  showSetupChecklist: boolean;
  loading: boolean;
  isSetupChecklistPreview: boolean;
  checklistHandoffEntrance: boolean;
  navigateToSetupItem: (id: SetupItemId) => void;
  markSetupItemComplete: (id: SetupItemId) => Promise<void>;
  markSetupItemIncomplete: (id: SetupItemId) => Promise<void>;
  handleGetSetUp: () => Promise<void>;
  /** Opens the floating setup checklist (continues or reviews all steps). */
  openSetupChecklist: () => Promise<void>;
  handleShowMeAround: () => Promise<void>;
  handleDismissWelcome: () => Promise<void>;
  refresh: () => Promise<void>;
  markQrEngaged: () => Promise<void>;
  focusChecklist: boolean;
  expandSetupChecklist: () => void;
  expandSetupChecklistRequest: number;
  reopenSetupChecklistRequest: number;
  collapseSetupChecklistRequest: number;
  dismissSetupChecklist: () => void;
}

const ActivationContext = createContext<ActivationContextValue | null>(null);

export function ActivationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const setup = useActivationSetup();
  const { startQuickTour, registerQuickTourFinalCta, setTourBlocked } = useTourContext();
  const [focusChecklist, setFocusChecklist] = useState(false);
  const [checklistEngaged, setChecklistEngaged] = useState(false);
  const [checklistManuallyOpen, setChecklistManuallyOpen] = useState(false);
  const [expandSetupChecklistRequest, setExpandSetupChecklistRequest] = useState(0);
  const [reopenSetupChecklistRequest, setReopenSetupChecklistRequest] = useState(0);
  const [collapseSetupChecklistRequest, setCollapseSetupChecklistRequest] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [welcomeSuppressed, setWelcomeSuppressed] = useState(false);
  const [checklistHandoffEntrance, setChecklistHandoffEntrance] = useState(false);
  const [checklistDismissedRevision, setChecklistDismissedRevision] = useState(0);
  const [manualCompletionRevision, setManualCompletionRevision] = useState(0);

  const checklistDismissed = useMemo(
    () => readChecklistDismissed(),
    [checklistDismissedRevision]
  );

  const isSetupChecklistPreview = useMemo(
    () => isSetupChecklistPreviewActive(),
    [previewRevision]
  );

  useEffect(() => {
    const handlePreviewChange = () => setPreviewRevision((value) => value + 1);
    window.addEventListener(OA_SETUP_CHECKLIST_PREVIEW_EVENT, handlePreviewChange);
    return () => window.removeEventListener(OA_SETUP_CHECKLIST_PREVIEW_EVENT, handlePreviewChange);
  }, []);

  const completion = useMemo(() => {
    const base = isSetupChecklistPreview ? buildEmptySetupCompletion() : setup.completion;
    return mergeSetupCompletion(
      base,
      readManuallyCompletedItems(),
      readManuallyIncompleteItems()
    );
  }, [isSetupChecklistPreview, manualCompletionRevision, setup.completion]);

  const applicableSetupItemIds = useMemo(
    () => getApplicableSetupItemIds(setup.profile, { previewAll: isSetupChecklistPreview }),
    [isSetupChecklistPreview, setup.profile]
  );

  const applicableSetupItems = useMemo(
    () => getApplicableSetupItems(setup.profile, { previewAll: isSetupChecklistPreview }),
    [isSetupChecklistPreview, setup.profile]
  );

  const completedCount = useMemo(
    () => countCompletedItems(completion, applicableSetupItemIds),
    [applicableSetupItemIds, completion]
  );
  const allComplete = useMemo(
    () => isAllSetupComplete(completion, applicableSetupItemIds),
    [applicableSetupItemIds, completion]
  );

  const showWelcomeModal =
    !welcomeSuppressed &&
    !setup.loading &&
    (setup.isActivationEligible || isSetupChecklistPreview) &&
    !setup.profile.tutorial_dismissed_at;

  useEffect(() => {
    setTourBlocked(showWelcomeModal);
  }, [setTourBlocked, showWelcomeModal]);

  const showSetupChecklist =
    !showWelcomeModal &&
    !checklistDismissed &&
    (isSetupChecklistPreview ||
      setup.showSetupChecklist ||
      checklistManuallyOpen ||
      (checklistEngaged && !allComplete)) &&
    !setup.loading;

  const expandSetupChecklist = useCallback(() => {
    setChecklistEngaged(true);
    setExpandSetupChecklistRequest((count) => count + 1);
    setFocusChecklist(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
    }
  }, []);

  const collapseSetupChecklist = useCallback(
    (options?: { persist?: boolean }) => {
      setCollapseSetupChecklistRequest((count) => count + 1);
      if (options?.persist !== false && typeof window !== 'undefined') {
        window.localStorage.setItem(OA_CHECKLIST_COLLAPSED_KEY, 'true');
      }
      if (allComplete) {
        setChecklistManuallyOpen(false);
      }
    },
    [allComplete]
  );

  const navigateToSetupItem = useCallback(
    (id: SetupItemId) => {
      const path = getSetupItemNavigatePath(id);
      const focusSectionId = getSetupFocusSectionForItem(id);
      const targetPath = path.split('?')[0];
      const shouldFocus = shouldFocusSetupSection(id);

      if (shouldFocus && focusSectionId) {
        stashPendingSetupSectionFocus(focusSectionId);
      }

      if (shouldFocus && focusSectionId && location.pathname === targetPath) {
        window.dispatchEvent(
          new CustomEvent(SETUP_SECTION_FOCUS_EVENT, { detail: { sectionId: focusSectionId } })
        );
        return;
      }

      navigate(path);
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    registerQuickTourFinalCta(() =>
      allComplete
        ? { label: 'Done', route: '/merchant/openings' }
        : {
            label: 'Continue setup',
            route: `/merchant/openings?${SETUP_QUERY_PARAM}=${SETUP_TOUR_HANDOFF_VALUE}`,
          }
    );
  }, [allComplete, registerQuickTourFinalCta]);

  useEffect(() => {
    if (searchParams.get('setup') !== 'focus') return;
    setChecklistEngaged(true);
    expandSetupChecklist();
    const next = new URLSearchParams(searchParams);
    next.delete('setup');
    setSearchParams(next, { replace: true });
  }, [expandSetupChecklist, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get(SETUP_QUERY_PARAM) !== SETUP_TOUR_HANDOFF_VALUE) return;

    const next = new URLSearchParams(searchParams);
    next.delete(SETUP_QUERY_PARAM);
    setSearchParams(next, { replace: true });

    if (allComplete) return;

    let entranceClearTimer: number | undefined;
    const handoffTimer = window.setTimeout(() => {
      setChecklistEngaged(true);
      setChecklistHandoffEntrance(true);
      expandSetupChecklist();
      entranceClearTimer = window.setTimeout(() => setChecklistHandoffEntrance(false), 700);
    }, TOUR_CHECKLIST_HANDOFF_DELAY_MS);

    return () => {
      window.clearTimeout(handoffTimer);
      if (entranceClearTimer !== undefined) {
        window.clearTimeout(entranceClearTimer);
      }
    };
  }, [allComplete, expandSetupChecklist, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get(SETUP_CHECKLIST_PREVIEW_PARAM) !== 'preview') return;
    enableSetupChecklistPreview();
    setWelcomeSuppressed(false);
    setChecklistEngaged(true);
    expandSetupChecklist();
    void setup.refresh();
    const next = new URLSearchParams(searchParams);
    next.delete(SETUP_CHECKLIST_PREVIEW_PARAM);
    setSearchParams(next, { replace: true });
  }, [expandSetupChecklist, searchParams, setSearchParams, setup]);

  useEffect(() => {
    if (searchParams.get('tutorial') !== 'reset') return;
    clearChecklistDismissed();
    setChecklistDismissedRevision((value) => value + 1);
    setChecklistEngaged(true);
  }, [searchParams]);

  useEffect(() => {
    if (!focusChecklist) return;
    const timeoutId = window.setTimeout(() => setFocusChecklist(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [focusChecklist, expandSetupChecklistRequest]);

  const handleDismissWelcome = useCallback(async () => {
    setWelcomeSuppressed(true);
    await setup.dismissWelcome();
    setChecklistEngaged(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OA_CHECKLIST_COLLAPSED_KEY, 'true');
    }
  }, [setup]);

  const dismissSetupChecklist = useCallback(() => {
    persistChecklistDismissed();
    setChecklistDismissedRevision((value) => value + 1);
    setChecklistManuallyOpen(false);
    setChecklistEngaged(false);
  }, []);

  const openSetupChecklist = useCallback(async () => {
    clearChecklistDismissed();
    setChecklistDismissedRevision((value) => value + 1);
    setWelcomeSuppressed(true);
    setChecklistEngaged(true);
    setChecklistManuallyOpen(true);
    setReopenSetupChecklistRequest((count) => count + 1);
    expandSetupChecklist();

    await setup.dismissWelcome();

    if (allComplete) {
      return;
    }

    const firstIncomplete = isSetupChecklistPreview
      ? getFirstIncompleteSetupItem(completion, applicableSetupItemIds)
      : await setup.refresh({ silent: true });

    if (firstIncomplete) {
      navigate(getSetupItemNavigatePath(firstIncomplete));
    }
  }, [allComplete, applicableSetupItemIds, completion, expandSetupChecklist, isSetupChecklistPreview, navigate, setup]);

  const handleGetSetUp = openSetupChecklist;

  const handleShowMeAround = useCallback(async () => {
    setWelcomeSuppressed(true);
    await setup.dismissWelcome();
    startQuickTour();
  }, [setup, startQuickTour]);

  const markSetupItemComplete = useCallback(
    async (id: SetupItemId) => {
      await setup.markSetupItemComplete(id);
      setManualCompletionRevision((value) => value + 1);
    },
    [setup]
  );

  const markSetupItemIncomplete = useCallback(
    async (id: SetupItemId) => {
      await setup.markSetupItemIncomplete(id);
      setManualCompletionRevision((value) => value + 1);
    },
    [setup]
  );

  const value = useMemo<ActivationContextValue>(
    () => ({
      profile: setup.profile,
      completion,
      applicableSetupItems,
      completedCount,
      allComplete,
      showWelcomeModal,
      showSetupChecklist,
      loading: setup.loading,
      isSetupChecklistPreview,
      checklistHandoffEntrance,
      navigateToSetupItem,
      markSetupItemComplete,
      markSetupItemIncomplete,
      handleGetSetUp,
      openSetupChecklist,
      handleShowMeAround,
      handleDismissWelcome,
      refresh: setup.refresh,
      markQrEngaged: setup.markQrEngaged,
      focusChecklist,
      expandSetupChecklist,
      expandSetupChecklistRequest,
      reopenSetupChecklistRequest,
      collapseSetupChecklistRequest,
      dismissSetupChecklist,
    }),
    [
      allComplete,
      applicableSetupItems,
      checklistDismissed,
      collapseSetupChecklistRequest,
      completedCount,
      completion,
      expandSetupChecklist,
      expandSetupChecklistRequest,
      reopenSetupChecklistRequest,
      focusChecklist,
      dismissSetupChecklist,
      handleDismissWelcome,
      handleGetSetUp,
      openSetupChecklist,
      handleShowMeAround,
      checklistHandoffEntrance,
      markSetupItemComplete,
      markSetupItemIncomplete,
      isSetupChecklistPreview,
      navigateToSetupItem,
      setup,
      showSetupChecklist,
      showWelcomeModal,
    ]
  );

  return <ActivationContext.Provider value={value}>{children}</ActivationContext.Provider>;
}

export function useActivationContext(): ActivationContextValue {
  const context = useContext(ActivationContext);
  if (!context) {
    throw new Error('useActivationContext must be used within ActivationProvider');
  }
  return context;
}
