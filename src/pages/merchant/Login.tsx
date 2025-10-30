import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";

const phoneSchema = z.object({
  phone: z.string().refine(
    (phone) => isValidPhoneNumber(phone || ""),
    { message: "Please enter a valid phone number" }
  ),
});

const signupSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100),
  phone: z.string().refine(
    (phone) => isValidPhoneNumber(phone || ""),
    { message: "Please enter a valid phone number" }
  ),
  address: z.string().optional(),
  smsConsent: z.literal(true, {
    errorMap: () => ({ message: "You must consent to receive SMS messages" }),
  }),
});

const MerchantLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, sendOtp, verifyOtp, completeMerchantSignup } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [authState, setAuthState] = useState<"phone" | "otp" | "signup">("phone");
  const [isNewMerchant, setIsNewMerchant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (user) {
      navigate("/merchant/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);


  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      phoneSchema.parse({ phone });

      // Check if merchant exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (!profile) {
        // New merchant - show signup form
        setIsNewMerchant(true);
        setAuthState("signup");
        setLoading(false);
        return;
      }

      // Existing merchant - send OTP
      setIsNewMerchant(false);
      const { error } = await sendOtp(phone);

      if (error) throw error;

      setAuthState("otp");
      setCountdown(60);
      toast({
        title: "Code sent",
        description: "Check your phone for the verification code",
      });
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

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const { error, session } = await verifyOtp(phone, otp);

      if (error) throw error;

      // If this was a new merchant signup, complete the profile creation
      if (isNewMerchant && session) {
        const { error: profileError } = await completeMerchantSignup(
          businessName,
          phone,
          address
        );
        
        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: isNewMerchant ? "Account created successfully" : "Logged in successfully",
      });
      navigate("/merchant/dashboard");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      signupSchema.parse({ businessName, phone, address, smsConsent });

      // Send OTP for signup
      const { error: signUpError } = await sendOtp(phone);

      if (signUpError) throw signUpError;

      setIsNewMerchant(true);
      setAuthState("otp");
      setCountdown(60);
      toast({
        title: "Verification code sent",
        description: "Enter the code sent to your phone to complete signup",
      });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Merchant Sign In</h1>
          <p className="text-muted-foreground">New? Enter your phone to create an account</p>
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

        {authState === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="text-center mb-4 p-3 bg-secondary/50 rounded">
              <p className="text-sm">New merchant signup for {phone}</p>
            </div>

            <div>
              <Label htmlFor="business-name">Business Name *</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1"
                required
              />
              {errors.businessName && (
                <p className="text-sm text-destructive mt-1">{errors.businessName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="sms-consent"
                checked={smsConsent}
                onCheckedChange={(checked) => setSmsConsent(checked === true)}
                className="mt-0.5"
              />
              <div>
                <Label 
                  htmlFor="sms-consent" 
                  className="text-xs leading-relaxed cursor-pointer"
                >
                  I agree to receive SMS notifications about appointment availability. Message and data rates may apply. Reply STOP to opt out at any time.
                </Label>
                {errors.smsConsent && (
                  <p className="text-xs text-destructive mt-1">{errors.smsConsent}</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={() => setAuthState("phone")}
            >
              Back
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
              {loading ? "Verifying..." : "Verify & Login"}
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
      </Card>
    </div>
  );
};

export default MerchantLogin;
