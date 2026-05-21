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
  hasBookingSystem: boolean;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const stepsPathA: TourStepDef[] = [
  {
    id: 'openings',
    route: '/merchant/openings',
    targetAttr: 'new-opening-btn',
    preferredSide: 'bottom',
    icon: Plus,
    title: 'Post openings here',
    body: 'When you have a slot available, tap this to add it. Your waitlist gets a text the moment you publish.',
    note: 'You can also text your business number — e.g. "my 2pm is open"',
  },
  {
    id: 'qr-code',
    route: '/merchant/qr-code',
    targetAttr: 'qr-code-display',
    preferredSide: 'bottom',
    icon: QrCode,
    title: 'Your QR code grows your waitlist',
    body: 'Print this and display it in your shop. Customers scan to join your waitlist. Share the link for phone customers too.',
  },
  {
    id: 'waitlist',
    route: '/merchant/waitlist',
    targetAttr: 'waitlist-list',
    preferredSide: 'top',
    icon: Bell,
    title: 'Your waitlist',
    body: 'Everyone who joins via QR code appears here. Empty for now — it fills up as you go.',
  },
  {
    id: 'reporting',
    route: '/merchant/analytics',
    targetAttr: 'reporting-overview',
    preferredSide: 'bottom',
    icon: BarChart3,
    title: 'Track your results',
    body: 'See filled slots and estimated revenue recovered. The more you use OpenAlert, the more it shows.',
  },
  {
    id: 'staff-locations',
    route: '/merchant/settings/staff-locations',
    targetAttr: 'staff-locations-content',
    preferredSide: 'right',
    icon: Users,
    title: 'Manage your team & locations',
    body: 'Add staff members and locations here. Each location gets its own QR code and waitlist. Seats are shared across all locations.',
  },
  {
    id: 'booking-rules',
    route: '/merchant/settings/business',
    targetAttr: 'booking-rules-auto-openings',
    fallbackTargetAttr: 'booking-rules-section',
    preferredSide: 'bottom',
    icon: Mail,
    title: 'Auto-detect cancellations',
    body: 'Turn on Auto-create openings from cancellations so we detect cancels and post openings for you.',
    note: "After enabling, copy the Forwarding Address into your booking platform's notification settings. If you don't see it, turn on Use External Booking System first.",
    isFinal: true,
    finalCtaLabel: 'Create first opening',
    finalCtaRoute: '/merchant/openings?action=create',
  },
];

const stepsPathB: TourStepDef[] = [
  {
    id: 'openings',
    route: '/merchant/openings',
    targetAttr: 'new-opening-btn',
    preferredSide: 'bottom',
    icon: Plus,
    title: 'Post openings here',
    body: 'When you have a slot available, tap this to add it. Your waitlist gets a text instantly.',
    note: 'You can also text your business number — e.g. "my 2pm is open"',
  },
  {
    id: 'qr-code',
    route: '/merchant/qr-code',
    targetAttr: 'qr-code-display',
    preferredSide: 'bottom',
    icon: QrCode,
    title: 'Your QR code grows your waitlist',
    body: 'Print this and display it in your shop. Customers scan to join your waitlist. Share the link for phone customers too.',
  },
  {
    id: 'waitlist',
    route: '/merchant/waitlist',
    targetAttr: 'waitlist-list',
    preferredSide: 'top',
    icon: Bell,
    title: 'Your waitlist',
    body: 'Everyone who joins via QR code appears here. Empty for now — it fills up as you go.',
  },
  {
    id: 'reporting',
    route: '/merchant/analytics',
    targetAttr: 'reporting-overview',
    preferredSide: 'bottom',
    icon: BarChart3,
    title: 'Track your results',
    body: 'See filled slots and estimated revenue recovered. The more you use OpenAlert, the more it shows.',
  },
  {
    id: 'staff-locations',
    route: '/merchant/settings/staff-locations',
    targetAttr: 'staff-locations-content',
    preferredSide: 'right',
    icon: Users,
    title: 'Manage your team & locations',
    body: 'Add staff members and locations here. Each location gets its own QR code and waitlist. Seats are shared across all locations.',
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
  const [hasBookingSystem, setHasBookingSystem] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasInitializedRoute, setHasInitializedRoute] = useState(false);

  const steps = useMemo(
    () => (hasBookingSystem ? stepsPathA : stepsPathB),
    [hasBookingSystem]
  );

  const fetchTourProfile = useCallback(async () => {
    if (!user?.id) {
      setTourSeenAt(null);
      setOnboardingCompletedAt(null);
      setHasBookingSystem(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('booking_system_provider, tutorial_tour_seen_at, onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to load tour profile data:', profileError);
      setIsLoading(false);
      return;
    }

    const bookingSystemProvider = profileData?.booking_system_provider ?? null;
    const resolvedHasBookingSystem = Boolean(bookingSystemProvider);

    setTourSeenAt(profileData?.tutorial_tour_seen_at ?? null);
    setOnboardingCompletedAt(profileData?.onboarding_completed_at ?? null);
    setHasBookingSystem(resolvedHasBookingSystem);
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
      const step = steps[stepIndex];
      if (!step) return;
      if (location.pathname !== step.route) {
        navigate(step.route);
      }
    },
    [location.pathname, navigate, steps]
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
    const currentStep = steps[currentStepIndex];
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
  }, [currentStepIndex, markTourSeen, navigate, navigateToStep, steps]);

  const back = useCallback(() => {
    if (currentStepIndex <= 0) return;
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    navigateToStep(prevIndex);
  }, [currentStepIndex, navigateToStep]);

  const currentStep = steps[currentStepIndex] ?? null;

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      isLoading,
      currentStepIndex,
      currentStep,
      steps,
      hasBookingSystem,
      next,
      back,
      skip,
    }),
    [back, currentStep, currentStepIndex, hasBookingSystem, isActive, isLoading, next, skip, steps]
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
