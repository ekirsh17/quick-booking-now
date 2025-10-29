import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { ThirdPartyBookingCard } from "@/components/consumer/ThirdPartyBookingCard";
import { NativeBookingCard } from "@/components/consumer/NativeBookingCard";

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

      const { data, error: fetchError } = await supabase
        .from("slots")
        .select(`
          id,
          start_time,
          end_time,
          duration_minutes,
          booked_by_name,
          status,
          profiles (
            business_name,
            address,
            phone,
            booking_url
          )
        `)
        .eq("id", slotId)
        .eq("status", "booked")
        .single();

      if (fetchError || !data) {
        setError(true);
      } else {
        setSlot(data as SlotData);
      }
      
      setIsLoading(false);
    };

    fetchSlotDetails();
  }, [slotId]);

  if (isLoading) {
    return (
      <ConsumerLayout>
        <Card className="w-full p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading booking details...</p>
        </Card>
      </ConsumerLayout>
    );
  }

  if (error || !slot) {
    return (
      <ConsumerLayout>
        <Card className="w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">
            This booking confirmation may be invalid or expired.
          </p>
        </Card>
      </ConsumerLayout>
    );
  }

  const hasThirdPartyBooking = !!slot.profiles.booking_url;

  return (
    <ConsumerLayout businessName={slot.profiles.business_name}>
      {hasThirdPartyBooking ? (
        <ThirdPartyBookingCard slot={slot} />
      ) : (
        <NativeBookingCard slot={slot} />
      )}
    </ConsumerLayout>
  );
};

export default BookingConfirmed;
