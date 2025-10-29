import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, MapPin, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { validatePhone, formatPhoneDisplay } from "@/utils/phoneValidation";
import { cn } from "@/lib/utils";

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
  };
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

  // Format phone number as user types
  const handlePhoneChange = (value: string) => {
    setConsumerPhone(value);
    const validation = validatePhone(value);
    if (value.trim() && !validation.isValid) {
      setPhoneError(validation.error || "Invalid phone number");
    } else {
      setPhoneError("");
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

      // Check slot status
      if (data.status === "booked" || data.status === "pending_confirmation") {
        setStatus("expired");
        return;
      }

      if (data.status === "held") {
        // Check if hold has expired
        if (data.held_until && new Date(data.held_until) > new Date()) {
          setStatus("expired");
          toast({
            title: "Slot is being held",
            description: "Someone else is currently viewing this slot.",
            variant: "destructive",
          });
          return;
        }
      }

      // Slot is available - place a hold on it
      const holdUntil = new Date();
      holdUntil.setMinutes(holdUntil.getMinutes() + 3); // 3 minute hold

      const { error: holdError } = await supabase
        .from("slots")
        .update({
          status: "held",
          held_until: holdUntil.toISOString(),
        })
        .eq("id", slotId)
        .eq("status", "open"); // Only hold if still open

      if (holdError) {
        console.error("Failed to hold slot:", holdError);
        // If we couldn't hold it, it might have been taken
        setStatus("expired");
        toast({
          title: "Slot unavailable",
          description: "This slot was just claimed by someone else.",
          variant: "destructive",
        });
        return;
      }

      setStatus("held");
      setTimeLeft(180); // Start 3-minute countdown
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
    const phoneValidation = validatePhone(consumerPhone);
    if (!phoneValidation.isValid) {
      toast({
        title: "Invalid Phone Number",
        description: phoneValidation.error || "Please enter a valid phone number.",
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
      
      const approvalUrl = `${window.location.origin}/merchant/dashboard?approve=${slotId}`;
      
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
    <ConsumerLayout businessName={slot.profiles.business_name}>
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
            {slot.profiles.address && (
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
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={consumerName}
                  onChange={(e) => setConsumerName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={consumerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={isSubmitting}
                  className={cn(phoneError && "border-destructive")}
                />
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>
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
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            {status === "held" 
              ? "This spot is temporarily held for you. Complete your booking before time runs out!"
              : "First come, first served. Book now to secure this spot!"}
          </p>
        </div>
      </Card>
    </ConsumerLayout>
  );
};

export default ClaimBooking;
