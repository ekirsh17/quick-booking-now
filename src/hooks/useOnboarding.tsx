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

interface TrialInfo {
  daysRemaining: number;
  trialEnd: string;
  planName: string;
}

interface UseOnboardingReturn {
  currentStep: OnboardingStep;
  businessName: string;
  email: string;
  address: string;
  smsConsent: boolean;
  timezone: string;
  isLoading: boolean;
  isComplete: boolean;
  needsOnboarding: boolean | null;
  trialInfo: TrialInfo | null;
  setBusinessName: (name: string) => void;
  setEmail: (email: string) => void;
  setAddress: (address: string) => void;
  setSmsConsent: (consent: boolean) => void;
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
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [businessName, setBusinessName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [smsConsent, setSmsConsent] = useState<boolean>(false);
  const [timezone, setTimezone] = useState<string>(detectBrowserTimezone());
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);

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
        onboarding_step: 5 // Beyond max step to indicate complete
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

  // Check onboarding status on mount
  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch trial info
        await fetchTrialInfo();

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed_at, onboarding_step, time_zone, business_name, email, address')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Onboarding status check error:', error.message, error.details);
        }

      if (profile?.onboarding_completed_at && !forceShow) {
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
        const savedStep = (profile?.onboarding_step || 0) as number;
        const sessionStep = getSessionStep();
        const billingState = searchParams.get('billing');
        const stepParam = Number(searchParams.get('step'));
        const shouldApplyUrlStep = billingState && Number.isInteger(stepParam) && stepParam >= 1 && stepParam <= 4;
        const nextStep = shouldApplyUrlStep
          ? Math.max(savedStep, stepParam, sessionStep || 0)
          : Math.max(savedStep, sessionStep || 0);

        if (nextStep >= 1 && nextStep <= 4) {
          setCurrentStep(nextStep as OnboardingStep);
          setSessionStep(nextStep);
          if (shouldApplyUrlStep && stepParam > savedStep) {
            await saveStepProgress(stepParam);
          }
        }
          // Load existing profile data if any
          if (profile?.business_name && profile.business_name !== 'My Business') {
            setBusinessName(profile.business_name);
          }
          if (profile?.email) {
            setEmail(profile.email);
          }
          if (profile?.address) {
            setAddress(profile.address);
          }
          // Use saved timezone if set, otherwise detect
          if (profile?.time_zone) {
            setTimezone(profile.time_zone);
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
  }, [user, fetchTrialInfo, searchParams, saveStepProgress]);

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
    const nextStepNum = Math.min(currentStep + 1, 4) as OnboardingStep;
    
    // Handle step-specific actions
    if (currentStep === 2) {
      // Save business details (including detected timezone) when leaving step 2
      setIsLoading(true);
      try {
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
    
    if (currentStep === 3) {
      // Seed default presets when leaving step 3 (services)
      await seedDefaultPresets();
    }
    
    setCurrentStep(nextStepNum);
    await saveStepProgress(nextStepNum);
    setSessionStep(nextStepNum);
  }, [currentStep, saveBusinessDetails, seedDefaultPresets, saveStepProgress, toast]);

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
          onboarding_step: 5 // Beyond max step to indicate complete
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
        setCurrentStep(2);
        setSessionStep(2);
        await saveStepProgress(2);
        toast({
          title: "Email required",
          description: "Add a valid email to continue with billing setup.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      await saveBusinessDetails({ email: finalEmail });
      await saveStepProgress(4);
      setSessionStep(4);
      const successUrl = `${window.location.origin}/merchant/onboarding?billing=success&step=4`;
      const cancelUrl = `${window.location.origin}/merchant/onboarding?billing=canceled&step=4`;
      await createCheckout(
        'starter',
        finalEmail,
        { successUrl, cancelUrl }
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
  }, [user, email, createCheckout, toast, saveBusinessDetails, saveStepProgress]);

  return {
    currentStep,
    businessName,
    email,
    address,
    smsConsent,
    timezone,
    isLoading,
    isComplete,
    needsOnboarding,
    trialInfo,
    setBusinessName,
    setEmail,
    setAddress,
    setSmsConsent,
    setTimezone,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
  };
}
