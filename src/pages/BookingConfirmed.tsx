import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { ThirdPartyBookingCard } from "@/components/consumer/ThirdPartyBookingCard";

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
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

const BookingConfirmed = () => {
  const { slotId } = useParams();
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchSlotDetails = async () => {
      if (!slotId) {
        setError(true);
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase.functions.invoke("booking-confirmation", {
        body: { slotId },
      });

      if (fetchError || !data?.success || !data?.slot) {
        setError(true);
      } else {
        setSlot(data.slot as SlotData);
      }
      
      setIsLoading(false);
    };

    fetchSlotDetails();
  }, [slotId]);

  if (isLoading) {
    return (
      <ConsumerLayout hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading booking details...</p>
        </Card>
      </ConsumerLayout>
    );
  }

  if (error || !slot) {
    return (
      <ConsumerLayout hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">
            This booking confirmation may be invalid or expired
          </p>
        </Card>
      </ConsumerLayout>
    );
  }

  // Determine scenario (1-4)
  const useBookingSystem = slot.profiles.use_booking_system;
  const requireConfirmation = slot.profiles.require_confirmation;

  let scenario: 1 | 2 | 3 | 4;
  if (useBookingSystem) {
    scenario = 2;
  } else if (!useBookingSystem && requireConfirmation) {
    scenario = 3;
  } else {
    scenario = 4;
  }

  return (
    <ConsumerLayout businessName={slot.profiles.business_name} hideGuestSignInCta hideAccountControls hideHeader>
      <ThirdPartyBookingCard slot={slot} scenario={scenario} />
    </ConsumerLayout>
  );
};

export default BookingConfirmed;
