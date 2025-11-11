import { useState, useEffect, useRef, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash/debounce";
import { AuthStrategy } from "@/utils/authStrategy";

export interface ConsumerAuthState {
  session: Session | null;
  consumerData: { name: string; phone: string } | null;
  isGuest: boolean;
  isCheckingPhone: boolean;
  showOtpInput: boolean;
  isNameAutofilled: boolean;
  showNameInput: boolean;
}

export interface ConsumerAuthActions {
  handlePhoneBlur: () => void;
  handlePhoneChange: (value: string | undefined) => void;
  handleVerifyOtp: (code: string) => Promise<boolean>;
  handleContinueAsGuest: () => Promise<void>;
  loadConsumerData: (userId: string) => Promise<void>;
}

interface UseConsumerAuthReturn {
  state: ConsumerAuthState;
  actions: ConsumerAuthActions;
  otpCode: string;
  setOtpCode: (code: string) => void;
}

interface UseConsumerAuthOptions {
  phone: string;
  onNameAutofill: (name: string) => void;
  authStrategy?: AuthStrategy;
}

/**
 * Unified consumer authentication hook for both Claim and Notify pages
 * Implements Phase 3: Context-Aware Progressive Authentication
 * 
 * Flow: Phone Entry → Strategy Check → Conditional OTP → Auto-Fill Name
 */
export const useConsumerAuth = (
  options: UseConsumerAuthOptions
): UseConsumerAuthReturn => {
  const { phone, onNameAutofill, authStrategy = 'otp_required' } = options;
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [consumerData, setConsumerData] = useState<{ name: string; phone: string } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isNameAutofilled, setIsNameAutofilled] = useState(false);
  const [originalGuestName, setOriginalGuestName] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  
  const isGuestRef = useRef(false);
  
  // Rate limiting: max 3 attempts per 5 minutes (300 seconds)
  const phoneCheckAttempts = useRef(0);
  const lastPhoneCheckTime = useRef(0);
  const MAX_ATTEMPTS = 3;
  const RATE_LIMIT_WINDOW = 300000; // 5 minutes in ms

  // Initialize session and auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && !isGuestRef.current) {
        loadConsumerData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user && !isGuestRef.current) {
        setTimeout(() => loadConsumerData(session.user.id), 0);
      } else if (!session?.user) {
        setConsumerData(null);
        setIsGuest(false);
        isGuestRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadConsumerData = async (userId: string) => {
    const { data } = await supabase
      .from('consumers')
      .select('name, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setConsumerData(data);
      onNameAutofill(data.name);
    }
  };

  const handleContinueAsGuest = async () => {
    await supabase.auth.signOut();
    setIsGuest(true);
    isGuestRef.current = true;
    setSession(null);
    setConsumerData(null);
  };

  const handlePhoneBlur = useCallback(
    debounce(async () => {
      if (phoneChecked || !phone || phone.replace(/\D/g, '').length < 10) return;
      
      // Rate limiting: max 3 attempts per 5 minutes
      const now = Date.now();
      if (now - lastPhoneCheckTime.current < RATE_LIMIT_WINDOW) {
        phoneCheckAttempts.current++;
        if (phoneCheckAttempts.current > MAX_ATTEMPTS) {
          toast({
            title: "Too many attempts",
            description: "Please wait 5 minutes before trying again.",
            variant: "destructive",
          });
          console.log(`[Auth] Rate limit exceeded for phone: ${phone}`);
          return;
        }
      } else {
        // Reset counter after rate limit window
        phoneCheckAttempts.current = 1;
      }
      lastPhoneCheckTime.current = now;
      
      setPhoneChecked(true);
      setIsCheckingPhone(true);
      setShowNameInput(false);
      
      console.log(`[Auth] Checking phone: ${phone}`);
      
      try {
        // Check for ANY consumer with this phone (guest OR authenticated)
        const { data: existingConsumer } = await supabase
          .from('consumers')
          .select('id, name, user_id, booking_count')
          .eq('phone', phone)
          .maybeSingle();
        
        if (existingConsumer) {
          console.log(`[Auth] Found existing consumer, has_account: ${!!existingConsumer.user_id}, strategy: ${authStrategy}`);
          
          if (existingConsumer.user_id) {
            // Authenticated user - check strategy
            if (authStrategy === 'none') {
              // Skip OTP entirely
              onNameAutofill(existingConsumer.name || "");
              setShowNameInput(true);
              toast({
                title: "Welcome back!",
                description: "Your information has been loaded.",
              });
            } else {
              // Send OTP (current behavior)
              toast({
                title: "Account found",
                description: "We'll send you a code to verify it's you",
              });
              
              const { error } = await supabase.functions.invoke('generate-otp', { 
                body: { phone } 
              });
              
              if (error) {
                console.error('[Auth] Failed to generate OTP:', error);
                toast({
                  title: "Error",
                  description: "Failed to send verification code. Please try again.",
                  variant: "destructive",
                });
                return;
              }
              
              console.log('[Auth] OTP sent successfully');
              setShowOtpInput(true);
              setShowNameInput(false);
            }
          } else {
            // Guest user - check strategy
            if (authStrategy === 'otp_required') {
              // Send OTP
              toast({
                title: "Verification needed",
                description: "We'll send you a code to verify it's you",
              });
              
              const { error } = await supabase.functions.invoke('generate-otp', { 
                body: { phone } 
              });
              
              if (error) {
                console.error('[Auth] Failed to generate OTP:', error);
                toast({
                  title: "Error",
                  description: "Failed to send verification code. Please try again.",
                  variant: "destructive",
                });
                return;
              }
              
              console.log('[Auth] OTP sent successfully');
              setShowOtpInput(true);
              setShowNameInput(false);
            } else {
              // Auto-fill without OTP
              onNameAutofill(existingConsumer.name || "");
              setIsNameAutofilled(true);
              setOriginalGuestName(existingConsumer.name);
              setShowNameInput(true);
              
              console.log(`[Auth] Auto-filled guest name: ${existingConsumer.name}`);
              toast({
                title: `Welcome back, ${existingConsumer.name}!`,
                description: "We've filled in your info.",
              });
            }
          }
        } else {
          console.log('[Auth] No existing consumer found - new user');
          setShowNameInput(true);
        }
      } catch (error) {
        console.error('[Auth] Error checking phone:', error);
        toast({
          title: "Error",
          description: "Failed to check phone number. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsCheckingPhone(false);
      }
    }, 300),
    [phone, phoneChecked, authStrategy, toast, onNameAutofill]
  );

  const handleVerifyOtp = async (code: string): Promise<boolean> => {
    if (code.length !== 6) return false;
    
    console.log('[Auth] Verifying OTP');
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, code }
      });
      
      if (error || !data.success) {
        console.error('[Auth] OTP verification failed:', error);
        throw new Error('Verification failed');
      }
      
      console.log('[Auth] OTP verified, setting session');
      
      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
      
      const { data: consumer } = await supabase
        .from('consumers')
        .select('name')
        .eq('phone', phone)
        .single();
      
      if (consumer) {
        onNameAutofill(consumer.name);
      }
      
      setShowOtpInput(false);
      setOtpCode("");
      setShowNameInput(true);
      
      toast({ title: "Signed in successfully" });
      console.log('[Auth] Sign in complete');
      return true;
    } catch (error) {
      console.error('[Auth] Error during OTP verification:', error);
      toast({ 
        title: "Verification failed", 
        description: "Invalid code. Please try again.",
        variant: "destructive" 
      });
      return false;
    }
  };

  const handlePhoneChange = (value: string | undefined) => {
    if (showOtpInput) {
      setShowOtpInput(false);
      setOtpCode("");
      setPhoneChecked(false);
    }
    if (showNameInput && !phoneChecked) {
      setShowNameInput(false);
    }
  };

  return {
    state: {
      session,
      consumerData,
      isGuest,
      isCheckingPhone,
      showOtpInput,
      isNameAutofilled,
      showNameInput,
    },
    actions: {
      handlePhoneBlur,
      handlePhoneChange,
      handleVerifyOtp,
      handleContinueAsGuest,
      loadConsumerData,
    },
    otpCode,
    setOtpCode,
  };
};
