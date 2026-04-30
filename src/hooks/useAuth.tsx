import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type UserType = 'merchant' | 'consumer' | null;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ConsumerRow = Database["public"]["Tables"]["consumers"]["Row"];
type UserProfile = ProfileRow | ConsumerRow | null;
type AuthError = Error & { code?: string; retryAfterSeconds?: number };
const OTP_COOLDOWN_SECONDS = 30;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userType: UserType;
  userProfile: UserProfile;
  sendOtp: (phone: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  completeMerchantSignup: (businessName: string, phone: string, address?: string) => Promise<{ error: AuthError | null }>;
  completeConsumerSignup: (name: string, phone: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);
  const { toast } = useToast();

  const toAuthError = (error: unknown): AuthError => {
    if (error instanceof Error) {
      return error as AuthError;
    }
    const message = typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'Unknown error';
    const authError = new Error(message) as AuthError;
    if (typeof error === 'object' && error && 'code' in error) {
      authError.code = String((error as { code?: unknown }).code);
    }
    if (
      typeof error === 'object' &&
      error &&
      'retryAfterSeconds' in error &&
      typeof (error as { retryAfterSeconds?: unknown }).retryAfterSeconds === 'number'
    ) {
      authError.retryAfterSeconds = (error as { retryAfterSeconds: number }).retryAfterSeconds;
    }
    return authError;
  };

  const parseGenerateOtpInvokeError = async (error: unknown): Promise<AuthError> => {
    const authError = toAuthError(error);
    const context = (error as { context?: unknown } | null)?.context;
    const extractRetryAfterSeconds = (message: string): number | null => {
      const secondsMatch = message.match(/(\d+)\s*(s|sec|second)/i);
      if (secondsMatch) {
        return Math.min(Number.parseInt(secondsMatch[1], 10), OTP_COOLDOWN_SECONDS);
      }

      const minutesMatch = message.match(/(\d+)\s*(m|min|minute)/i);
      if (minutesMatch) {
        return Math.min(Number.parseInt(minutesMatch[1], 10) * 60, OTP_COOLDOWN_SECONDS);
      }

      return null;
    };

    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as {
          error?: string;
          code?: string;
          retryAfterSeconds?: number;
        };

        if (typeof payload.error === 'string' && payload.error.length > 0) {
          authError.message = payload.error;
        }
        if (typeof payload.code === 'string' && payload.code.length > 0) {
          authError.code = payload.code;
        }
        if (typeof payload.retryAfterSeconds === 'number') {
          authError.retryAfterSeconds = payload.retryAfterSeconds;
        }
      } catch {
        // Non-JSON response bodies fall back to the default error message.
      }

      if (!authError.code && context.status === 429) {
        authError.code = 'OTP_COOLDOWN';
      }
    }

    const looksLikeCooldownMessage = /otp already sent|please wait .*before requesting/i.test(authError.message);
    if (!authError.code && looksLikeCooldownMessage) {
      authError.code = 'OTP_COOLDOWN';
    }

    if (authError.code === 'OTP_COOLDOWN') {
      const seconds = Math.min(
        authError.retryAfterSeconds ?? extractRetryAfterSeconds(authError.message) ?? OTP_COOLDOWN_SECONDS,
        OTP_COOLDOWN_SECONDS
      );
      authError.retryAfterSeconds = seconds;
      authError.message = `Please wait ${seconds}s before requesting another code.`;
    }

    return authError;
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Session restored:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Defer user type detection to avoid blocking auth state change
      if (session?.user) {
        setTimeout(() => {
          detectUserType(session.user.id);
        }, 0);
      } else {
        setUserType(null);
        setUserProfile(null);
      }
      
      hasInitialized.current = true;
      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[Auth] Initial session check:', session?.user?.id || 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        detectUserType(session.user.id);
      }

      if (!hasInitialized.current && session?.user) {
        hasInitialized.current = true;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const detectUserType = async (userId: string) => {
    // Check if user is a merchant
    const { data: merchant } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (merchant) {
      setUserType('merchant');
      setUserProfile(merchant);
      return;
    }
    
    // Check if user is a consumer
    const { data: consumer } = await supabase
      .from('consumers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (consumer) {
      setUserType('consumer');
      setUserProfile(consumer);
      return;
    }
    
    setUserType(null);
    setUserProfile(null);
  };

  const sendOtp = async (phone: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-otp', {
        body: { phone }
      });

      if (error) throw error;
      if (!data?.success) {
        const authError = new Error(data?.error || 'Failed to send code') as AuthError;
        if (typeof data?.code === 'string') authError.code = data.code;
        if (typeof data?.retryAfterSeconds === 'number') authError.retryAfterSeconds = data.retryAfterSeconds;
        throw authError;
      }

      toast({
        title: "Code sent",
        description: "Check your phone for the verification code",
      });

      return { error: null };
    } catch (error: unknown) {
      const authError = await parseGenerateOtpInvokeError(error);
      const isCooldown = authError.code === 'OTP_COOLDOWN';
      toast({
        title: isCooldown ? "Please wait before requesting another code" : "Failed to send code",
        description: authError.message,
        variant: isCooldown ? "default" : "destructive",
      });
      return { error: authError };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, code: otp }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Set session using the tokens from the edge function
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });

      if (sessionError) throw sessionError;

      toast({
        title: "Verification successful",
        description: "You've been signed in successfully",
      });

      return { error: null, session: sessionData.session };
    } catch (error: unknown) {
      const authError = toAuthError(error);
      toast({
        title: "Verification failed",
        description: authError.message,
        variant: "destructive",
      });
      return { error: authError, session: null };
    }
  };

  const completeMerchantSignup = async (businessName: string, phone: string, address?: string) => {
    if (!user) {
      return { error: { message: "No authenticated user" } };
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        business_name: businessName,
        phone: phone,
        address: address || null,
      });

    if (error) {
      toast({
        title: "Failed to create profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      await detectUserType(user.id);
    }

    return { error: error ? toAuthError(error) : null };
  };

  const completeConsumerSignup = async (name: string, phone: string) => {
    if (!user) {
      return { error: { message: "No authenticated user" } };
    }

    const { error } = await supabase
      .from('consumers')
      .insert({
        user_id: user.id,
        name: name,
        phone: phone,
        saved_info: true,
      });

    if (error) {
      toast({
        title: "Failed to create profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      await detectUserType(user.id);
    }

    return { error: error ? toAuthError(error) : null };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('[Auth] Global sign-out failed, falling back to local sign-out.', error);
        await supabase.auth.signOut({ scope: 'local' });
      }
    } finally {
      setSession(null);
      setUser(null);
      setUserType(null);
      setUserProfile(null);
    }
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userType, 
      userProfile, 
      sendOtp, 
      verifyOtp, 
      completeMerchantSignup, 
      completeConsumerSignup, 
      signOut, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
