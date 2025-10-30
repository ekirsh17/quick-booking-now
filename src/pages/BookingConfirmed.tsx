import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { ThirdPartyBookingCard } from "@/components/consumer/ThirdPartyBookingCard";
import { NativeBookingCard } from "@/components/consumer/NativeBookingCard";
import { Session } from "@supabase/supabase-js";

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

const BookingConfirmed = () => {
  const { slotId } = useParams();
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [consumerName, setConsumerName] = useState<string>("");

  // Check for authenticated consumer
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadConsumerName(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => loadConsumerName(session.user.id), 0);
      } else {
        setConsumerName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadConsumerName = async (userId: string) => {
    const { data } = await supabase
      .from('consumers')
      .select('name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setConsumerName(data.name);
    }
  };

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
          appointment_name,
          profiles (
            business_name,
            address,
            phone,
            booking_url,
            require_confirmation,
            use_booking_system
          )
        `)
        .eq("id", slotId)
        .in("status", ["booked", "pending_confirmation"])
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

  // Determine scenario (1-4)
  const useBookingSystem = slot.profiles.use_booking_system;
  const requireConfirmation = slot.profiles.require_confirmation;

  let scenario: 1 | 2 | 3 | 4;
  if (useBookingSystem && requireConfirmation) {
    scenario = 1;
  } else if (useBookingSystem && !requireConfirmation) {
    scenario = 2;
  } else if (!useBookingSystem && requireConfirmation) {
    scenario = 3;
  } else {
    scenario = 4;
  }

  return (
    <ConsumerLayout businessName={slot.profiles.business_name}>
      <ThirdPartyBookingCard slot={slot} scenario={scenario} />
    </ConsumerLayout>
  );
};

export default BookingConfirmed;
