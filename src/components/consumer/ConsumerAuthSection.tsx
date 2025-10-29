import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Check, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";

interface ConsumerAuthSectionProps {
  onAuthSuccess: (userData: { name: string; phone: string }) => void;
  onClearFields: () => void;
  currentPhone: string;
}

type AuthState = "collapsed" | "entering-phone" | "entering-code" | "authenticated";

export const ConsumerAuthSection = ({ onAuthSuccess, onClearFields, currentPhone }: ConsumerAuthSectionProps) => {
  const [authState, setAuthState] = useState<AuthState>("collapsed");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setAuthState("authenticated");
        loadConsumerData(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        setAuthState("authenticated");
        loadConsumerData(session.user.id);
      } else {
        setAuthState("collapsed");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const loadConsumerData = async (userId: string) => {
    const { data } = await supabase
      .from('consumers')
      .select('name, phone')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      onAuthSuccess({ name: data.name, phone: data.phone });
    }
  };

  const formatPhoneToE164 = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    return phoneNumber.startsWith('+') ? phoneNumber : `+1${digits}`;
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const formattedPhone = formatPhoneToE164(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          channel: 'sms',
        }
      });

      if (error) throw error;

      setAuthState("entering-code");
      setCountdown(300); // 5 minutes
      toast({
        title: "Code sent!",
        description: "Check your phone for a 6-digit code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    setLoading(true);
    try {
      const formattedPhone = formatPhoneToE164(phone);
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: 'sms',
      });

      if (error) throw error;

      toast({
        title: "Signed in!",
        description: "Your info will be auto-filled.",
      });
    } catch (error: any) {
      toast({
        title: "Invalid code",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthState("collapsed");
    onClearFields();
    toast({
      title: "Signed out",
      description: "You can continue as a guest.",
    });
  };

  const handleResendCode = () => {
    setOtp("");
    handleSendCode();
  };

  if (authState === "authenticated" && session) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" />
            <span>Signed in as <span className="font-medium text-foreground">{session.user.phone}</span></span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClearFields}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Continue as guest
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authState === "collapsed") {
    return (
      <div className="mt-4 pt-4 border-t text-center">
        <button
          type="button"
          onClick={() => setAuthState("entering-phone")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Already have an account? <span className="underline">Sign in to auto-fill</span>
        </button>
      </div>
    );
  }

  return (
    <Collapsible open={authState === "entering-phone" || authState === "entering-code"} className="mt-4 pt-4 border-t">
      <CollapsibleContent>
        <div className="p-4 rounded-lg border bg-muted/30 space-y-4 mt-4">
          {authState === "entering-phone" && (
            <>
              <div>
                <Label htmlFor="auth-phone" className="text-sm font-medium">
                  Sign in to auto-fill
                </Label>
                <Input
                  id="auth-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!phone || loading}
                  className="flex-1"
                >
                  {loading ? "Sending..." : "Send code"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAuthState("collapsed")}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We'll text you a secure 6-digit code
              </p>
            </>
          )}

          {authState === "entering-code" && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Enter the code sent to {phone}
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => {
                      setOtp(value);
                      if (value.length === 6) {
                        handleVerifyCode(value);
                      }
                    }}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {countdown > 0 ? `Code expires in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}` : "Code expired"}
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 240 || loading}
                  className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Resend code
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAuthState("entering-phone");
                  setOtp("");
                  setCountdown(0);
                }}
                className="w-full"
              >
                Change phone number
              </Button>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
