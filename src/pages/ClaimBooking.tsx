import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, MapPin, Calendar } from "lucide-react";

const ClaimBooking = () => {
  const { slotId } = useParams();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes in seconds
  const [status, setStatus] = useState<"available" | "held" | "booked" | "expired">("available");

  // Mock slot data
  const slot = {
    businessName: "Evan's Barbershop",
    address: "123 Main St, City",
    startTime: "2:00 PM",
    endTime: "2:25 PM",
    duration: "25 min",
  };

  useEffect(() => {
    if (status === "held" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setStatus("expired");
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

  const handleBook = () => {
    // TODO: Submit booking to backend when Cloud is enabled
    setStatus("held");
    toast({
      title: "Spot held!",
      description: "Complete your booking within 3 minutes.",
    });
    
    // Simulate booking confirmation after a short delay
    setTimeout(() => {
      setStatus("booked");
      toast({
        title: "🎉 You've got the spot!",
        description: `See you at ${slot.startTime}`,
      });
    }, 2000);
  };

  if (status === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Spot Unavailable</h1>
          <p className="text-muted-foreground">
            Sorry, this slot was just claimed by someone else.
          </p>
        </Card>
      </div>
    );
  }

  if (status === "booked") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold mb-2">🎉 You've got the spot!</h1>
          <p className="text-lg font-medium mb-4">
            {slot.startTime} – {slot.endTime}
          </p>
          <div className="text-left space-y-2 mb-6">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium">{slot.businessName}</div>
                <div className="text-muted-foreground">{slot.address}</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            You'll receive a confirmation text shortly. See you soon!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full overflow-hidden">
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
            <h1 className="text-2xl font-bold mb-2">{slot.businessName}</h1>
            <p className="text-muted-foreground">{slot.address}</p>
          </div>

          <div className="bg-secondary rounded-lg p-6 mb-6 text-center">
            <div className="text-sm text-muted-foreground mb-2">Available Appointment</div>
            <div className="text-3xl font-bold mb-1">
              {slot.startTime} – {slot.endTime}
            </div>
            <div className="text-sm text-muted-foreground">{slot.duration} appointment</div>
          </div>

          {status === "available" && (
            <Button onClick={handleBook} size="lg" className="w-full">
              Book This Spot
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            First come, first served. This spot will be held for 3 minutes once you book.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ClaimBooking;
