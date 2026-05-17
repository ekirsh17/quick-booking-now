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
  const merchantWebsiteLabel = slot.profiles.business_name
    ? `the ${slot.profiles.business_name} website`
    : "the merchant's website";
  
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);

  const handleCompleteBooking = () => {
    if (slot.profiles.booking_url) {
      window.open(slot.profiles.booking_url, "_blank");
    }
  };

  // Scenario-specific content
  const getScenarioContent = () => {
    if (scenario === 1 || scenario === 2) {
      return {
        title: "Finish on booking site",
        description: `Complete this appointment on ${merchantWebsiteLabel}`,
        buttonText: "Return to Booking Site",
        showButton: true,
        icon: <ExternalLink className="w-5 h-5 text-primary" />,
        notice: "Your appointment isn't confirmed here until you complete booking there",
      };
    }

    switch (scenario) {
      case 3: // Native + Manual Confirm
        return {
          title: "Request sent",
          description: `${slot.profiles.business_name} will confirm this appointment`,
          buttonText: null,
          showButton: false,
          icon: <Clock className="w-5 h-5 text-amber-500" />,
          notice: "We'll text you when it's confirmed",
        };
      
      case 4: // Native + Auto-confirm
        return {
          title: "Appointment confirmed",
          description: `You're booked with ${slot.profiles.business_name}`,
          buttonText: null,
          showButton: false,
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          notice: null,
        };
      
      default:
        return {
          title: "Booking confirmed",
          description: "Your appointment has been booked",
          buttonText: null,
          showButton: false,
          icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          notice: null,
        };
    }
  };

  const content = getScenarioContent();

  const isExternalScenario = scenario === 1 || scenario === 2;
  const contactLabel = isExternalScenario ? "Need help?" : "Need to make changes?";

  return (
    <Card className="w-full overflow-hidden">
      <div className="p-6 sm:p-7 space-y-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            {content.icon}
            <span>{content.title}</span>
          </div>
          <p className="text-muted-foreground">{content.description}</p>
        </div>

        {slot.appointment_name && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">Service</p>
              <p className="text-muted-foreground">{slot.appointment_name}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">Date & Time</p>
            <p className="text-muted-foreground">
              {format(startTime, "EEEE, MMMM d, yyyy")}
            </p>
            <p className="text-muted-foreground font-medium">
              {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">Duration</p>
            <p className="text-muted-foreground">{slot.duration_minutes} minutes</p>
          </div>
        </div>

        {slot.profiles.address && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">Location</p>
              <p className="text-muted-foreground">{slot.profiles.address}</p>
            </div>
          </div>
        )}

        {content.notice && (
          <div className="rounded-md border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{content.notice}</span>
          </div>
        )}

        {content.showButton && content.buttonText && (
          <Button 
            onClick={handleCompleteBooking} 
            className="w-full"
            size="lg"
            disabled={!slot.profiles.booking_url}
          >
            {content.buttonText}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        )}

        {/* Fallback if no booking URL for external scenarios */}
        {(scenario === 1 || scenario === 2) && !slot.profiles.booking_url && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The merchant hasn't configured their booking system yet. 
              Please call them directly at {slot.profiles.phone} to complete your booking.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">{contactLabel}</p>
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
