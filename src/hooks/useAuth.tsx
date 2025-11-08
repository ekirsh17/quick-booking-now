import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserType = 'merchant' | 'consumer' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userType: UserType;
  userProfile: any | null;
  sendOtp: (phone: string) => Promise<{ error: any }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error: any; session: Session | null }>;
  completeMerchantSignup: (businessName: string, phone: string, address?: string) => Promise<{ error: any }>;
  completeConsumerSignup: (name: string, phone: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
      
      setLoading(false);
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
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Code sent",
        description: "Check your phone for the verification code",
      });

      return { error: null };
    } catch (error: any) {
      toast({
        title: "Failed to send code",
        description: error.message,
        variant: "destructive",
      });
      return { error };
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
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
      return { error, session: null };
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

    return { error };
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

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
