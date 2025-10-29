import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, ExternalLink, Download } from "lucide-react";
import { format } from "date-fns";
import { generateICS } from "@/utils/calendarExport";

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

interface NativeBookingCardProps {
  slot: SlotData;
}

export const NativeBookingCard = ({ slot }: NativeBookingCardProps) => {
  const handleAddToCalendar = () => {
    generateICS({
      title: `Appointment at ${slot.profiles.business_name}`,
      description: `${slot.duration_minutes} minute appointment`,
      location: slot.profiles.address || slot.profiles.business_name,
      startTime: slot.start_time,
      endTime: slot.end_time,
    });
  };

  const handleGetDirections = () => {
    if (slot.profiles.address) {
      const encodedAddress = encodeURIComponent(slot.profiles.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
    }
  };

  return (
    <Card className="w-full overflow-hidden">
      <div className="bg-success/10 text-success px-4 py-3 text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold">You're All Set!</h1>
      </div>

      <div className="p-8 space-y-6">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">
            Your appointment is confirmed
          </p>
        </div>

        <div className="bg-secondary rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <Calendar className="w-6 h-6 text-primary" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Appointment Time</div>
              <div className="text-2xl font-bold">
                {format(new Date(slot.start_time), "h:mm a")}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(slot.start_time), "EEEE, MMMM d, yyyy")}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-1" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-1">Location</div>
              <div className="font-semibold text-lg">{slot.profiles.business_name}</div>
              {slot.profiles.address && (
                <div className="text-sm text-muted-foreground mt-1">
                  {slot.profiles.address}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleAddToCalendar}
            size="lg"
            className="w-full"
          >
            <Download className="w-5 h-5 mr-2" />
            Add to Calendar
          </Button>

          {slot.profiles.address && (
            <Button 
              onClick={handleGetDirections}
              size="lg"
              variant="outline"
              className="w-full"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Get Directions
            </Button>
          )}
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
          <p className="text-sm font-medium mb-1">Confirmation sent!</p>
          <p className="text-xs text-muted-foreground">
            Check your phone for details
          </p>
        </div>

        <div className="text-center space-y-2 pt-4 border-t">
          <p className="text-sm font-medium">What's Next?</p>
          <p className="text-sm text-muted-foreground">
            Show up at {format(new Date(slot.start_time), "h:mm a")} on {format(new Date(slot.start_time), "MMMM d")}
          </p>
          <p className="text-xs text-muted-foreground">
            Need to reschedule? Call {slot.profiles.phone}
          </p>
        </div>
      </div>
    </Card>
  );
};
