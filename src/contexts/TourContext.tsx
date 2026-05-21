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
  preferredSide: 'top' | 'bottom' | 'left' | 'right';
  icon: LucideIcon;
  title: string;
  body: string;
  note?: string;
  showEmailCopy?: boolean;
  isFinal?: boolean;
  finalCtaLabel?: string;
  finalCtaRoute?: string;
}

interface TourContextValue {
  isActive: boolean;
  isLoading: boolean;
  currentStepIndex: number;
  steps: TourStepDef[];
  hasBookingSystem: boolean;
  inboundEmailAddress: string | null;
  next: () => void;
  back: () => void;
  skip: () => void;
}

const HIGHLIGHT_CLASSES = [
  'ring-2',
  'ring-primary',
  'ring-offset-2',
  'rounded-[inherit]',
  'relative',
  'z-[51]',
  'transition-shadow',
] as const;

export const TOUR_HIGHLIGHT_CLASSES = HIGHLIGHT_CLASSES;

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
    preferredSide: 'left',
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
    targetAttr: 'reporting-metrics',
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
    targetAttr: 'booking-rules-section',
    preferredSide: 'top',
    icon: Mail,
    title: 'Auto-detect cancellations',
    body: "Add this email in your booking platform's notification settings — we'll open the slot automatically when anyone cancels.",
    showEmailCopy: true,
    note: 'Then enable "Auto-create openings on cancellation" in Booking Rules.',
    isFinal: true,
    finalCtaLabel: 'Done — create my first opening',
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
    preferredSide: 'left',
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
    targetAttr: 'reporting-metrics',
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
    finalCtaLabel: 'Done — create my first opening',
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
  const [inboundEmailAddress, setInboundEmailAddress] = useState<string | null>(null);
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
      setInboundEmailAddress(null);
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

    if (resolvedHasBookingSystem) {
      const { data: inboundData, error: inboundError } = await supabase.rpc('ensure_inbound_email');
      if (inboundError) {
        console.error('Failed to load inbound email for tour:', inboundError);
        setInboundEmailAddress(null);
      } else {
        const inboundConfig = Array.isArray(inboundData) ? inboundData[0] : inboundData;
        setInboundEmailAddress(inboundConfig?.inbound_email_address ?? null);
      }
    } else {
      setInboundEmailAddress(null);
    }

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

  const value = useMemo<TourContextValue>(
    () => ({
      isActive,
      isLoading,
      currentStepIndex,
      steps,
      hasBookingSystem,
      inboundEmailAddress,
      next,
      back,
      skip,
    }),
    [
      back,
      currentStepIndex,
      hasBookingSystem,
      inboundEmailAddress,
      isActive,
      isLoading,
      next,
      skip,
      steps,
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
