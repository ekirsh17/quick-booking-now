/*
 * Audit (tour + checklist):
 * - SetupChecklist lives at src/components/merchant/activation/SetupChecklist.tsx, rendered in
 *   MerchantLayout above the page outlet (not inside Openings.tsx). It uses ActivationContext only.
 * - TourContext exposes isActive (aliased as isTourActive); no checklist awareness until this change.
 * - Auto-start uses localStorage key oa_tour_seen (once per browser); DB tutorial_tour_seen_at unchanged for skip/complete.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, Bell, Mail, Plus, QrCode, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const OA_TOUR_SEEN_KEY = 'oa_tour_seen';

export interface TourStepDef {
  id: string;
  route: string;
  targetAttr: string;
  fallbackTargetAttr?: string;
  skipScrollIntoView?: boolean;
  scrollBlock?: ScrollLogicalPosition;
  icon: LucideIcon;
  title: string;
  body: string;
  note?: string;
  isFinal?: boolean;
}

export interface QuickTourFinalCta {
  label: string;
  route: string;
}

interface TourContextValue {
  isActive: boolean;
  isTourActive: boolean;
  isLoading: boolean;
  isTourBlocked: boolean;
  currentStepIndex: number;
  currentStep: TourStepDef | null;
  steps: TourStepDef[];
  next: () => void;
  back: () => void;
  skip: () => void;
  startQuickTour: () => void;
  restartQuickTour: () => Promise<void>;
  setTourBlocked: (blocked: boolean) => void;
  registerQuickTourFinalCta: (resolver: () => QuickTourFinalCta) => void;
  getQuickTourFinalCtaLabel: () => string;
}

const QUICK_TOUR_STEPS: TourStepDef[] = [
  {
    id: 'openings',
    route: '/merchant/openings',
    targetAttr: 'new-opening-btn',
    icon: Plus,
    title: 'Add openings here',
    body: 'Easily add any openings that come up and your waitlist gets notified right away. If you use a booking platform, you can automate this entirely. We\'ll show you how.',
    note: 'You can also text your business number, e.g. "my 2pm is open"',
  },
  {
    id: 'qr-code',
    route: '/merchant/qr-code',
    targetAttr: 'qr-code-display',
    skipScrollIntoView: true,
    icon: QrCode,
    title: 'Your QR code grows your waitlist',
    body: 'Show this in your shop so walk-ins can join. Share the link for phone customers.',
  },
  {
    id: 'waitlist',
    route: '/merchant/waitlist',
    targetAttr: 'waitlist-list',
    icon: Bell,
    title: 'View your waitlist',
    body: 'Everyone who joins via QR or your link shows up here.',
  },
  {
    id: 'reporting',
    route: '/merchant/analytics',
    targetAttr: 'reporting-overview',
    skipScrollIntoView: true,
    icon: BarChart3,
    title: 'Track your results',
    body: 'See bookings filled and revenue recovered over time.',
  },
  {
    id: 'staff-locations',
    route: '/merchant/settings/staff-locations',
    targetAttr: 'staff-locations-content',
    icon: Users,
    title: 'Manage your team and locations',
    body: 'Add locations and staff. Each location gets its own QR and waitlist.',
  },
  {
    id: 'booking-rules',
    route: '/merchant/settings/business',
    targetAttr: 'booking-rules-section',
    icon: Mail,
    title: 'Fill slots from cancellations',
    body: 'Connect your booking platform here and cancellations automatically become openings. Set it once and the system handles the rest.',
    isFinal: true,
  },
];

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [, setTourSeenAt] = useState<string | null>(null);
  const [isQuickTourActive, setIsQuickTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasInitializedRoute, setHasInitializedRoute] = useState(false);
  const [isTourBlocked, setIsTourBlocked] = useState(false);

  const finalCtaResolverRef = useRef<() => QuickTourFinalCta>(() => ({
    label: 'Continue setup',
    route: '/merchant/openings?setup=handoff',
  }));

  const fetchTourProfile = useCallback(async () => {
    if (!user?.id) {
      setTourSeenAt(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('tutorial_tour_seen_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load tour profile data:', profileError);
      setIsLoading(false);
      return;
    }

    setTourSeenAt(profileData?.tutorial_tour_seen_at ?? null);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchTourProfile();
  }, [fetchTourProfile]);

  const resetTourSeenState = useCallback(async () => {
    if (!user?.id) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ tutorial_tour_seen_at: null })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to reset quick tour:', error);
      return false;
    }

    setTourSeenAt(null);
    await fetchTourProfile();
    return true;
  }, [fetchTourProfile, user?.id]);

  useEffect(() => {
    if (!user?.id || searchParams.get('tutorial') !== 'reset') return;

    const resetFromUrlParam = async () => {
      const reset = await resetTourSeenState();
      if (!reset) return;

      setSearchParams({}, { replace: true });
      setCurrentStepIndex(0);
      setHasInitializedRoute(false);
      setIsQuickTourActive(true);
    };

    void resetFromUrlParam();
  }, [resetTourSeenState, searchParams, setSearchParams, user?.id]);

  const isActive = isQuickTourActive && !isLoading && !isTourBlocked;
  const isTourActive = isActive;

  const setTourBlocked = useCallback((blocked: boolean) => {
    setIsTourBlocked(blocked);
  }, []);

  const markTourSeen = useCallback(async () => {
    if (!user?.id) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ tutorial_tour_seen_at: now })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to mark tutorial tour seen:', error);
      return;
    }

    setTourSeenAt(now);
  }, [user?.id]);

  const stopQuickTour = useCallback(() => {
    setIsQuickTourActive(false);
    setHasInitializedRoute(false);
    setCurrentStepIndex(0);
  }, []);

  const startQuickTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OA_TOUR_SEEN_KEY, 'true');
    }
    setCurrentStepIndex(0);
    setHasInitializedRoute(false);
    setIsQuickTourActive(true);
  }, []);

  const finishTour = useCallback(() => {
    void (async () => {
      await markTourSeen();
      const finalCta = finalCtaResolverRef.current();
      stopQuickTour();
      window.setTimeout(() => {
        navigate(finalCta.route);
      }, 280);
    })();
  }, [markTourSeen, navigate, stopQuickTour]);

  const restartQuickTour = useCallback(async () => {
    const reset = await resetTourSeenState();
    if (!reset) return;

    setCurrentStepIndex(0);
    setHasInitializedRoute(false);
    startQuickTour();
  }, [resetTourSeenState, startQuickTour]);

  const registerQuickTourFinalCta = useCallback((resolver: () => QuickTourFinalCta) => {
    finalCtaResolverRef.current = resolver;
  }, []);

  const getQuickTourFinalCtaLabel = useCallback(
    () => finalCtaResolverRef.current().label,
    []
  );

  const navigateToStep = useCallback(
    (stepIndex: number) => {
      const step = QUICK_TOUR_STEPS[stepIndex];
      if (!step) return;
      if (location.pathname !== step.route) {
        navigate(step.route);
      }
    },
    [location.pathname, navigate]
  );

  useEffect(() => {
    if (!isActive || hasInitializedRoute) return;
    setCurrentStepIndex(0);
    navigateToStep(0);
    setHasInitializedRoute(true);
  }, [hasInitializedRoute, isActive, navigateToStep]);

  useEffect(() => {
    if (!isQuickTourActive) {
      setHasInitializedRoute(false);
      setCurrentStepIndex(0);
    }
  }, [isQuickTourActive]);

  const skip = useCallback(() => {
    finishTour();
  }, [finishTour]);

  const next = useCallback(() => {
    const currentStep = QUICK_TOUR_STEPS[currentStepIndex];
    if (!currentStep) return;

    if (currentStep.isFinal) {
      finishTour();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);
    navigateToStep(nextIndex);
  }, [currentStepIndex, navigateToStep]);

  const back = useCallback(() => {
    if (currentStepIndex <= 0) return;
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    navigateToStep(prevIndex);
  }, [currentStepIndex, navigateToStep]);

  const currentStep = QUICK_TOUR_STEPS[currentStepIndex] ?? null;

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      isTourActive,
      isLoading,
      isTourBlocked,
      currentStepIndex,
      currentStep,
      steps: QUICK_TOUR_STEPS,
      next,
      back,
      skip,
      startQuickTour,
      restartQuickTour,
      setTourBlocked,
      registerQuickTourFinalCta,
      getQuickTourFinalCtaLabel,
    }),
    [
      back,
      currentStep,
      currentStepIndex,
      getQuickTourFinalCtaLabel,
      isActive,
      isTourActive,
      isTourBlocked,
      isLoading,
      next,
      registerQuickTourFinalCta,
      setTourBlocked,
      skip,
      startQuickTour,
      restartQuickTour,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTourContext(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTourContext must be used within TourProvider');
  }
  return context;
}

/** Alias for consumers that expect `useTour`. */
export function useTour(): TourContextValue {
  return useTourContext();
}
