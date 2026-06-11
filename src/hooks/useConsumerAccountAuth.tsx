import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabaseConsumer } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AuthError = Error & { code?: string; retryAfterSeconds?: number };
const OTP_COOLDOWN_SECONDS = 30;

type AuthToastOptions = {
  suppressSuccessToast?: boolean;
  suppressErrorToast?: boolean;
};

interface ConsumerAuthContextType {
  user: User | null;
  session: Session | null;
  sendOtp: (phone: string, options?: AuthToastOptions) => Promise<{ error: AuthError | null }>;
  verifyOtp: (
    phone: string,
    otp: string,
    options?: AuthToastOptions
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  completeConsumerSignup: (name: string, phone: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const ConsumerAuthContext = createContext<ConsumerAuthContextType | undefined>(undefined);

export const ConsumerAccountAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
        authError.code = "OTP_COOLDOWN";
      }
    }

    const looksLikeCooldownMessage = /otp already sent|please wait .*before requesting/i.test(authError.message);
    if (!authError.code && looksLikeCooldownMessage) {
      authError.code = "OTP_COOLDOWN";
    }

    if (authError.code === "OTP_COOLDOWN") {
      const seconds = Math.min(
        authError.retryAfterSeconds ?? extractRetryAfterSeconds(authError.message) ?? OTP_COOLDOWN_SECONDS,
        OTP_COOLDOWN_SECONDS
      );
      authError.retryAfterSeconds = seconds;
      authError.message = `Please wait ${seconds}s before requesting another code.`;
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

  useEffect(() => {
    const didInit = { current: false };

    const { data: { subscription } } = supabaseConsumer.auth.onAuthStateChange((_event, nextSession) => {
      if (!didInit.current) {
        return;
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabaseConsumer.auth.getSession().then(({ data: { session: nextSession } }) => {
      didInit.current = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const sendOtp = async (phone: string, options: AuthToastOptions = {}) => {
    try {
      const { data, error } = await supabaseConsumer.functions.invoke("generate-otp", {
        body: { phone },
      });

      if (error) throw error;
      if (!data?.success) {
        const authError = new Error(data?.error || "Failed to send code") as AuthError;
        if (typeof data?.code === "string") authError.code = data.code;
        if (typeof data?.retryAfterSeconds === "number") authError.retryAfterSeconds = data.retryAfterSeconds;
        throw authError;
      }

      if (!options.suppressSuccessToast) {
        toast({
          title: "Code sent",
          description: "Check your phone for the verification code",
        });
      }

      return { error: null };
    } catch (error: unknown) {
      const authError = await parseGenerateOtpInvokeError(error);
      const isCooldown = authError.code === "OTP_COOLDOWN";
      if (!options.suppressErrorToast) {
        toast({
          title: isCooldown ? "Please wait before requesting another code" : "Failed to send code",
          description: authError.message,
          variant: isCooldown ? "default" : "destructive",
        });
      }
      return { error: authError };
    }
  };

  const verifyOtp = async (phone: string, otp: string, options: AuthToastOptions = {}) => {
    try {
      const { data, error } = await supabaseConsumer.functions.invoke("verify-otp", {
        body: { phone, code: otp },
      });

      if (error) throw await parseVerifyOtpInvokeError(error);
      if (!data.success) {
        const authError = new Error(data?.error || "Failed to verify code") as AuthError;
        if (typeof data?.code === "string") authError.code = data.code;
        if (typeof data?.retryAfterSeconds === "number") authError.retryAfterSeconds = data.retryAfterSeconds;
        throw authError;
      }

      const { data: sessionData, error: sessionError } = await supabaseConsumer.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
      });

      if (sessionError) throw sessionError;

      if (!options.suppressSuccessToast) {
        toast({
          title: "Verification successful",
          description: "You've been signed in successfully",
        });
      }

      return { error: null, session: sessionData.session };
    } catch (error: unknown) {
      const authError = toAuthError(error);
      if (!options.suppressErrorToast) {
        toast({
          title: "Verification failed",
          description: authError.message,
          variant: "destructive",
        });
      }
      return { error: authError, session: null };
    }
  };

  const completeConsumerSignup = async (name: string, phone: string) => {
    if (!user) {
      return { error: { message: "No authenticated user" } as AuthError };
    }

    const { error } = await supabaseConsumer
      .from("consumers")
      .insert({
        user_id: user.id,
        name,
        phone,
        saved_info: true,
      });

    if (error) {
      toast({
        title: "Failed to create profile",
        description: error.message,
        variant: "destructive",
      });
    }

    return { error: error ? toAuthError(error) : null };
  };

  const signOut = async () => {
    try {
      await supabaseConsumer.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("[ConsumerAuth] Local sign-out encountered an error:", error);
    } finally {
      setSession(null);
      setUser(null);
    }
    toast({
      title: "Signed out",
      description: "You've been signed out successfully",
    });
  };

  return (
    <ConsumerAuthContext.Provider
      value={{
        user,
        session,
        sendOtp,
        verifyOtp,
        completeConsumerSignup,
        signOut,
        loading,
      }}
    >
      {children}
    </ConsumerAuthContext.Provider>
  );
};

export const useConsumerAccountAuth = () => {
  const context = useContext(ConsumerAuthContext);
  if (context === undefined) {
    throw new Error("useConsumerAccountAuth must be used within ConsumerAccountAuthProvider");
  }
  return context;
};
