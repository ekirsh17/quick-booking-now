import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Clock, MapPin, Calendar, AlertCircle, Phone } from "lucide-react";
import { format } from "date-fns";

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booked_by_name: string | null;
  profiles: {
    business_name: string;
    address: string | null;
    phone: string;
    booking_url: string | null;
  };
}

interface ThirdPartyBookingCardProps {
  slot: SlotData;
}

export const ThirdPartyBookingCard = ({ slot }: ThirdPartyBookingCardProps) => {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCompleteBooking = () => {
    if (slot.profiles.booking_url) {
      window.open(slot.profiles.booking_url, "_blank");
    }
  };

  const hasBookingUrl = !!slot.profiles.booking_url;

  return (
    <Card className="w-full overflow-hidden">
      <div className="bg-success/10 text-success px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-semibold">Spot Reserved!</span>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Almost There!</h1>
          <p className="text-muted-foreground">
            Your appointment time is being held for you
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">Appointment Time</div>
              <div className="text-lg font-semibold">
                {format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm text-muted-foreground">Location</div>
              <div className="font-medium">{slot.profiles.business_name}</div>
              {slot.profiles.address && (
                <div className="text-sm text-muted-foreground">{slot.profiles.address}</div>
              )}
            </div>
          </div>
        </div>

        {!hasBookingUrl && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Booking system URL not configured. Please contact the business directly to complete your booking.
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {hasBookingUrl ? `Complete booking within ${formatTime(timeLeft)}` : "Reservation expires in " + formatTime(timeLeft)}
            </span>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            {hasBookingUrl 
              ? `To secure your spot, please complete the booking on ${slot.profiles.business_name}'s booking system`
              : "Your spot is temporarily reserved. Contact the business to finalize your appointment."
            }
          </p>
        </div>

        {hasBookingUrl ? (
          <Button 
            onClick={handleCompleteBooking}
            size="lg"
            className="w-full text-lg font-semibold"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Complete Your Booking
          </Button>
        ) : (
          <div className="space-y-3">
            <Button 
              size="lg"
              className="w-full text-lg font-semibold"
              disabled
            >
              Booking System Not Available
            </Button>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Phone className="w-4 h-4" />
              <span className="font-medium">Call: {slot.profiles.phone}</span>
            </div>
          </div>
        )}

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            {hasBookingUrl 
              ? "You'll be redirected to complete payment and finalize your appointment"
              : "Please contact the business to complete your appointment"
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {hasBookingUrl ? "After completing, you can close this page" : "Save this confirmation for your records"}
          </p>
        </div>
      </div>
    </Card>
  );
};
