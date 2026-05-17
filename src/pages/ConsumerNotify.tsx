import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Bell, CalendarIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ConsumerLayout } from "@/components/consumer/ConsumerLayout";
import { format } from "date-fns";
import { useConsumerAuth } from "@/hooks/useConsumerAuth";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { normalizePhoneToE164 } from "@/utils/phoneValidation";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AVAILABILITY_OPTIONS = {
  TODAY: "today",
  NEXT_3_DAYS: "3-days",
  NEXT_7_DAYS: "1-week",
  CUSTOM: "custom",
} as const;

type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[keyof typeof AVAILABILITY_OPTIONS];

// Confetti piece component - simple circles and squares
const ConfettiPiece = ({
  index,
  color,
  startX
}: {
  index: number;
  color: string;
  startX: number;
}) => {
  const isCircle = index % 2 === 0;
  const size = 5 + Math.random() * 5;
  const rotation = Math.random() * 360;
  const xDrift = (Math.random() - 0.5) * 180;
  const delay = index * 0.015;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${startX}%`,
        top: "35%",
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: isCircle ? "50%" : "2px",
      }}
      initial={{ y: 0, x: 0, opacity: 1, scale: 0, rotate: rotation }}
      animate={{
        y: [0, -120 - Math.random() * 80],
        x: [0, xDrift],
        opacity: [1, 1, 0],
        scale: [0, 1, 0.6],
        rotate: [rotation, rotation + (Math.random() > 0.5 ? 360 : -360)]
      }}
      transition={{
        duration: 1 + Math.random() * 0.3,
        delay,
        ease: [0.22, 1, 0.36, 1]
      }}
    />
  );
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return value;
  const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : "+1 ";
  const area = digits.slice(-10, -7);
  const lastFour = digits.slice(-4);
  return `${country}${area} ••• ${lastFour}`;
};

const getSelectedWindowLabel = (
  timeRange: AvailabilityOption,
  merchantTimeZone: string,
  customStartDate?: Date,
  customEndDate?: Date,
) => {
  if (timeRange === AVAILABILITY_OPTIONS.TODAY) {
    return "Today only";
  }

  if (timeRange === AVAILABILITY_OPTIONS.NEXT_3_DAYS) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 2);
    const formattedEnd = new Intl.DateTimeFormat("en-US", {
      timeZone: merchantTimeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(endDate);
    return `Today–${formattedEnd}`;
  }

  if (timeRange === AVAILABILITY_OPTIONS.NEXT_7_DAYS) {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 6);
    const formattedEnd = new Intl.DateTimeFormat("en-US", {
      timeZone: merchantTimeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(endDate);
    return `Today–${formattedEnd}`;
  }

  if (customStartDate && customEndDate) {
    return "Selected dates";
  }

  return "Selected dates";
};

// Success state component - matches app design language
const SuccessState = ({
  phone,
  selectedWindowLabel
}: {
  phone: string;
  selectedWindowLabel: string;
}) => {
  // Use primary color variants for confetti to match app theme
  const confettiColors = ["#3b82f6", "#60a5fa", "#22c55e", "#4ade80", "#a855f7", "#c084fc"];
  const confettiCount = 24;

  return (
    <Card className="w-full p-8 text-center overflow-hidden relative">
      {/* Confetti burst */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: confettiCount }).map((_, i) => (
          <ConfettiPiece
            key={i}
            index={i}
            color={confettiColors[i % confettiColors.length]}
            startX={30 + Math.random() * 40}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <motion.div
          className="mb-6 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
        >
          <CheckCircle2 className="w-16 h-16 text-green-500" />
        </motion.div>

        <motion.h1
          className="text-2xl font-bold mb-3"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          You&apos;re on the waitlist
        </motion.h1>

        <motion.p
          className="text-muted-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          We&apos;ll text <span className="font-semibold text-foreground">{maskPhone(phone)}</span>{" "}
          if an appointment opens.
        </motion.p>

        <p className="text-sm text-muted-foreground mt-1">{selectedWindowLabel}</p>
        <p className="text-xs text-muted-foreground mt-4">You can reply STOP anytime to opt out.</p>
      </div>
    </Card>
  );
};

const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const REMEMBER_ME_STORAGE_KEY = "consumer_notify_remembered_info";

const ConsumerNotify = () => {
  const { businessId, locationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeRange, setTimeRange] = useState<AvailabilityOption>(AVAILABILITY_OPTIONS.TODAY);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [didPrefillFromRemember, setDidPrefillFromRemember] = useState(false);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [staffSelection, setStaffSelection] = useState("any");
  const [merchantInfo, setMerchantInfo] = useState({
    businessName: "Business",
    locationName: "",
    phone: "",
    address: "",
    bookingUrl: "",
    timeZone: "",
    locationId: ""
  });

  const { state: authState, actions: authActions } = useConsumerAuth({
    phone,
    onNameAutofill: (autofilledName) => setName(autofilledName),
    authStrategy: "none",
  });

  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (!authState.session?.user && stored) {
      try {
        const parsed = JSON.parse(stored) as { name?: string; phone?: string };
        if (parsed?.name || parsed?.phone) {
          setName(parsed.name || "");
          setPhone(parsed.phone || "");
          setSaveInfo(true);
          setDidPrefillFromRemember(true);
        }
      } catch {
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
      }
    }
  }, [authState.session?.user]);

  useEffect(() => {
    const fetchBusinessInfo = async () => {
      if (!businessId) {
        setBusinessError("Invalid notification link");
        return;
      }

      if (!isValidUUID(businessId)) {
        setBusinessError("Invalid notification link. Please check the URL.");
        return;
      }

      if (locationId && !isValidUUID(locationId)) {
        setBusinessError("Invalid location link. Please check the URL.");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("business_name, phone, address, booking_url, time_zone, default_location_id")
          .eq("id", businessId)
          .maybeSingle();

        if (error) {
          setBusinessError("Unable to load business information");
          return;
        }

        if (!data) {
          setBusinessError("Business not found. Please contact the business for a valid link.");
          return;
        }

        const resolvedLocationId = locationId || data.default_location_id || "";
        if (!resolvedLocationId) {
          setBusinessError("Business location not found.");
          return;
        }

        let locationInfo: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          time_zone: string | null;
        } | null = null;

        const { data: locationData, error: locationError } = await supabase.rpc("get_public_location", {
          p_merchant_id: businessId,
          p_location_id: resolvedLocationId,
        });

        if (locationError) {
          console.warn("Failed to load location info:", locationError);
        } else if (locationData && locationData.length > 0) {
          locationInfo = locationData[0];
        }

        if (locationId && !locationInfo) {
          setBusinessError("Location not found. Please check the URL.");
          return;
        }

        setMerchantInfo({
          businessName: data.business_name,
          locationName: locationInfo?.name || "",
          phone: locationInfo?.phone || data.phone || "",
          address: locationInfo?.address || data.address || "",
          bookingUrl: data.booking_url || "",
          timeZone: locationInfo?.time_zone || data.time_zone || "",
          locationId: resolvedLocationId
        });

        const { data: staffData, error: staffError } = await supabase.rpc("get_public_staff", {
          p_merchant_id: businessId,
          p_location_id: resolvedLocationId || null,
        });

        if (staffError) {
          console.error("Failed to load staff options:", staffError);
          setStaffOptions([]);
          return;
        }

        const resolvedStaff = Array.from(
          new Map(
            (staffData || [])
              .filter((staff) => Boolean(staff.id) && Boolean(staff.name?.trim()))
              .map((staff) => [
                staff.id,
                {
                  id: staff.id,
                  name: staff.name.trim(),
                },
              ])
          ).values()
        );
        setStaffOptions(resolvedStaff);
        setStaffSelection(resolvedStaff.length > 1 ? "any" : resolvedStaff[0]?.id || "any");

        if (!locationId && resolvedLocationId) {
          navigate(`/notify/${businessId}/${resolvedLocationId}`, { replace: true });
        }
      } catch {
        setBusinessError("An error occurred loading business information");
      }
    };

    fetchBusinessInfo();
  }, [businessId, locationId, navigate]);

  useEffect(() => {
    if (authState.session?.user && authState.consumerData) {
      const fallbackName =
        authState.session.user.user_metadata?.full_name ||
        authState.session.user.user_metadata?.name ||
        authState.session.user.user_metadata?.display_name ||
        "";
      const resolvedName = authState.consumerData.name || fallbackName;
      if (resolvedName) {
        setName(resolvedName);
      }
      if (authState.consumerData.phone) {
        setPhone(authState.consumerData.phone);
      }
    }
  }, [authState.session, authState.consumerData]);

  const handlePhoneChange = (value: string | undefined) => {
    setPhone(value || "");
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    setCustomStartDate(date);
    setCustomDateError(null);
    if (date && customEndDate && customEndDate.getTime() < date.getTime()) {
      setCustomEndDate(undefined);
    }
    if (date) setIsStartDatePickerOpen(false);
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (customStartDate && date && date.getTime() < customStartDate.getTime()) {
      setCustomDateError("End date must be after start date.");
      return;
    }
    setCustomEndDate(date);
    setCustomDateError(null);
    if (date) setIsEndDatePickerOpen(false);
  };

  const formatDateInTimeZone = (date: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
  };

  const formatRangeEndLabel = (offsetDays: number) => {
    const timeZone = merchantInfo.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + offsetDays);

    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(endDate);
  };

  const formatMonthDayLabel = (date: Date) => {
    const timeZone = merchantInfo.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const getAvailabilityHelperText = (): string | null => {
    if (timeRange === AVAILABILITY_OPTIONS.TODAY) {
      return null;
    }

    if (timeRange === AVAILABILITY_OPTIONS.NEXT_3_DAYS) {
      return `Openings today–${formatRangeEndLabel(2)}`;
    }

    if (timeRange === AVAILABILITY_OPTIONS.NEXT_7_DAYS) {
      return `Openings today–${formatRangeEndLabel(6)}`;
    }

    if (customStartDate && customEndDate) {
      return `Openings ${formatMonthDayLabel(customStartDate)}–${formatMonthDayLabel(customEndDate)}`;
    }

    return null;
  };

  const clearRememberedIdentity = async () => {
    if (authState.session && !authState.isGuest) {
      await authActions.handleContinueAsGuest();
    }

    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    setDidPrefillFromRemember(false);
    setSaveInfo(true);
    setName("");
    setPhone("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId) {
      toast({
        title: "Error",
        description: "Invalid business ID",
        variant: "destructive",
      });
      return;
    }

    if (timeRange === AVAILABILITY_OPTIONS.CUSTOM && (!customStartDate || !customEndDate)) {
      toast({
        title: "Choose your dates",
        description: "Please select both a start and end date.",
        variant: "destructive",
      });
      return;
    }

    if (
      timeRange === AVAILABILITY_OPTIONS.CUSTOM &&
      customStartDate &&
      customEndDate &&
      customEndDate.getTime() < customStartDate.getTime()
    ) {
      setCustomDateError("End date must be after start date.");
      toast({
        title: "Invalid date range",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneToE164(phone);
      } catch (normalizationError: unknown) {
        const normalizationMessage = normalizationError instanceof Error
          ? normalizationError.message
          : "Please enter a valid phone number";
        toast({
          title: "Invalid phone number",
          description: normalizationMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      let consumerId: string;

      if (authState.session?.user) {
        const { data: existingConsumer } = await supabase
          .from("consumers")
          .select("id")
          .eq("user_id", authState.session.user.id)
          .maybeSingle();

        if (existingConsumer) {
          const { error: updateError } = await supabase
            .from("consumers")
            .update({ name, phone: normalizedPhone, saved_info: saveInfo })
            .eq("id", existingConsumer.id);

          if (updateError) throw updateError;
          consumerId = existingConsumer.id;
        } else {
          const { data: newConsumer, error: insertError } = await supabase
            .from("consumers")
            .insert({ name, phone: normalizedPhone, saved_info: saveInfo, user_id: authState.session.user.id })
            .select("id")
            .single();

          if (insertError) throw insertError;
          consumerId = newConsumer.id;
        }
      } else {
        const { data: existingConsumer } = await supabase
          .from("consumers")
          .select("id")
          .eq("phone", normalizedPhone)
          .maybeSingle();

        if (existingConsumer) {
          consumerId = existingConsumer.id;

          const { error: updateError } = await supabase
            .from("consumers")
            .update({
              name,
              saved_info: saveInfo
            })
            .eq("id", consumerId);

          if (updateError) throw updateError;
        } else {
          const { data: newConsumer, error: insertError } = await supabase
            .from("consumers")
            .insert({
              name,
              phone: normalizedPhone,
              saved_info: saveInfo
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          consumerId = newConsumer.id;
        }
      }

      if (authState.session?.user) {
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
      } else if (saveInfo) {
        localStorage.setItem(
          REMEMBER_ME_STORAGE_KEY,
          JSON.stringify({ name, phone: normalizedPhone })
        );
      } else {
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
      }

      const timeZone = merchantInfo.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      let timeRangeToStore = timeRange;
      if (timeRange === AVAILABILITY_OPTIONS.TODAY) {
        timeRangeToStore = formatDateInTimeZone(new Date(), timeZone) as AvailabilityOption;
      }

      if (!merchantInfo.locationId) {
        throw new Error("Location not found. Please use a valid link.");
      }

      const { data: existingRequest } = await supabase
        .from("notify_requests")
        .select("id, time_range, staff_id")
        .eq("merchant_id", businessId)
        .eq("consumer_id", consumerId)
        .eq("location_id", merchantInfo.locationId)
        .maybeSingle();

      const resolvedStaffId = staffSelection === "any" ? null : staffSelection;
      if (existingRequest) {
        if (existingRequest.time_range !== timeRangeToStore || existingRequest.staff_id !== resolvedStaffId) {
          const { error: updateError } = await supabase
            .from("notify_requests")
            .update({ time_range: timeRangeToStore, staff_id: resolvedStaffId })
            .eq("id", existingRequest.id);

          if (updateError) throw updateError;

          setSubmitted(true);
          toast({
            title: "Preferences updated",
            description: "We’ve updated your waitlist preferences.",
          });
          return;
        }

        setSubmitted(true);
        toast({
          title: "Already on the waitlist",
          description: "You’re already signed up for alerts.",
        });
        return;
      }

      const { error: notifyError } = await supabase
        .from("notify_requests")
        .insert({
          merchant_id: businessId,
          consumer_id: consumerId,
          time_range: timeRangeToStore,
          location_id: merchantInfo.locationId || null,
          staff_id: resolvedStaffId
        });

      if (notifyError) throw notifyError;

      setSubmitted(true);
      toast({
        title: "You’re on the waitlist",
        description: "We’ll text you if an opening appears.",
      });
    } catch (error: unknown) {
      console.error("Error submitting:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit request";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    const selectedWindowLabel = getSelectedWindowLabel(
      timeRange,
      merchantInfo.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      customStartDate,
      customEndDate
    );

    return (
      <ConsumerLayout businessName={merchantInfo.businessName} hideGuestSignInCta>
        <SuccessState phone={phone} selectedWindowLabel={selectedWindowLabel} />
      </ConsumerLayout>
    );
  }

  if (businessError) {
    return (
      <ConsumerLayout businessName="OpenAlert" hideGuestSignInCta>
        <Card className="w-full p-8 text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Unable to Load Page</h1>
          <p className="text-muted-foreground mb-6">
            {businessError}
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact the business for a valid notification link.
          </p>
        </Card>
      </ConsumerLayout>
    );
  }

  const isRemembered = didPrefillFromRemember || Boolean(authState.session && authState.consumerData);
  const nameReadOnly = Boolean(authState.session && !authState.isGuest);
  const phoneReadOnly = Boolean(authState.session && !authState.isGuest);
  const availabilityHelperText = getAvailabilityHelperText();
  const firstName = name.trim().split(/\s+/)[0] || "";
  const welcomeBackLabel = firstName ? `Welcome back, ${firstName}` : "Welcome back";
  const normalizedBusinessName = merchantInfo.businessName.trim().toLowerCase();
  const normalizedLocationName = merchantInfo.locationName.trim().toLowerCase();
  const normalizedAddress = merchantInfo.address.trim().toLowerCase();
  const shouldShowLocationName =
    Boolean(merchantInfo.locationName.trim()) &&
    normalizedLocationName !== normalizedBusinessName &&
    !normalizedAddress.includes(normalizedLocationName);
  const formattedLocationName = shouldShowLocationName
    ? (merchantInfo.locationName.trim() === merchantInfo.locationName.trim().toLowerCase()
        ? merchantInfo.locationName.trim().replace(/\b[a-z]/g, (char) => char.toUpperCase())
        : merchantInfo.locationName.trim())
    : "";
  const detailItems: Array<{ type: "text" | "link"; value: string }> = [];
  if (formattedLocationName) {
    detailItems.push({ type: "text", value: formattedLocationName });
  }
  if (merchantInfo.address.trim()) {
    detailItems.push({ type: "text", value: merchantInfo.address.trim() });
  }
  if (merchantInfo.bookingUrl.trim()) {
    detailItems.push({ type: "link", value: "Website" });
  }

  return (
    <ConsumerLayout businessName={merchantInfo.businessName} hideGuestSignInCta>
      <Card className="w-full p-6 sm:p-7">
        <div className="mb-6 space-y-4">
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">{merchantInfo.businessName}</p>
            <h1 className="text-2xl font-bold mt-2">Join the waitlist</h1>
            <p className="text-muted-foreground mt-1">
              We’ll text you if an appointment opens
            </p>
          </div>

          {detailItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground pt-2 border-t">
              {detailItems.map((item, index) => (
                <div key={`${item.type}-${item.value}-${index}`} className="flex items-center gap-3">
                  {index > 0 && <span aria-hidden="true">·</span>}
                  {item.type === "text" ? (
                    <span>{item.value}</span>
                  ) : (
                    <a
                      href={merchantInfo.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{item.value}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <div className="relative mt-1">
              <PhoneInput
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                required
                disabled={phoneReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <div className="relative">
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                required
                disabled={nameReadOnly}
                readOnly={nameReadOnly}
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
          </div>

          <div className="space-y-2">
            <Label className="text-sm">When should we notify you?</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTimeRange(AVAILABILITY_OPTIONS.TODAY);
                  setCustomDateError(null);
                }}
                className={cn(
                  "w-full h-9 text-sm font-medium",
                  timeRange === AVAILABILITY_OPTIONS.TODAY &&
                    "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
                )}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTimeRange(AVAILABILITY_OPTIONS.NEXT_3_DAYS);
                  setCustomDateError(null);
                }}
                className={cn(
                  "w-full h-9 text-sm font-medium",
                  timeRange === AVAILABILITY_OPTIONS.NEXT_3_DAYS &&
                    "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
                )}
              >
                Next 3 days
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTimeRange(AVAILABILITY_OPTIONS.NEXT_7_DAYS);
                  setCustomDateError(null);
                }}
                className={cn(
                  "w-full h-9 text-sm font-medium",
                  timeRange === AVAILABILITY_OPTIONS.NEXT_7_DAYS &&
                    "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
                )}
              >
                Next 7 days
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTimeRange(AVAILABILITY_OPTIONS.CUSTOM);
                  setCustomDateError(null);
                }}
                className={cn(
                  "w-full h-9 text-sm font-medium",
                  timeRange === AVAILABILITY_OPTIONS.CUSTOM &&
                    "bg-accent text-accent-foreground border-accent hover:bg-accent/80"
                )}
              >
                Choose dates
              </Button>
            </div>
            {availabilityHelperText && (
              <p className="text-xs text-muted-foreground">{availabilityHelperText}</p>
            )}
          </div>

          {timeRange === AVAILABILITY_OPTIONS.CUSTOM && (
            <div className="space-y-4 p-4 border rounded-lg bg-secondary/50">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Start date</Label>
                  <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={handleStartDateSelect}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End date</Label>
                  <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={handleEndDateSelect}
                        disabled={customStartDate ? { before: customStartDate } : undefined}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {customDateError && (
                <p className="text-xs text-destructive">{customDateError}</p>
              )}
            </div>
          )}

          {staffOptions.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm">Preferred staff</Label>
              <Select value={staffSelection} onValueChange={setStaffSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Any staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any staff</SelectItem>
                  {staffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Any staff gives you the best chance of getting an opening.
              </p>
            </div>
          )}

          {!authState.session && !isRemembered && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="save-info"
                checked={saveInfo}
                onCheckedChange={(checked) => setSaveInfo(checked as boolean)}
              />
              <label
                htmlFor="save-info"
                className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me next time
              </label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full font-semibold"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Notify Me
              </>
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-5">
          By submitting, you agree to receive text alerts from {merchantInfo.businessName}. Reply STOP to opt out. Msg & data rates may apply.
        </p>
      </Card>
    </ConsumerLayout>
  );
};

export default ConsumerNotify;
