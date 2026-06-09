import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, AlertCircle, Bell, Calendar, ExternalLink, MapPin, Scissors, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { BookingDetailRow } from "@/components/consumer/BookingDetailRow";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { useConsumerAuth } from "@/hooks/useConsumerAuth";
import { cn } from "@/lib/utils";
import { validateAndNormalizeBookingUrl } from "@/utils/bookingUrl";

/** Open in a new tab; must run during the user click (before await) or popups are blocked. */
function openMerchantBookingUrl(rawUrl: string): Window | null {
  const normalized = validateAndNormalizeBookingUrl(rawUrl);
  if (!normalized.ok) {
    return null;
  }
  return window.open(normalized.value, "_blank", "noopener,noreferrer");
}

interface SlotData {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  appointment_name: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  location_id?: string | null;
  profiles: {
    name: string;
    phone: string;
    address?: string | null;
    booking_url?: string | null;
    require_confirmation?: boolean | null;
    use_booking_system?: boolean | null;
    booking_notifications_enabled?: boolean;
  } | null;
}

interface AlternativeSlot {
  id: string;
  start_time: string;
  end_time: string;
  appointment_name: string | null;
}

const ClaimBooking = () => {
  const { slotId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(180);
  const [status, setStatus] = useState<"loading" | "available" | "held" | "booked" | "expired" | "error">("loading");
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [consumerName, setConsumerName] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [alternatives, setAlternatives] = useState<AlternativeSlot[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [didPrefillFromRemember, setDidPrefillFromRemember] = useState(false);
  const [showExternalReturnState, setShowExternalReturnState] = useState(false);

  const REMEMBER_ME_STORAGE_KEY = "consumer_notify_remembered_info";

  // Use unified consumer authentication hook with dynamic strategy
  const { state: authState, actions: authActions } = useConsumerAuth({
    phone: consumerPhone,
    onNameAutofill: (autofilledName) => setConsumerName(autofilledName),
    authStrategy: 'none',
  });

  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (!authState.session?.user && stored) {
      try {
        const parsed = JSON.parse(stored) as { name?: string; phone?: string };
        if (parsed?.name || parsed?.phone) {
          setConsumerName(parsed.name || "");
          setConsumerPhone(parsed.phone || "");
          setDidPrefillFromRemember(true);
        }
      } catch (error) {
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
      }
    }
  }, [authState.session?.user]);

  // Load consumer data when authenticated
  useEffect(() => {
    if (authState.session?.user && authState.consumerData) {
      const fallbackName =
        authState.session.user.user_metadata?.full_name ||
        authState.session.user.user_metadata?.name ||
        authState.session.user.user_metadata?.display_name ||
        "";
      const resolvedName = authState.consumerData.name || fallbackName;
      if (resolvedName) {
        setConsumerName(resolvedName);
      }
      if (authState.consumerData.phone) {
        setConsumerPhone(authState.consumerData.phone);
      }
    }
  }, [authState.session, authState.consumerData]);

  const handlePhoneChange = (value: string | undefined) => {
    const nextValue = value || "";
    setConsumerPhone(nextValue);
    if (nextValue && !isValidPhoneNumber(nextValue)) {
      setPhoneError("Enter a valid phone number");
    } else {
      setPhoneError("");
    }
    authActions.handlePhoneChange(value);
  };

  const clearRememberedIdentity = async () => {
    if (authState.session && !authState.isGuest) {
      await authActions.handleContinueAsGuest();
    }

    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    setDidPrefillFromRemember(false);
    setConsumerName("");
    setConsumerPhone("");
    setPhoneError("");
  };

  // Resolve signed deep link on mount
  useEffect(() => {
    const st = searchParams.get('st');
    const tz = searchParams.get('tz');
    const dur = searchParams.get('dur');
    const sig = searchParams.get('sig');
    const mid = searchParams.get('mid');

    // Only resolve if we have signed parameters (new format)
    // Legacy links without signature will fall through to normal slot fetch
    if (st && tz && dur && sig && slotId) {
      console.log('Resolving signed deep link', { slotId, st });
      
      // Track analytics
      window.dispatchEvent(new CustomEvent('analytics', {
        detail: { event: 'notification_link_clicked', properties: { slotId, merchantId: mid } }
      }));

      const resolveSlot = async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-slot?slotId=${slotId}&st=${encodeURIComponent(st)}&tz=${encodeURIComponent(tz)}&dur=${dur}&sig=${encodeURIComponent(sig)}`,
            {
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
            }
          );

          const data = await response.json();

          if (response.ok) {
            // Success - slot resolved
            console.log('Slot resolved successfully', data);
            window.dispatchEvent(new CustomEvent('analytics', {
              detail: { event: 'booking_slot_resolved', properties: { slotId, fromDeepLink: true } }
            }));
          } else if (response.status === 409 && data.code === 'slot_unavailable') {
            // Slot taken - show alternatives
            console.log('Slot unavailable, showing alternatives', data.alternatives);
            setAlternatives(data.alternatives || []);
            setShowAlternatives(true);
            setStatus('expired');
            
            window.dispatchEvent(new CustomEvent('analytics', {
              detail: { event: 'booking_slot_unavailable', properties: { slotId } }
            }));
            
            toast({
              title: "Slot no longer available",
              description: "That time was just booked. Check out these nearby times.",
              variant: "destructive",
            });
          } else if (data.code === 'invalid_signature' || data.code === 'slot_mismatch') {
            // Tampered link
            console.warn('Invalid or tampered link', data);
            
            window.dispatchEvent(new CustomEvent('analytics', {
              detail: { event: 'booking_slot_mismatch_sig_invalid', properties: { slotId, code: data.code } }
            }));
            
            setStatus('error');
            toast({
              title: "Invalid link",
              description: "This booking link is invalid or has been tampered with.",
              variant: "destructive",
            });
          } else if (response.status === 404) {
            // Slot not found - fall through to normal slot fetch
            console.log('Slot not found via resolve-slot, falling back to direct query');
            // Don't set error status here - let the normal fetchSlot handle it
          } else {
            // Other error
            console.error('Error resolving slot', data);
            toast({
              title: "Error",
              description: data.error || "Failed to load booking details. Please try again.",
              variant: "destructive",
            });
            setStatus("error");
          }
        } catch (error) {
          console.error('Failed to resolve signed link', error);
          // Don't set error status - fall through to normal slot fetch
          // The error might be network-related, so we should still try the direct query
          console.log('Error in resolve-slot, falling back to direct slot query');
        }
      };

      resolveSlot();
    }
  }, [slotId, searchParams, toast]);

  // Fetch slot data
  useEffect(() => {
    const fetchSlot = async () => {
      if (!slotId) {
        setStatus("error");
        return;
      }

      console.log('[ClaimBooking] Fetching slot:', slotId);
      
      // First try to get the slot without the profile join to isolate RLS issues
      const { data: slotData, error: slotError } = await supabase
        .from("slots")
        .select(`
          id,
          start_time,
          end_time,
          status,
          appointment_name,
          merchant_id,
          staff_id,
          location_id
        `)
        .eq("id", slotId)
        .maybeSingle();

      console.log('[ClaimBooking] Slot query (without profile):', { slotData, slotError, slotId });

      if (slotError) {
        console.error('[ClaimBooking] Slot query error:', slotError);
        setStatus("error");
        // Show user-friendly error message instead of raw Supabase error
        const errorMessage = slotError.code === 'PGRST116' || slotError.message?.includes('not found')
          ? "This booking link may be invalid or expired."
          : slotError.message || "This booking link may be invalid.";
        toast({
          title: "Slot not found",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (!slotData) {
        console.warn('[ClaimBooking] No slot data returned for ID:', slotId);
        setStatus("error");
        toast({
          title: "Slot not found",
          description: "This booking link may be invalid or expired.",
          variant: "destructive",
        });
        return;
      }

      // Now fetch the profile separately
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("business_name, phone, address, booking_url, require_confirmation, use_booking_system, booking_notifications_enabled")
        .eq("id", slotData.merchant_id)
        .maybeSingle();

      console.log('[ClaimBooking] Profile query:', { profileData, profileError });

      let staffName: string | null = null;
      if (slotData.staff_id) {
        const { data: publicStaff } = await supabase.rpc("get_public_staff", {
          p_merchant_id: slotData.merchant_id,
          p_location_id: slotData.location_id ?? null,
        });
        staffName = publicStaff?.find((staff) => staff.id === slotData.staff_id)?.name ?? null;
      }

      // Combine the data
      const data = {
        ...slotData,
        staff_name: staffName,
        profiles: profileData ? {
          name: profileData.business_name,
          phone: profileData.phone,
          address: profileData.address,
          booking_url: profileData.booking_url,
          require_confirmation: profileData.require_confirmation,
          use_booking_system: profileData.use_booking_system,
          booking_notifications_enabled: profileData.booking_notifications_enabled ?? false,
        } : null
      };

      console.log('[ClaimBooking] Combined slot data:', data);

      // Note: profileError is non-fatal - we can still show the booking form without merchant name
      if (profileError) {
        console.warn('[ClaimBooking] Profile query error (non-fatal):', profileError);
        // Only log, don't block the booking flow if profile can't be loaded
      }

      setSlot(data as SlotData);

      console.log('[ClaimBooking] Setting slot status. Slot data:', {
        status: data.status,
        start_time: data.start_time,
        current_time: new Date().toISOString(),
        is_past: new Date(data.start_time) < new Date()
      });

      // Guard: Check if slot time has passed
      if (new Date(data.start_time) < new Date() && data.status === "open") {
        console.log('[ClaimBooking] Slot time has passed, marking as expired');
        setStatus("expired");
        return;
      }

      // Check slot status
      if (data.status === "booked" || data.status === "pending_confirmation") {
        console.log('[ClaimBooking] Slot is already booked/pending, marking as expired');
        setStatus("expired");
      } else if (data.status === "held") {
        // For now, treat held slots as available (we don't have held_until in schema)
        console.log('[ClaimBooking] Slot is held, marking as held');
        setStatus("held");
      } else {
        console.log('[ClaimBooking] Slot is available, marking as available');
        setStatus("available");
      }
    };

    fetchSlot();
  }, [slotId, toast]);

  const handleExpiration = useCallback(async () => {
    if (!slotId) return;

    // Release the slot
    await supabase
      .from("slots")
      .update({
        status: "open",
        held_until: null,
        // booked_by_name doesn't exist in schema - removed
      })
      .eq("id", slotId);

    setStatus("expired");
  }, [slotId]);

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
          const updated = payload.new as { status?: string };
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
  }, [status, timeLeft, handleExpiration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Timer urgency styling based on time remaining
  const getTimerStyle = (seconds: number) => {
    if (seconds > 120) return "bg-primary text-primary-foreground";
    if (seconds > 60) return "bg-amber-500 text-white";
    return "bg-destructive text-destructive-foreground animate-pulse";
  };

  const handleBookSlot = async () => {
    if (!consumerName.trim() || !consumerPhone.trim() || !slotId || !slot) return;

    // Guard against claiming slots that have already started
    if (new Date(slot.start_time) < new Date()) {
      toast({
        title: "Slot expired",
        description: "This time has already passed. Please choose a different slot.",
        variant: "destructive",
      });
      setStatus("expired");
      return;
    }

    // Validate phone number before proceeding
    if (!isValidPhoneNumber(consumerPhone)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    const useBookingSystem = Boolean(slot.profiles?.use_booking_system);
    const bookingUrl = slot.profiles?.booking_url?.trim() || null;

    let externalBookingTab: Window | null = null;
    if (useBookingSystem) {
      if (!bookingUrl) {
        toast({
          title: "Booking site unavailable",
          description: "The merchant booking site is unavailable right now. Please call the merchant for help.",
          variant: "destructive",
        });
        return;
      }
      externalBookingTab = openMerchantBookingUrl(bookingUrl);
    }

    setIsSubmitting(true);

    const requireConfirmation = !useBookingSystem && Boolean(slot.profiles?.require_confirmation);

    const targetStatus = requireConfirmation ? "pending_confirmation" : "booked";

    const { data: claimResult, error } = await supabase.functions.invoke("claim-slot", {
      body: {
        slotId,
        consumerName: consumerName.trim(),
        consumerPhone: consumerPhone.trim(),
        targetStatus,
      },
    });

    setIsSubmitting(false);

    const closeExternalBookingTab = () => {
      externalBookingTab?.close();
      externalBookingTab = null;
    };

    if (error) {
      if (useBookingSystem) {
        closeExternalBookingTab();
      }
      console.error("Booking error:", error);
      
      // Check if slot was already booked/pending
      const { data: currentSlot, error: currentSlotError } = await supabase
        .from("slots")
        .select("status, start_time")
        .eq("id", slotId)
        .single();

      if (currentSlotError) {
        console.warn("Failed to re-check slot status after booking error:", currentSlotError);
      }
      
      if (currentSlot?.status === "booked" || currentSlot?.status === "pending_confirmation") {
        setStatus("expired");
        return;
      }

      if (currentSlot?.start_time && new Date(currentSlot.start_time) < new Date()) {
        toast({
          title: "Slot expired",
          description: "This time has already passed. Please choose a different slot.",
          variant: "destructive",
        });
        setStatus("expired");
        return;
      } else {
        toast({
          title: "Booking failed",
          description: "There was an error processing your booking. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

    if (!claimResult?.success) {
      if (useBookingSystem) {
        closeExternalBookingTab();
      }
      if (claimResult?.code === "slot_unavailable") {
        setStatus("expired");
        return;
      }

      if (claimResult?.code === "slot_expired") {
        toast({
          title: "Slot expired",
          description: "This time has already passed. Please choose a different slot.",
          variant: "destructive",
        });
        setStatus("expired");
        return;
      }

      toast({
        title: "Booking failed",
        description: "There was an error processing your booking. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (useBookingSystem && bookingUrl) {
      if (!externalBookingTab) {
        openMerchantBookingUrl(bookingUrl);
      }
      setShowExternalReturnState(true);
      return;
    }

    // Merchant SMS notifications are handled server-side in claim-slot.

    navigate(`/booking-confirmed/${slotId}`);
  };

  const isRemembered = didPrefillFromRemember || Boolean(authState.session && authState.consumerData);
  const nameReadOnly = isRemembered;
  const phoneReadOnly = isRemembered;
  const firstName = consumerName.trim().split(/\s+/)[0] || "";
  const welcomeBackLabel = firstName ? `Welcome back, ${firstName}` : "Welcome back";
  const isExternalBooking = Boolean(slot?.profiles?.use_booking_system);
  const requiresManualConfirmation = !isExternalBooking && Boolean(slot?.profiles?.require_confirmation);
  const merchantWebsiteLabel = slot?.profiles?.name ? `the ${slot.profiles.name} website` : "the merchant's website";
  const appointmentDurationMinutes = slot
    ? Math.round((new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / (1000 * 60))
    : 0;

  if (status === "loading") {
    return (
      <ConsumerLayout hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading slot details...</p>
        </Card>
      </ConsumerLayout>
    );
  }

  if (status === "error" || !slot) {
    return (
      <ConsumerLayout hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Slot Not Found</h1>
          <p className="text-muted-foreground mb-4">
            This booking link may be invalid or expired
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </ConsumerLayout>
    );
  }

  if (status === "expired") {
    return (
      <ConsumerLayout businessName={slot?.profiles?.name} hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full overflow-hidden">
          <div className="px-8 py-10 text-center">
            {slot?.profiles?.name && (
              <p className="text-base font-semibold text-foreground">{slot.profiles.name}</p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-balance mt-2">
              Appointment no longer available
            </h1>
            <p className="text-muted-foreground text-pretty leading-relaxed max-w-sm mx-auto mt-4">
              That time isn&apos;t available anymore, but you&apos;re still on the waitlist. We&apos;ll text you if another opens up.
            </p>
          </div>

          {showAlternatives && alternatives.length > 0 && (
            <div className="border-t bg-secondary/30 p-6">
              <p className="text-sm font-medium text-center mb-4">
                Here are other appointments that just opened:
              </p>

              <div className="space-y-2">
                {alternatives.map((alt) => (
                  <div
                    key={alt.id}
                    className="bg-card rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                    onClick={() => navigate(`/claim/${alt.id}`)}
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1 min-w-0">
                        {alt.appointment_name && (
                          <div className="text-sm font-semibold text-primary mb-0.5">
                            {alt.appointment_name}
                          </div>
                        )}
                        <div className="font-medium">
                          {format(new Date(alt.start_time), "EEE, MMM d · h:mm a")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {Math.round((new Date(alt.end_time).getTime() - new Date(alt.start_time).getTime()) / (1000 * 60))} min
                        </div>
                      </div>
                      <Button size="sm" className="shrink-0">
                        View appointment
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </ConsumerLayout>
    );
  }

  if (showExternalReturnState) {
    return (
      <ConsumerLayout businessName={slot.profiles?.name || "Business"} hideGuestSignInCta hideAccountControls hideHeader>
        <Card className="w-full p-6 sm:p-7 space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <ExternalLink className="w-5 h-5 text-primary shrink-0" />
              <span>Finish on booking site</span>
            </div>
            <p className="text-muted-foreground">
              Complete this appointment on {merchantWebsiteLabel}
            </p>
          </div>

          <div className="space-y-4">
            {slot.appointment_name && (
              <BookingDetailRow icon={Scissors} label="Service">
                <p className="text-muted-foreground">{slot.appointment_name}</p>
              </BookingDetailRow>
            )}

            <BookingDetailRow icon={Calendar} label="Date & Time">
              <p className="text-muted-foreground">{format(new Date(slot.start_time), "EEEE, MMMM d, yyyy")}</p>
              <p className="text-muted-foreground font-medium">
                {format(new Date(slot.start_time), "h:mm a")} – {format(new Date(slot.end_time), "h:mm a")}
              </p>
            </BookingDetailRow>

            <BookingDetailRow icon={Clock} label="Duration">
              <p className="text-muted-foreground">{appointmentDurationMinutes} minutes</p>
            </BookingDetailRow>

            {slot.profiles?.address && (
              <BookingDetailRow icon={MapPin} label="Location">
                <p className="text-muted-foreground">{slot.profiles.address}</p>
              </BookingDetailRow>
            )}

            {slot.staff_name && (
              <BookingDetailRow icon={User} label="Staff">
                <p className="text-muted-foreground">{slot.staff_name}</p>
              </BookingDetailRow>
            )}
          </div>

          <div className="rounded-md border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Your appointment isn&apos;t confirmed here until you complete booking there</span>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              const url = slot.profiles?.booking_url?.trim();
              if (url && openMerchantBookingUrl(url)) {
                return;
              }
              toast({
                title: "Booking site unavailable",
                description: "The merchant booking site is unavailable right now. Please call the merchant for help.",
                variant: "destructive",
              });
            }}
            disabled={!slot.profiles?.booking_url}
          >
            Return to Booking Site
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Need help?</p>
            <Button variant="outline" className="w-full" asChild>
              <a href={`tel:${slot.profiles?.phone}`}>
                Call {slot.profiles?.name || "Merchant"}
              </a>
            </Button>
          </div>
        </Card>
      </ConsumerLayout>
    );
  }


  return (
    <ConsumerLayout businessName={slot.profiles?.name || "Business"} hideGuestSignInCta hideAccountControls hideHeader>
      <Card className="w-full overflow-hidden">
        {/* Timer Badge with urgency colors */}
        {status === "held" && (
          <div className={cn(
            "px-4 py-2.5 text-center text-sm font-medium transition-colors duration-300",
            getTimerStyle(timeLeft)
          )}>
            <Clock className="w-4 h-4 inline mr-1.5" />
            Held for {formatTime(timeLeft)}
          </div>
        )}

        <div className="p-6 sm:p-7">
          <div className="text-center mb-6">
            <p className="text-base font-semibold text-foreground mb-3">
              {slot.profiles?.name || "Business"}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-success/10 text-success rounded-full text-sm font-medium mb-3">
              <Bell className="w-4 h-4" />
              One spot just opened
            </div>
            {slot.profiles?.address && (
              <p className="text-xs text-muted-foreground">{slot.profiles.address}</p>
            )}
          </div>

          <div className="bg-secondary/70 rounded-xl p-5 mb-6 text-center space-y-2">
            {slot.appointment_name && (
              <div className="text-lg font-semibold text-primary">
                {slot.appointment_name}
              </div>
            )}
            {slot.staff_name && (
              <div className="text-sm text-muted-foreground">
                {slot.staff_name}
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(slot.start_time), "EEEE, MMMM d")}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {format(new Date(slot.start_time), "h:mm a")}–{format(new Date(slot.end_time), "h:mm a")}
            </div>
            <div className="text-sm text-muted-foreground">
              {appointmentDurationMinutes} min
            </div>
          </div>

          {status === "available" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <div className="relative">
                  <PhoneInput
                    value={consumerPhone}
                    onChange={handlePhoneChange}
                    required
                    disabled={isSubmitting || phoneReadOnly}
                    error={!!phoneError}
                    placeholder="(555) 123-4567"
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-destructive">{phoneError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={consumerName}
                  onChange={(e) => {
                    setConsumerName(e.target.value);
                  }}
                  required
                  disabled={isSubmitting || nameReadOnly}
                />
              </div>

              {isRemembered && (
                <p className="text-xs text-muted-foreground">
                  {welcomeBackLabel} ·{" "}
                  <button
                    type="button"
                    onClick={clearRememberedIdentity}
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Change
                  </button>
                </p>
              )}

              <Button
                onClick={handleBookSlot}
                size="lg"
                className="w-full"
                disabled={!consumerName.trim() || !consumerPhone.trim() || isSubmitting || !!phoneError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isExternalBooking ? "Continuing..." : requiresManualConfirmation ? "Sending request..." : "Booking..."}
                  </>
                ) : (
                  <>
                    {isExternalBooking
                      ? "Continue to Booking Site"
                      : requiresManualConfirmation
                        ? "Request Appointment"
                        : "Book Appointment"}
                    {isExternalBooking && <ExternalLink className="w-4 h-4 ml-2" />}
                  </>
                )}
              </Button>

              {isExternalBooking && (
                <p className="text-xs text-muted-foreground text-center">
                  You&apos;ll finish booking on {merchantWebsiteLabel}. Your spot isn&apos;t confirmed until booking is completed there.
                </p>
              )}

              {!isExternalBooking && requiresManualConfirmation && (
                <p className="text-xs text-muted-foreground text-center">
                  {slot.profiles?.name || "The merchant"} will confirm this appointment before it&apos;s booked
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </ConsumerLayout>
  );
};

export default ClaimBooking;
