import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, Clock, MapPin, Calendar, AlertCircle, Phone, CheckCircle2, Scissors } from "lucide-react";
import { format } from "date-fns";

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  booked_by_name: string | null;
  status: string;
  appointment_name: string | null;
  profiles: {
    business_name: string;
    address: string | null;
    phone: string;
    booking_url: string | null;
    require_confirmation: boolean;
    use_booking_system: boolean;
  };
}

interface ThirdPartyBookingCardProps {
  slot: SlotData;
  scenario: 1 | 2 | 3 | 4;
}

export const ThirdPartyBookingCard = ({ slot, scenario }: ThirdPartyBookingCardProps) => {
  const [redirected, setRedirected] = useState(false);
  
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);

  const handleCompleteBooking = () => {
    if (slot.profiles.booking_url) {
      window.open(slot.profiles.booking_url, "_blank");
      setRedirected(true);
    }
  };

  // Scenario-specific content
  const getScenarioContent = () => {
    switch (scenario) {
      case 1: // External + Manual Confirm
        return {
          title: redirected ? "Booking Request Submitted" : "Complete Your Booking",
          description: redirected 
            ? "Your booking request has been submitted to the merchant. You'll receive a text notification once they confirm your appointment."
            : "Click below to complete your booking on the merchant's platform.",
          buttonText: "Complete Booking",
          showButton: !redirected,
          icon: redirected ? <CheckCircle2 className="w-12 h-12 text-green-500" /> : <ExternalLink className="w-12 h-12 text-primary" />,
          alert: redirected ? null : "You'll need merchant approval after completing the booking.",
        };
      
      case 2: // External + Auto-confirm
        return {
          title: redirected ? "Appointment Booked!" : "Complete Your Booking",
          description: redirected 
            ? "Your appointment has been successfully booked! Please complete the booking on the merchant's platform to finalize."
            : "Click below to complete your booking on the merchant's platform.",
          buttonText: "Complete Booking",
          showButton: !redirected,
          icon: redirected ? <CheckCircle2 className="w-12 h-12 text-green-500" /> : <ExternalLink className="w-12 h-12 text-primary" />,
          alert: null,
        };
      
      case 3: // Native + Manual Confirm
        return {
          title: "Booking Request Submitted",
          description: "Your booking request has been submitted to the merchant. You'll receive a text notification once they confirm your appointment.",
          buttonText: null,
          showButton: false,
          icon: <Clock className="w-12 h-12 text-amber-500" />,
          alert: "Waiting for merchant confirmation. You'll be notified by text when approved.",
        };
      
      case 4: // Native + Auto-confirm
        return {
          title: "Appointment Confirmed!",
          description: "Your appointment has been successfully booked. See you there!",
          buttonText: null,
          showButton: false,
          icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
          alert: null,
        };
      
      default:
        return {
          title: "Booking Confirmed",
          description: "Your appointment has been booked.",
          buttonText: null,
          showButton: false,
          icon: <CheckCircle2 className="w-12 h-12 text-green-500" />,
          alert: null,
        };
    }
  };

  const content = getScenarioContent();

  return (
    <Card className="w-full overflow-hidden">
      {/* Header with merchant info */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b">
        <div className="flex items-center gap-3 mb-4">
          {content.icon}
          <div>
            <h1 className="text-2xl font-bold">{content.title}</h1>
            <p className="text-muted-foreground">{slot.profiles.business_name}</p>
          </div>
        </div>
        <p className="text-sm">{content.description}</p>
      </div>

      {/* Appointment Details */}
      <div className="p-6 space-y-4">
        {slot.appointment_name && (
          <div className="flex items-start gap-3">
            <Scissors className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Service</p>
              <p className="text-muted-foreground">{slot.appointment_name}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Calendar className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Date & Time</p>
            <p className="text-muted-foreground">
              {format(startTime, "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-muted-foreground">
              {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Duration</p>
            <p className="text-muted-foreground">{slot.duration_minutes} minutes</p>
          </div>
        </div>

        {slot.profiles.address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Location</p>
              <p className="text-muted-foreground">{slot.profiles.address}</p>
            </div>
          </div>
        )}

        {/* Alert Message */}
        {content.alert && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{content.alert}</AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        {content.showButton && content.buttonText && (
          <Button 
            onClick={handleCompleteBooking} 
            className="w-full mt-6"
            size="lg"
            disabled={!slot.profiles.booking_url}
          >
            {content.buttonText}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        )}

        {/* Fallback if no booking URL for external scenarios */}
        {(scenario === 1 || scenario === 2) && !slot.profiles.booking_url && !redirected && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The merchant hasn't configured their booking system yet. 
              Please call them directly at {slot.profiles.phone} to complete your booking.
            </AlertDescription>
          </Alert>
        )}

        {/* Contact Info */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">Need to make changes?</p>
          <Button variant="outline" className="w-full" asChild>
            <a href={`tel:${slot.profiles.phone}`}>
              <Phone className="w-4 h-4 mr-2" />
              Call {slot.profiles.business_name}
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
};