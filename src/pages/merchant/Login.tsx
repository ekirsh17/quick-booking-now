import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { normalizePhoneToE164 } from "@/utils/phoneValidation";
import notifymeIcon from "@/assets/notifyme-icon.png";
import { Bell, Smartphone, DollarSign } from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().refine(
    (phone) => isValidPhoneNumber(phone || ""),
    { message: "Please enter a valid phone number" }
  ),
});

const MerchantLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [authState, setAuthState] = useState<"phone" | "otp">("phone");
  const [isNewMerchant, setIsNewMerchant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [countdown, setCountdown] = useState(0);
  const autoSendAttempted = useRef(false);

  // Check for admin force param to show login form even if already authenticated
  const searchParams = new URLSearchParams(location.search);
  const forceShow = searchParams.get('force') === 'true';
  const prefillPhone = searchParams.get('prefillPhone') || "";
  const autoSend = searchParams.get('autoSend') === 'true';

  useEffect(() => {
    // Skip auto-redirect if force=true (admin testing)
    if (user && !forceShow) {
      navigate("/merchant/openings");
    }
  }, [user, forceShow, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);


  const startPhoneAuth = async (phoneValue: string, options?: { showToast?: boolean }) => {
    setLoading(true);
    setErrors({});

    try {
      phoneSchema.parse({ phone: phoneValue });

      // Normalize phone to E.164 format before database query
      // This ensures we match profiles stored with normalized phone numbers
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneToE164(phoneValue);
      } catch (normalizationError: any) {
        setErrors({ phone: normalizationError.message || "Invalid phone number format" });
        toast({
          title: "Error",
          description: normalizationError.message || "Invalid phone number format",
          variant: "destructive",
        });
        return;
      }

      // Check if merchant exists using normalized phone (use limit(1) for defensive coding)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', normalizedPhone)
        .order('created_at', { ascending: true })
        .limit(1);
      
      const profile = profiles?.[0] || null;

      // Track if this is a new merchant for routing after OTP
      setIsNewMerchant(!profile);

      // Send OTP for both new and existing users (use original phone for OTP)
      const { error } = await sendOtp(phoneValue);

      if (error) throw error;

      setAuthState("otp");
      setCountdown(60);
      if (options?.showToast !== false) {
        toast({
          title: "Code sent",
          description: "Check your phone for the verification code",
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: (error as Error).message });
        toast({
          title: "Error",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await startPhoneAuth(phone, { showToast: true });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const { error, session } = await verifyOtp(phone, otp);

      if (error) throw error;

      let resolvedIsNewMerchant = isNewMerchant;

      if (session?.user) {
        let normalizedPhone: string;
        try {
          normalizedPhone = normalizePhoneToE164(phone);
        } catch (normalizationError: any) {
          console.error('Error normalizing phone for profile lookup:', normalizationError);
          normalizedPhone = phone;
        }

        const { data: profile, error: profileLookupError } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileLookupError) {
          console.error('Error checking existing profile:', profileLookupError);
        }

        const hasProfile = Boolean(profile);
        resolvedIsNewMerchant = !hasProfile;
        setIsNewMerchant(resolvedIsNewMerchant);

        if (hasProfile) {
          if (!profile?.phone || profile.phone !== normalizedPhone) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ phone: normalizedPhone })
              .eq('id', session.user.id);

            if (updateError) {
              console.error('Error updating profile phone:', updateError);
            }
          }
        } else {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              phone: normalizedPhone,
              business_name: 'My Business', // Will be updated in onboarding
            });

          if (profileError && !profileError.message?.includes('duplicate key')) {
            console.error('Error creating profile:', profileError);
          }
        }
      }

      toast({
        title: "Success",
        description: resolvedIsNewMerchant ? "Welcome! Let's set up your account" : "Logged in successfully",
      });
      
      // New merchants go to onboarding, existing merchants go to openings
      navigate(resolvedIsNewMerchant ? "/merchant/onboarding" : "/merchant/openings");
    } catch (error) {
      setErrors({ otp: "Invalid or expired code" });
      toast({
        title: "Error",
        description: "Invalid or expired code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      const { error } = await sendOtp(phone);

      if (error) throw error;

      setCountdown(60);
      toast({
        title: "Code resent",
        description: "A new code has been sent to your phone",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!prefillPhone) return;
    setPhone(prefillPhone);
  }, [prefillPhone]);

  useEffect(() => {
    if (!autoSend || !prefillPhone || authState !== "phone") return;
    if (autoSendAttempted.current) return;
    autoSendAttempted.current = true;
    startPhoneAuth(prefillPhone, { showToast: false });
  }, [autoSend, authState, prefillPhone]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md md:max-w-lg overflow-hidden">
        <div className="p-6 min-h-[420px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <img src={notifymeIcon} alt="OpenAlert" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Business Portal</p>
              <h1 className="text-xl font-bold">Sign in or sign up</h1>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Instant SMS updates</p>
                <p className="text-xs text-muted-foreground">Text your openings and notify customers fast.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Real-time availability</p>
                <p className="text-xs text-muted-foreground">Fill last-minute cancellations in minutes.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">More booked time</p>
                <p className="text-xs text-muted-foreground">Turn open slots into revenue quickly.</p>
              </div>
            </div>
          </div>

          {errors.general && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mb-4">
              {errors.general}
            </div>
          )}

          {authState === "phone" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  error={!!errors.phone}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                  onBlur={() => {
                    if (phone) {
                      try {
                        phoneSchema.parse({ phone });
                        setErrors(prev => ({ ...prev, phone: undefined }));
                      } catch (error) {
                        if (error instanceof z.ZodError) {
                          setErrors(prev => ({ ...prev, phone: error.errors[0].message }));
                        }
                      }
                    }
                  }}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending code..." : "Continue"}
              </Button>
            </form>
          )}

          {authState === "otp" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to {phone}
                </p>
              </div>

              <div>
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
                {errors.otp && (
                  <p className="text-sm text-destructive mt-1">{errors.otp}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify & Continue"}
              </Button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Resend code in {countdown}s
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-sm"
                  >
                    Resend code
                  </Button>
                )}
              </div>

              <Button 
                type="button" 
                variant="ghost" 
                className="w-full" 
                onClick={() => {
                  setAuthState("phone");
                  setOtp("");
                }}
              >
                Change phone number
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};

export default MerchantLogin;
