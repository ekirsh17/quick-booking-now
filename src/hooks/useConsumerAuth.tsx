import { useState, useEffect, useRef, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabaseConsumer } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash/debounce";
import { AuthStrategy } from "@/utils/authStrategy";
import { normalizePhoneToE164 } from "@/utils/phoneValidation";

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

type AuthError = Error & { code?: string; retryAfterSeconds?: number };

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
  const authEnabled = authStrategy !== 'none';
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

  const toAuthError = (error: unknown): AuthError => {
    if (error instanceof Error) {
      return error as AuthError;
    }

    const message = typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message)
      : "Unknown error";

    const authError = new Error(message) as AuthError;
    if (typeof error === "object" && error && "code" in error) {
      authError.code = String((error as { code?: unknown }).code);
    }
    if (
      typeof error === "object" &&
      error &&
      "retryAfterSeconds" in error &&
      typeof (error as { retryAfterSeconds?: unknown }).retryAfterSeconds === "number"
    ) {
      authError.retryAfterSeconds = (error as { retryAfterSeconds: number }).retryAfterSeconds;
    }
    return authError;
  };

  const parseVerifyOtpInvokeError = async (error: unknown): Promise<AuthError> => {
    const authError = toAuthError(error);
    const context = (error as { context?: unknown } | null)?.context;

    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as {
          error?: string;
          code?: string;
          retryAfterSeconds?: number;
        };

        if (typeof payload.error === "string" && payload.error.length > 0) {
          authError.message = payload.error;
        }
        if (typeof payload.code === "string" && payload.code.length > 0) {
          authError.code = payload.code;
        }
        if (typeof payload.retryAfterSeconds === "number") {
          authError.retryAfterSeconds = payload.retryAfterSeconds;
        }
      } catch {
        // Non-JSON response bodies fall back to the default error message.
      }

      if (!authError.code && context.status === 429) {
        authError.code = "OTP_LOCKED";
      }
    }

    return authError;
  };
  
  const isGuestRef = useRef(false);
  
  // Rate limiting: max 3 attempts per 5 minutes (300 seconds)
  const phoneCheckAttempts = useRef(0);
  const lastPhoneCheckTime = useRef(0);
  const MAX_ATTEMPTS = 3;
  const RATE_LIMIT_WINDOW = 300000; // 5 minutes in ms

  // Initialize session and auth listener
  useEffect(() => {
    if (!authEnabled) {
      setSession(null);
      setConsumerData(null);
      setIsGuest(false);
      isGuestRef.current = false;
      return;
    }

    supabaseConsumer.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && !isGuestRef.current) {
        loadConsumerData(session.user.id);
      }
    });

    const { data: { subscription } } = supabaseConsumer.auth.onAuthStateChange((event, session) => {
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
  }, [authEnabled]);

  const loadConsumerData = async (userId: string) => {
    const { data } = await supabaseConsumer
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
    if (authEnabled && session && !isGuestRef.current) {
      await supabaseConsumer.auth.signOut({ scope: 'local' });
    }
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
            description: "Please wait 5 minutes before trying again",
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
        // Normalize phone to E.164 format before database query to ensure consistent matching
        let normalizedPhone: string;
        try {
          normalizedPhone = normalizePhoneToE164(phone);
        } catch (normalizationError: unknown) {
          const normalizationMessage = normalizationError instanceof Error
            ? normalizationError.message
            : "Please enter a valid phone number";
          console.error('[Auth] Phone normalization error:', normalizationError);
          toast({
            title: "Invalid phone number",
            description: normalizationMessage,
            variant: "destructive",
          });
          return;
        }
        
        type ConsumerAuthStatusRow = {
          consumer_id: string;
          consumer_name: string | null;
          has_account: boolean;
          booking_count: number | null;
        };

        // Use RPC to avoid direct anonymous reads on consumers.
        const { data: authStatusRows, error: authStatusError } = await supabaseConsumer.rpc(
          'get_consumer_auth_status',
          { p_phone: normalizedPhone }
        );

        if (authStatusError) {
          throw authStatusError;
        }

        const existingConsumer = (authStatusRows?.[0] as ConsumerAuthStatusRow | undefined) ?? null;
        
        if (existingConsumer) {
          console.log(`[Auth] Found existing consumer, has_account: ${existingConsumer.has_account}, strategy: ${authStrategy}`);
          
          if (existingConsumer.has_account) {
            // Authenticated user - check strategy
            if (authStrategy === 'none') {
              // Skip OTP entirely
              onNameAutofill(existingConsumer.consumer_name || "");
              setShowNameInput(true);
              toast({
                title: "Welcome back",
                description: "Your information has been loaded",
              });
            } else {
              // Send OTP (current behavior)
              toast({
                title: "Account found",
                description: "We'll send you a code to verify it's you",
              });
              
              const { error } = await supabaseConsumer.functions.invoke('generate-otp', { 
                body: { phone: normalizedPhone } 
              });
              
              if (error) {
                console.error('[Auth] Failed to generate OTP:', error);
                toast({
                  title: "Error",
                  description: "Failed to send verification code. Please try again",
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
              
              const { error } = await supabaseConsumer.functions.invoke('generate-otp', { 
                body: { phone: normalizedPhone } 
              });
              
              if (error) {
                console.error('[Auth] Failed to generate OTP:', error);
                toast({
                  title: "Error",
                  description: "Failed to send verification code. Please try again",
                  variant: "destructive",
                });
                return;
              }
              
              console.log('[Auth] OTP sent successfully');
              setShowOtpInput(true);
              setShowNameInput(false);
            } else {
              // Auto-fill without OTP
              const displayName = existingConsumer.consumer_name || "";
              onNameAutofill(displayName);
              setIsNameAutofilled(true);
              setOriginalGuestName(displayName || null);
              setShowNameInput(true);
              
              console.log(`[Auth] Auto-filled guest name: ${displayName}`);
              toast({
                title: displayName ? `Welcome back, ${displayName}!` : "Welcome back!",
                description: "We've filled in your info",
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
          description: "Failed to check phone number. Please try again",
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
      // Normalize phone before sending to edge function
      const normalizedPhone = normalizePhoneToE164(phone);
      const { data, error } = await supabaseConsumer.functions.invoke('verify-otp', {
        body: { phone: normalizedPhone, code }
      });
      
      if (error) {
        console.error('[Auth] OTP verification failed:', error);
        throw await parseVerifyOtpInvokeError(error);
      }

      if (!data?.success) {
        const authError = new Error(data?.error || 'Verification failed') as AuthError;
        if (typeof data?.code === 'string') authError.code = data.code;
        if (typeof data?.retryAfterSeconds === 'number') authError.retryAfterSeconds = data.retryAfterSeconds;
        throw authError;
      }
      
      console.log('[Auth] OTP verified, setting session');
      
      await supabaseConsumer.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });
      
      const { data: authStatusRows, error: authStatusError } = await supabaseConsumer.rpc(
        'get_consumer_auth_status',
        { p_phone: normalizedPhone }
      );

      if (authStatusError) {
        console.warn('[Auth] Unable to fetch consumer profile after OTP verify:', authStatusError);
      }

      const consumer = authStatusRows?.[0] as { consumer_name?: string | null } | undefined;
      if (consumer?.consumer_name) {
        onNameAutofill(consumer.consumer_name);
      }
      
      setShowOtpInput(false);
      setOtpCode("");
      setShowNameInput(true);
      
      toast({ title: "Signed in successfully" });
      console.log('[Auth] Sign in complete');
      return true;
    } catch (error: unknown) {
      const authError = toAuthError(error);
      const isLocked = authError.code === 'OTP_LOCKED';
      console.error('[Auth] Error during OTP verification:', error);
      toast({ 
        title: isLocked ? "Too many attempts" : "Verification failed",
        description: isLocked
          ? "Too many incorrect codes. Request a new verification code to continue."
          : "Invalid code. Please try again",
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
