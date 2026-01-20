import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAppointmentPresets } from './useAppointmentPresets';
import { useDurationPresets } from './useDurationPresets';
import { useToast } from './use-toast';
import { useStripeCheckout } from './useSubscription';
import { 
  OnboardingStep, 
  detectBrowserTimezone,
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_DURATIONS
} from '@/types/onboarding';
import { getSeatCountForTeamSize } from '@/types/businessProfile';

interface TrialInfo {
  daysRemaining: number;
  trialEnd: string;
  planName: string;
}

interface PlanPricingInfo {
  planName: string;
  monthlyPrice: number | null;
  staffIncluded: number;
  staffAddonPrice: number | null;
  maxStaff: number | null;
  isUnlimitedStaff: boolean;
}

interface UseOnboardingReturn {
  currentStep: OnboardingStep;
  businessName: string;
  email: string;
  address: string;
  smsConsent: boolean;
  businessType: string;
  businessTypeOther: string;
  weeklyAppointments: string;
  teamSize: string;
  seatsCount: number;
  billingCadence: 'monthly' | 'annual';
  timezone: string;
  isLoading: boolean;
  isComplete: boolean;
  needsOnboarding: boolean | null;
  trialInfo: TrialInfo | null;
  planPricing: PlanPricingInfo | null;
  setBusinessName: (name: string) => void;
  setEmail: (email: string) => void;
  setAddress: (address: string) => void;
  setSmsConsent: (consent: boolean) => void;
  setBusinessType: (type: string) => void;
  setBusinessTypeOther: (value: string) => void;
  setWeeklyAppointments: (value: string) => void;
  setTeamSize: (value: string) => void;
  setSeatsCount: (value: number) => void;
  setBillingCadence: (value: 'monthly' | 'annual') => void;
  setTimezone: (tz: string) => void;
  nextStep: () => Promise<void>;
  prevStep: () => void;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export function useOnboarding(): UseOnboardingReturn {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const forceShow = searchParams.get('force') === 'true';
  const resetFlow = searchParams.get('reset') === 'true';
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [businessName, setBusinessName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [smsConsent, setSmsConsent] = useState<boolean>(false);
  const [businessType, setBusinessType] = useState<string>('');
  const [businessTypeOther, setBusinessTypeOther] = useState<string>('');
  const [weeklyAppointments, setWeeklyAppointments] = useState<string>('');
  const [teamSize, setTeamSize] = useState<string>('');
  const [seatsCount, setSeatsCount] = useState<number>(0);
  const [seatsCountManual, setSeatsCountManual] = useState(false);
  const [billingCadence, setBillingCadence] = useState<'monthly' | 'annual'>('annual');
  const [timezone, setTimezone] = useState<string>(detectBrowserTimezone());
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [planPricing, setPlanPricing] = useState<PlanPricingInfo | null>(null);

  const { createPreset: createAppointmentPreset } = useAppointmentPresets(user?.id);
  const { createPreset: createDurationPreset } = useDurationPresets(user?.id);
  const { createCheckout } = useStripeCheckout();

  const getSessionStep = () => {
    try {
      const stored = sessionStorage.getItem('onboarding-step');
      const step = Number(stored);
      return Number.isInteger(step) ? step : null;
    } catch {
      return null;
    }
  };

  const setSessionStep = (step: number) => {
    try {
      sessionStorage.setItem('onboarding-step', String(step));
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
  };

  const clearSessionStep = () => {
    try {
      sessionStorage.removeItem('onboarding-step');
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
  };

  const resetOnboardingProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (!error) {
        return;
      }

      const { error: resetError } = await supabase
        .from('profiles')
        .update({
          business_name: 'My Business',
          email: null,
          address: null,
          business_type: null,
          business_type_other: null,
          weekly_appointments: null,
          team_size: null,
          onboarding_step: null,
          onboarding_completed_at: null,
        })
        .eq('id', user.id);

      if (resetError) {
        const isMissingColumn = resetError.code === 'PGRST204'
          || resetError.message?.includes('does not exist')
          || resetError.message?.includes('schema cache');
        if (!isMissingColumn) {
          console.error('Error resetting onboarding profile:', resetError);
        }
      }
    } catch (error) {
      console.error('Error resetting onboarding profile:', error);
    }
  }, [user]);

  // Save step progress to database
  const saveStepProgress = useCallback(async (step: number) => {
    if (!user) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_step: step })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error saving step progress:', error);
    }
  }, [user]);

  const finalizeOnboarding = useCallback(async (silent?: boolean) => {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ 
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 4 // Beyond max step to indicate complete
      })
      .eq('id', user.id);
    
    clearSessionStep();
    setIsComplete(true);
    setNeedsOnboarding(false);
    
    if (!silent) {
      toast({
        title: "You're all set! 🎉",
        description: "Start by creating your first opening.",
      });
    }
    
    navigate('/merchant/openings');
  }, [user, navigate, toast]);

  // Fetch trial/subscription info
  const fetchTrialInfo = useCallback(async () => {
    if (!user) return;

    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*, plans(name)')
        .eq('merchant_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return;
      }

      if (subscription?.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        setTrialInfo({
          daysRemaining,
          trialEnd: subscription.trial_end,
          planName: (subscription.plans as any)?.name || 'Starter',
        });
      }

      if (!forceShow && subscription?.billing_provider && (subscription.status === 'trialing' || subscription.status === 'active')) {
        await finalizeOnboarding(true);
      }
    } catch (error) {
      console.error('Error fetching trial info:', error);
    }
  }, [user, finalizeOnboarding]);

  const fetchPlanPricing = useCallback(async () => {
    try {
    const { data: plan, error } = await supabase
        .from('plans')
        .select('name, monthly_price, staff_included, staff_addon_price, max_staff, is_unlimited_staff')
        .eq('id', 'starter')
        .maybeSingle();

      if (error) {
        console.error('Error fetching plan pricing:', error);
        return;
      }

      if (plan) {
        setPlanPricing({
          planName: plan.name || 'Starter',
          monthlyPrice: plan.monthly_price || null,
          staffIncluded: plan.staff_included || 1,
          staffAddonPrice: plan.staff_addon_price || null,
          maxStaff: plan.max_staff || null,
          isUnlimitedStaff: plan.is_unlimited_staff || false,
        });
      }
    } catch (error) {
      console.error('Error fetching plan pricing:', error);
    }
  }, []);

  // Check onboarding status on mount
  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch trial and plan info
        await Promise.all([fetchTrialInfo(), fetchPlanPricing()]);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at, onboarding_step, time_zone, business_name, email, address, business_type, business_type_other, weekly_appointments, team_size')
          .eq('id', user.id)
          .maybeSingle();

        let resolvedProfile = profile;
        if (error) {
          const isMissingColumn = error.code === 'PGRST204'
            || error.message?.includes('does not exist')
            || error.message?.includes('schema cache');
          if (isMissingColumn) {
            const { data: fallbackProfile, error: fallbackError } = await supabase
              .from('profiles')
              .select('onboarding_completed_at, onboarding_step, time_zone, business_name, email, address')
              .eq('id', user.id)
              .maybeSingle();

            if (fallbackError) {
              console.error('Onboarding status check error:', fallbackError.message, fallbackError.details);
            } else {
              resolvedProfile = fallbackProfile;
            }
          } else {
            console.error('Onboarding status check error:', error.message, error.details);
          }
        }

      if (resolvedProfile?.onboarding_completed_at && !forceShow) {
        // User has completed onboarding
        setNeedsOnboarding(false);
        setIsComplete(true);
      } else {
        // User needs onboarding (or we're forcing for testing)
        setNeedsOnboarding(true);
        if (forceShow) {
          setIsComplete(false);
        }
        // Resume from saved step if any
        const savedStep = (resolvedProfile?.onboarding_step || 0) as number;
        const sessionStep = getSessionStep();
        const billingState = searchParams.get('billing');
        const stepParam = Number(searchParams.get('step'));
        const shouldApplyUrlStep = (billingState || forceShow) && Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= 3;
        const nextStep = shouldApplyUrlStep
          ? Math.max(resetFlow ? 0 : savedStep, stepParam, resetFlow ? 0 : (sessionStep || 0))
          : Math.max(resetFlow ? 0 : savedStep, resetFlow ? 0 : (sessionStep || 0));

        if (nextStep >= 1 && nextStep <= 3) {
          setCurrentStep(nextStep as OnboardingStep);
          setSessionStep(nextStep);
          if (shouldApplyUrlStep && stepParam > savedStep) {
            await saveStepProgress(stepParam);
          }
        }
          // Load existing profile data if any
          if (resolvedProfile?.business_name && resolvedProfile.business_name !== 'My Business') {
            setBusinessName(resolvedProfile.business_name);
          }
          if (resolvedProfile?.email) {
            setEmail(resolvedProfile.email);
          }
          if (resolvedProfile?.address) {
            setAddress(resolvedProfile.address);
          }
          if ((resolvedProfile as any)?.business_type) {
            setBusinessType((resolvedProfile as any).business_type);
            if ((resolvedProfile as any).business_type === 'other' && (resolvedProfile as any).business_type_other) {
              setBusinessTypeOther((resolvedProfile as any).business_type_other);
            }
          }
          if ((resolvedProfile as any)?.weekly_appointments) {
            setWeeklyAppointments((resolvedProfile as any).weekly_appointments);
          }
          if ((resolvedProfile as any)?.team_size) {
            setTeamSize((resolvedProfile as any).team_size);
          }
          // Use saved timezone if set, otherwise detect
          if (resolvedProfile?.time_zone) {
            setTimezone(resolvedProfile.time_zone);
          }
        }
      } catch (error: any) {
        console.error('Error checking onboarding status:', error?.message || error);
        // If we can't check status, assume onboarding is needed for new users
        setNeedsOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    }

    checkOnboardingStatus();
  }, [user, fetchTrialInfo, fetchPlanPricing, searchParams, saveStepProgress]);

  useEffect(() => {
    if (!teamSize || seatsCountManual) return;
    const suggestedSeats = getSeatCountForTeamSize(teamSize);
    setSeatsCount(suggestedSeats);
  }, [teamSize, seatsCountManual]);

  // Save business details to profile
  const saveBusinessDetails = useCallback(async (overrides?: {
    businessName?: string;
    email?: string | null;
    address?: string | null;
    timezone?: string;
  }) => {
    if (!user) return;
    
    try {
      const nextBusinessName = (overrides?.businessName ?? businessName).trim() || 'My Business';
      const nextEmail = overrides?.email ?? (email.trim() || null);
      const nextAddress = overrides?.address ?? (address.trim() || null);
      const nextTimezone = overrides?.timezone ?? timezone;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          business_name: nextBusinessName,
          email: nextEmail,
          address: nextAddress,
          // Also save detected timezone during business details step
          time_zone: nextTimezone,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving business details:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving business details:', error);
      throw error;
    }
  }, [user, businessName, email, address, timezone]);

  const saveBusinessProfile = useCallback(async () => {
    if (!user) return;

    const trimmedOther = businessTypeOther.trim();
    const resolvedOther = businessType === 'other' ? trimmedOther || null : null;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          business_type: businessType || null,
          business_type_other: resolvedOther,
          weekly_appointments: weeklyAppointments || null,
          team_size: teamSize || null,
        })
        .eq('id', user.id);

      if (error) {
        const isMissingColumn = error.code === 'PGRST204'
          || error.message?.includes('does not exist')
          || error.message?.includes('schema cache');
        if (isMissingColumn) {
          console.warn('Business profile columns missing. Run the latest migration to enable saving.');
          return;
        }
        console.error('Error saving business profile:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving business profile:', error);
      throw error;
    }
  }, [user, businessType, businessTypeOther, weeklyAppointments, teamSize]);

  // Seed default presets
  const seedDefaultPresets = useCallback(async () => {
    if (!user) return;
    
    try {
      // Check if presets already exist
      const { data: existingTypes } = await supabase
        .from('appointment_type_presets')
        .select('id')
        .eq('merchant_id', user.id)
        .limit(1);
        
      const { data: existingDurations } = await supabase
        .from('duration_presets')
        .select('id')
        .eq('merchant_id', user.id)
        .limit(1);
      
      // Seed appointment types if none exist
      if (!existingTypes || existingTypes.length === 0) {
        for (const type of DEFAULT_APPOINTMENT_TYPES) {
          await createAppointmentPreset(type);
        }
      }
      
      // Seed durations if none exist
      if (!existingDurations || existingDurations.length === 0) {
        for (const duration of DEFAULT_DURATIONS) {
          await createDurationPreset(duration.label, duration.minutes);
        }
      }
    } catch (error) {
      console.error('Error seeding default presets:', error);
    }
  }, [user, createAppointmentPreset, createDurationPreset]);

  // Navigate to next step
  const nextStep = useCallback(async () => {
    const nextStepNum = Math.min(currentStep + 1, 3) as OnboardingStep;
    
    // Handle step-specific actions
    if (currentStep === 1) {
      // Save business details (including detected timezone) when leaving step 1
      setIsLoading(true);
      try {
        const normalizedEmail = email.trim();
        const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

        if (user && hasValidEmail) {
          const { data: profiles, error: lookupError } = await supabase
            .from('profiles')
            .select('id, phone')
            .ilike('email', normalizedEmail)
            .order('created_at', { ascending: true })
            .limit(1);

          if (lookupError) {
            console.error('Error checking email availability:', lookupError);
          } else {
            const existingProfile = profiles?.[0];
            if (existingProfile && existingProfile.id !== user.id && existingProfile.phone) {
              await resetOnboardingProfile();
              clearSessionStep();
              await supabase.auth.signOut();
              const encodedPhone = encodeURIComponent(existingProfile.phone);
              toast({
                title: "Account found",
                description: "We found your account. Check your phone to verify and continue.",
              });
              navigate(`/merchant/login?prefillPhone=${encodedPhone}&autoSend=true`, { replace: true });
              setIsLoading(false);
              return;
            }
          }
        }

        await saveBusinessDetails();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save business details. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    if (currentStep === 2) {
      // Save business profile and seed defaults when leaving step 2
      setIsLoading(true);
      try {
        await saveBusinessProfile();
        await seedDefaultPresets();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save your business profile. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    setCurrentStep(nextStepNum);
    await saveStepProgress(nextStepNum);
    setSessionStep(nextStepNum);
  }, [currentStep, email, navigate, resetOnboardingProfile, saveBusinessDetails, saveBusinessProfile, seedDefaultPresets, saveStepProgress, toast, user]);

  // Navigate to previous step
  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      const nextStep = (currentStep - 1) as OnboardingStep;
      setCurrentStep(nextStep);
      setSessionStep(nextStep);
    }
  }, [currentStep]);

  // Skip onboarding (use all defaults)
  const skipOnboarding = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Save browser-detected timezone
      await supabase
        .from('profiles')
        .update({ time_zone: timezone })
        .eq('id', user.id);
      
      // Seed default presets
      await seedDefaultPresets();
      
      // Mark as complete
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 4 // Beyond max step to indicate complete
        })
        .eq('id', user.id);
      
      setIsComplete(true);
      setNeedsOnboarding(false);
      
      toast({
        title: "Setup complete",
        description: "You can customize settings later from the Settings page.",
      });
      
      navigate('/merchant/openings');
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, timezone, seedDefaultPresets, navigate, toast]);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim();
      const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
      let finalEmail = normalizedEmail;

      if (!hasValidEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .maybeSingle();

        const profileEmail = (profile?.email || '').trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) {
          finalEmail = profileEmail;
          setEmail(profileEmail);
        }
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
        setCurrentStep(1);
        setSessionStep(1);
        await saveStepProgress(1);
        toast({
          title: "Email required",
          description: "Add a valid email to continue with billing setup.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      await saveBusinessDetails({ email: finalEmail });
      await saveStepProgress(3);
      setSessionStep(3);
      const successUrl = `${window.location.origin}/merchant/onboarding?billing=success&step=3`;
      const cancelUrl = `${window.location.origin}/merchant/onboarding?billing=canceled&step=3`;
      const resolvedSeats = seatsCount > 0 ? seatsCount : getSeatCountForTeamSize(teamSize);
      await createCheckout(
        'starter',
        finalEmail,
        { successUrl, cancelUrl, seatsCount: resolvedSeats, billingCadence }
      );
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to start billing setup. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  }, [user, email, createCheckout, toast, saveBusinessDetails, saveStepProgress, seatsCount, teamSize, billingCadence]);

  return {
    currentStep,
    businessName,
    email,
    address,
    smsConsent,
    businessType,
    businessTypeOther,
    weeklyAppointments,
    teamSize,
    seatsCount,
    billingCadence,
    timezone,
    isLoading,
    isComplete,
    needsOnboarding,
    trialInfo,
    planPricing,
    setBusinessName,
    setEmail,
    setAddress,
    setSmsConsent,
    setBusinessType,
    setBusinessTypeOther,
    setWeeklyAppointments,
    setTeamSize,
    setSeatsCount: (value: number) => {
      setSeatsCountManual(true);
      setSeatsCount(value);
    },
    setBillingCadence,
    setTimezone,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
  };
}
