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

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  held_until: string | null;
  booked_by_name: string | null;
  profiles: {
    business_name: string;
    address: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          profiles (
            business_name,
            address
          )
        `)
        .eq("id", slotId)
        .single();

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
      if (data.status === "booked") {
        setStatus("expired");
      } else if (data.status === "held") {
        // Check if hold has expired
        if (data.held_until && new Date(data.held_until) > new Date()) {
          setStatus("expired");
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
          if (updated.status === "booked") {
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

  const handleHoldSlot = async () => {
    if (!consumerName.trim() || !slotId || !slot) return;

    setIsSubmitting(true);

    const heldUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("slots")
      .update({
        status: "held",
        held_until: heldUntil,
        booked_by_name: consumerName.trim(),
      })
      .eq("id", slotId)
      .eq("status", "open"); // Optimistic locking

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Spot unavailable",
        description: "Someone just claimed this slot.",
        variant: "destructive",
      });
      setStatus("expired");
      return;
    }

    setStatus("held");
    toast({
      title: "Spot held!",
      description: "Complete your booking within 3 minutes.",
    });
  };

  const handleConfirmBooking = async () => {
    if (!slotId) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from("slots")
      .update({
        status: "booked",
        held_until: null,
      })
      .eq("id", slotId)
      .eq("status", "held");

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Booking failed",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setStatus("booked");
    toast({
      title: "🎉 You've got the spot!",
      description: `See you at ${slot ? format(new Date(slot.start_time), "h:mm a") : "your appointment"}`,
    });
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

  if (status === "booked") {
    return (
      <ConsumerLayout businessName={slot.profiles.business_name}>
        <Card className="w-full p-8 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">🎉 You've got the spot!</h1>
          <p className="text-lg font-medium mb-4">
            {format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
          </p>
          <div className="text-left space-y-2 mb-6">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium">{slot.profiles.business_name}</div>
                {slot.profiles.address && (
                  <div className="text-muted-foreground">{slot.profiles.address}</div>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            You'll receive a confirmation text shortly. See you soon!
          </p>
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
              <Button
                onClick={handleHoldSlot}
                size="lg"
                className="w-full"
                disabled={!consumerName.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Holding Spot...
                  </>
                ) : (
                  "Book This Spot"
                )}
              </Button>
            </div>
          )}

          {status === "held" && (
            <Button
              onClick={handleConfirmBooking}
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            First come, first served. This spot will be held for 3 minutes once you book.
          </p>
        </div>
      </Card>
    </ConsumerLayout>
  );
};

export default ClaimBooking;
