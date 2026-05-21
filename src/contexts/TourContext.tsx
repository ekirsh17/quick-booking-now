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
import {
  BarChart3,
  Bell,
  Mail,
  Plus,
  QrCode,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TourStepDef {
  id: string;
  route: string;
  targetAttr: string;
  fallbackTargetAttr?: string;
  preferredSide: 'top' | 'bottom' | 'left' | 'right';
  icon: LucideIcon;
  title: string;
  body: string;
  note?: string;
  isFinal?: boolean;
  finalCtaLabel?: string;
  finalCtaRoute?: string;
}

interface TourContextValue {
  isActive: boolean;
  isLoading: boolean;
  currentStepIndex: number;
  currentStep: TourStepDef | null;
  steps: TourStepDef[];
  next: () => void;
  back: () => void;
  skip: () => void;
}

const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'openings',
    route: '/merchant/openings',
    targetAttr: 'new-opening-btn',
    preferredSide: 'bottom',
    icon: Plus,
    title: 'Post openings here',
    body: 'When a slot opens up, tap here to publish it. Your waitlist is notified right away.',
    note: 'You can also text your business number, e.g. "my 2pm is open"',
  },
  {
    id: 'qr-code',
    route: '/merchant/qr-code',
    targetAttr: 'qr-code-display',
    preferredSide: 'bottom',
    icon: QrCode,
    title: 'Your QR code grows your waitlist',
    body: 'Show this in your shop so walk-ins can join. Share the link for phone customers.',
  },
  {
    id: 'waitlist',
    route: '/merchant/waitlist',
    targetAttr: 'waitlist-list',
    preferredSide: 'top',
    icon: Bell,
    title: 'View your waitlist',
    body: 'Everyone who joins via QR or your link shows up here.',
  },
  {
    id: 'reporting',
    route: '/merchant/analytics',
    targetAttr: 'reporting-overview',
    preferredSide: 'bottom',
    icon: BarChart3,
    title: 'Track your results',
    body: 'See bookings filled and revenue recovered over time.',
  },
  {
    id: 'staff-locations',
    route: '/merchant/settings/staff-locations',
    targetAttr: 'staff-locations-content',
    preferredSide: 'right',
    icon: Users,
    title: 'Manage your team and locations',
    body: 'Add locations and staff. Each location gets its own QR and waitlist.',
  },
  {
    id: 'booking-rules',
    route: '/merchant/settings/business',
    targetAttr: 'booking-rules-section',
    preferredSide: 'bottom',
    icon: Mail,
    title: 'Fill slots from cancellations',
    body: 'Link your booking app below. Cancellations turn into openings automatically.',
    isFinal: true,
    finalCtaLabel: 'Create first opening',
    finalCtaRoute: '/merchant/openings?action=create',
  },
];

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [tourSeenAt, setTourSeenAt] = useState<string | null>(null);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasInitializedRoute, setHasInitializedRoute] = useState(false);

  const fetchTourProfile = useCallback(async () => {
    if (!user?.id) {
      setTourSeenAt(null);
      setOnboardingCompletedAt(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('tutorial_tour_seen_at, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load tour profile data:', profileError);
      setIsLoading(false);
      return;
    }

    setTourSeenAt(profileData?.tutorial_tour_seen_at ?? null);
    setOnboardingCompletedAt(profileData?.onboarding_completed_at ?? null);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchTourProfile();
  }, [fetchTourProfile]);

  useEffect(() => {
    if (!user?.id || searchParams.get('tutorial') !== 'reset') return;

    const resetFromUrlParam = async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ tutorial_tour_seen_at: null })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to reset tour from URL param:', error);
        return;
      }

      setSearchParams({}, { replace: true });
      setCurrentStepIndex(0);
      setHasInitializedRoute(false);
      await fetchTourProfile();
    };

    void resetFromUrlParam();
  }, [fetchTourProfile, searchParams, setSearchParams, user?.id]);

  const isActive = Boolean(onboardingCompletedAt && !tourSeenAt && !isLoading);

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

  const navigateToStep = useCallback(
    (stepIndex: number) => {
      const step = TOUR_STEPS[stepIndex];
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
    if (!isActive) {
      setHasInitializedRoute(false);
      setCurrentStepIndex(0);
    }
  }, [isActive]);

  const skip = useCallback(() => {
    void (async () => {
      await markTourSeen();
    })();
  }, [markTourSeen]);

  const next = useCallback(() => {
    const currentStep = TOUR_STEPS[currentStepIndex];
    if (!currentStep) return;

    if (currentStep.isFinal) {
      void (async () => {
        await markTourSeen();
        if (currentStep.finalCtaRoute) {
          navigate(currentStep.finalCtaRoute);
        }
      })();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);
    navigateToStep(nextIndex);
  }, [currentStepIndex, markTourSeen, navigate, navigateToStep]);

  const back = useCallback(() => {
    if (currentStepIndex <= 0) return;
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    navigateToStep(prevIndex);
  }, [currentStepIndex, navigateToStep]);

  const currentStep = TOUR_STEPS[currentStepIndex] ?? null;

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      isLoading,
      currentStepIndex,
      currentStep,
      steps: TOUR_STEPS,
      next,
      back,
      skip,
    }),
    [back, currentStep, currentStepIndex, isActive, isLoading, next, skip]
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
