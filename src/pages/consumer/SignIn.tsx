import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import notifymeIcon from "@/assets/notifyme-icon.png";

const phoneSchema = z.object({
  phone: z.string().refine(
    (phone) => isValidPhoneNumber(phone || ""),
    { message: "Please enter a valid phone number" }
  ),
});

const ConsumerSignIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, sendOtp, verifyOtp, completeConsumerSignup } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [authState, setAuthState] = useState<"phone" | "signup" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [countdown, setCountdown] = useState(0);
  const [isNewConsumer, setIsNewConsumer] = useState(false);
  const [signupData, setSignupData] = useState<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    if (user) {
      navigate("/my-notifications");
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

      // Check if consumer already exists
      const { data: existingConsumer, error: checkError } = await supabase
        .from("consumers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking consumer:", checkError);
        throw new Error("Failed to check account status");
      }

      if (existingConsumer) {
        // Existing consumer - go straight to OTP
        setIsNewConsumer(false);
        const { error } = await sendOtp(phone);
        if (error) throw error;

        setAuthState("otp");
        setCountdown(60);
        toast({
          title: "Code sent",
          description: "Check your phone for the verification code",
        });
      } else {
        // New consumer - show signup form
        setIsNewConsumer(true);
        setAuthState("signup");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (!name.trim()) {
        setErrors({ name: "Name is required" });
        return;
      }

      // Store signup data in component state
      setSignupData({ name: name.trim(), phone });

      // Send OTP
      const { error } = await sendOtp(phone);
      if (error) throw error;

      setAuthState("otp");
      setCountdown(60);
      toast({
        title: "Code sent",
        description: "Check your phone for the verification code",
      });
    } catch (error) {
      setErrors({ general: (error as Error).message });
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
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

      // Only complete signup for NEW consumers
      if (session && isNewConsumer && signupData) {
        const { error: consumerError } = await completeConsumerSignup(signupData.name, signupData.phone);
        if (consumerError) throw consumerError;
      }

      toast({
        title: "Success",
        description: "Signed in successfully",
      });
      navigate("/my-notifications");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center gap-3 mb-4 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src={notifymeIcon} alt="NotifyMe" className="w-full h-full object-contain rounded-lg" />
            </div>
            <h2 className="text-2xl font-bold">NotifyMe</h2>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Sign In</h1>
          <p className="text-muted-foreground">Track your notifications</p>
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
                autoFocus
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Checking..." : "Continue"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We'll send you a verification code to sign in
            </p>
          </form>
        )}

        {authState === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">
                Welcome! Let's set up your account
              </p>
            </div>

            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="Your name"
                required
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="signup-phone">Phone Number</Label>
              <PhoneInput
                value={phone}
                onChange={(value) => setPhone(value || "")}
                disabled={true}
                className="mt-1"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending code..." : "Continue"}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              className="w-full" 
              onClick={() => {
                setAuthState("phone");
                setName("");
                setErrors({});
              }}
              disabled={loading}
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
                autoFocus
              />
              {errors.otp && (
                <p className="text-sm text-destructive mt-1">{errors.otp}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying..." : "Verify & Sign In"}
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
                setAuthState(isNewConsumer ? "signup" : "phone");
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

export default ConsumerSignIn;
