import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useConsumerAuth } from "@/hooks/useConsumerAuth";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { determineAuthStrategy, getUserBookingCount } from "@/utils/authStrategy";

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  held_until: string | null;
  booked_by_name: string | null;
  appointment_name: string | null;
  profiles: {
    business_name: string;
    address: string | null;
    booking_url: string | null;
    require_confirmation: boolean;
    use_booking_system: boolean;
    phone: string;
  } | null;
}

const ClaimBooking = () => {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(180);
  const [status, setStatus] = useState<"loading" | "available" | "held" | "booked" | "expired" | "error">("loading");
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [consumerName, setConsumerName] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [bookingCount, setBookingCount] = useState(0);

  // Load booking count when phone is entered
  useEffect(() => {
    if (consumerPhone && consumerPhone.replace(/\D/g, '').length >= 10) {
      getUserBookingCount(consumerPhone, supabase).then(setBookingCount);
    }
  }, [consumerPhone]);

  // Determine auth strategy for ClaimBooking flow
  const authStrategy = determineAuthStrategy({
    flowType: 'claim',
    userType: authState?.session ? 'authenticated' : 
              bookingCount > 0 ? 'returning_guest' : 'new',
    bookingCount,
    requiresConfirmation: slot?.profiles?.require_confirmation,
  });

  // Use unified consumer authentication hook with strategy
  const { state: authState, actions: authActions, otpCode, setOtpCode } = useConsumerAuth({
    phone: consumerPhone,
    onNameAutofill: (autofilledName) => setConsumerName(autofilledName),
    authStrategy,
  });

  // Load consumer data when authenticated
  useEffect(() => {
    if (authState.session?.user && authState.consumerData) {
      setConsumerName(authState.consumerData.name);
      setConsumerPhone(authState.consumerData.phone);
    }
  }, [authState.session, authState.consumerData]);

  const handlePhoneChange = (value: string | undefined) => {
    setConsumerPhone(value || "");
    authActions.handlePhoneChange(value);
  };

  const handleVerifyOtp = async () => {
    const success = await authActions.handleVerifyOtp(otpCode);
    if (!success) {
      setOtpCode("");
    }
  };

  // Fetch slot data
  useEffect(() => {
    const fetchSlot = async () => {
      if (!slotId) {
        setStatus("error");
        return;
      }

      const { data, error } = await supabase
        .from("slots")
        .select(`
          id,
          start_time,
          end_time,
          duration_minutes,
          status,
          held_until,
          booked_by_name,
          appointment_name,
          profiles (
            business_name,
            address,
            booking_url,
            require_confirmation,
            use_booking_system,
            phone
          )
        `)
        .eq("id", slotId)
        .maybeSingle();

      if (error || !data) {
        setStatus("error");
        toast({
          title: "Slot not found",
          description: "This booking link may be invalid.",
          variant: "destructive",
        });
        return;
      }

      setSlot(data as SlotData);

      // Guard: Check if slot time has passed
      if (new Date(data.start_time) < new Date() && data.status === "open") {
        setStatus("expired");
        return;
      }

      // Check slot status
      if (data.status === "booked" || data.status === "pending_confirmation") {
        setStatus("expired");
      } else if (data.status === "held") {
        // Check if hold is still active
        if (data.held_until && new Date(data.held_until) > new Date()) {
          setStatus("held");
          setTimeLeft(Math.max(1, Math.ceil((new Date(data.held_until).getTime() - Date.now()) / 1000)));
        } else {
          setStatus("available");
        }
      } else {
        setStatus("available");
      }
    };

    fetchSlot();
  }, [slotId, toast]);

  // Real-time slot monitoring
  useEffect(() => {
    if (!slotId) return;

    const channel = supabase
      .channel(`slot-${slotId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "slots",
          filter: `id=eq.${slotId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "booked" || updated.status === "pending_confirmation") {
            setStatus("expired");
            toast({
              title: "Spot claimed",
              description: "Someone just booked this slot.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slotId, toast]);

  // Timer countdown
  useEffect(() => {
    if (status === "held" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleExpiration();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleExpiration = async () => {
    if (!slotId) return;

    // Release the slot
    await supabase
      .from("slots")
      .update({
        status: "open",
        held_until: null,
        booked_by_name: null,
      })
      .eq("id", slotId);

    setStatus("expired");
  };

  const handleBookSlot = async () => {
    if (!consumerName.trim() || !consumerPhone.trim() || !slotId || !slot) return;

    // Validate phone number before proceeding
    if (!isValidPhoneNumber(consumerPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const useBookingSystem = slot.profiles.use_booking_system;
    const requireConfirmation = slot.profiles.require_confirmation;

    // Determine the target status based on manual confirmation toggle
    const targetStatus = requireConfirmation ? "pending_confirmation" : "booked";

    // Update slot in database
    const { error } = await supabase
      .from("slots")
      .update({
        status: targetStatus,
        booked_by_name: consumerName.trim(),
        consumer_phone: consumerPhone.trim(),
        held_until: null,
      })
      .eq("id", slotId)
      .in("status", ["open", "held"]); // Allow booking from open or held (expired hold) status

    setIsSubmitting(false);

    if (error) {
      console.error("Booking error:", error);
      
      // Check if slot was already booked/pending
      const { data: currentSlot } = await supabase
        .from("slots")
        .select("status")
        .eq("id", slotId)
        .single();
      
      if (currentSlot?.status === "booked" || currentSlot?.status === "pending_confirmation") {
        toast({
          title: "Spot unavailable",
          description: "Someone just claimed this slot.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Booking failed",
          description: "There was an error processing your booking. Please try again.",
          variant: "destructive",
        });
      }
      setStatus("expired");
      return;
    }

    // Insert consumer record if it doesn't exist
    const { data: existingConsumer } = await supabase
      .from("consumers")
      .select("id")
      .eq("phone", consumerPhone.trim())
      .maybeSingle();

    let consumerId;
    if (existingConsumer) {
      consumerId = existingConsumer.id;
    } else {
      const { data: newConsumer } = await supabase
        .from("consumers")
        .insert({
          name: consumerName.trim(),
          phone: consumerPhone.trim(),
          saved_info: true,
        })
        .select("id")
        .single();
      consumerId = newConsumer?.id;
    }

    // Update slot with consumer_id
    await supabase
      .from("slots")
      .update({ booked_by_consumer_id: consumerId })
      .eq("id", slotId);

    // If manual confirmation is required, send SMS to merchant
    if (requireConfirmation) {
      const startTime = new Date(slot.start_time);
      const endTime = new Date(slot.end_time);
      const timeStr = `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;
      const dateStr = format(startTime, "MMM d");
      
      const approvalUrl = `${window.location.origin}/merchant/openings?approve=${slotId}`;
      
      const message = `🔔 ${consumerName.trim()} wants to book ${slot.appointment_name ? slot.appointment_name + ' - ' : ''}${dateStr}, ${timeStr}. Click here to confirm: ${approvalUrl} or reply "CONFIRM" to approve.`;

      // Call send-sms edge function
      await supabase.functions.invoke('send-sms', {
        body: {
          to: slot.profiles.phone,
          message: message,
        },
      });
    }

    // Show success message
    toast({
      title: requireConfirmation ? "Booking requested!" : "Booking confirmed!",
      description: requireConfirmation 
        ? "Your request has been sent to the merchant." 
        : "Your spot has been reserved.",
    });

    // Redirect to confirmation page
    navigate(`/booking-confirmed/${slotId}`);
  };

  if (status === "loading") {
    return (
      <ConsumerLayout>
        <Card className="w-full p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading slot details...</p>
        </Card>
      </ConsumerLayout>
    );
  }

  if (status === "error" || !slot) {
    return (
      <ConsumerLayout>
        <Card className="w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Slot Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This booking link may be invalid or expired.
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </ConsumerLayout>
    );
  }

  if (status === "expired") {
    return (
      <ConsumerLayout businessName={slot?.profiles?.business_name}>
        <Card className="w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Spot Unavailable</h1>
          <p className="text-muted-foreground mb-4">
            Sorry, this slot was just claimed by someone else.
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </ConsumerLayout>
    );
  }


  return (
    <ConsumerLayout businessName={slot.profiles?.business_name || "Business"}>
      <Card className="w-full overflow-hidden">
        {/* Timer Badge */}
        {status === "held" && (
          <div className="bg-primary text-primary-foreground px-4 py-2 text-center text-sm font-medium">
            <Clock className="w-4 h-4 inline mr-1" />
            Held for {formatTime(timeLeft)}
          </div>
        )}

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium mb-4">
              ✂️ One spot just opened!
            </div>
            {slot.profiles?.address && (
              <p className="text-muted-foreground">{slot.profiles.address}</p>
            )}
          </div>

          <div className="bg-secondary rounded-lg p-6 mb-6 text-center">
            {slot.appointment_name && (
              <div className="text-lg font-semibold mb-3 text-primary">
                {slot.appointment_name}
              </div>
            )}
            <div className="text-sm text-muted-foreground mb-2">Available Appointment</div>
            <div className="text-3xl font-bold mb-1">
              {format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
            </div>
            <div className="text-sm text-muted-foreground">
              {slot.duration_minutes} min appointment
            </div>
          </div>

          {status === "available" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <PhoneInput
                    value={consumerPhone}
                    onChange={handlePhoneChange}
                    onBlur={authActions.handlePhoneBlur}
                    disabled={isSubmitting || (authState.session && authState.consumerData && !authState.isGuest)}
                    error={!!phoneError}
                    placeholder="(555) 123-4567"
                  />
                  {authState.isCheckingPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>

              {authState.showOtpInput && (
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter code from SMS</Label>
                  <div className="flex gap-2">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      onComplete={handleVerifyOtp}
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
                    <Button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpCode.length !== 6 || isSubmitting}
                    >
                      Verify
                    </Button>
                  </div>
                </div>
              )}

              {authState.showNameInput && (
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <div className="relative">
                    {authState.isNameAutofilled && (
                      <Check className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                    )}
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={consumerName}
                      onChange={(e) => {
                        setConsumerName(e.target.value);
                      }}
                      disabled={isSubmitting || (authState.session && authState.consumerData && !authState.isGuest)}
                      className={cn(
                        authState.isNameAutofilled && "pl-10 bg-green-50/50 dark:bg-green-900/20"
                      )}
                    />
                  </div>
                  {authState.isNameAutofilled && (
                    <p className="text-xs text-muted-foreground mt-1">
                      We remembered your info from last time
                    </p>
                  )}
                </div>
              )}
              <Button
                onClick={handleBookSlot}
                size="lg"
                className="w-full"
                disabled={!consumerName.trim() || !consumerPhone.trim() || isSubmitting || !!phoneError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Book"
                )}
              </Button>

              {/* Auth status indicator - consistent with notify page */}
              {authState.session && authState.consumerData && !authState.isGuest ? (
                <div className="flex items-center justify-between text-sm pt-2 px-1">
                  <p className="text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{authState.consumerData.name}</span>
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={authActions.handleContinueAsGuest}
                    className="h-auto p-0 text-sm"
                  >
                    Continue as guest
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </ConsumerLayout>
  );
};

export default ClaimBooking;
