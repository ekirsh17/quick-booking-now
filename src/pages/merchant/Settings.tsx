import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, UNSAFE_NavigationContext } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Plus,
  Building2,
  Clock,
  CalendarDays,
  Loader2,
  Settings2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkingHours } from "@/types/openings";
import { useAppointmentPresets } from "@/hooks/useAppointmentPresets";
import { useDurationPresets } from "@/hooks/useDurationPresets";
import { useInboundEmailSync } from "@/hooks/useInboundEmailSync";
import { SettingsSection, SettingsDivider, SettingsSubsection } from "@/components/settings/SettingsSection";
import { cn } from "@/lib/utils";
import { BUSINESS_TYPE_OPTIONS } from "@/types/businessProfile";
import { validateAndNormalizeBookingUrl } from "@/utils/bookingUrl";
import { formatUrlForDisplay } from "@/utils/displayUrl";
import { useSetupSectionFocus } from "@/lib/setupSectionFocus";
import { useActivationContext } from "@/contexts/ActivationContext";
import { isValidPhoneNumber } from "react-phone-number-input";

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { enabled: true, start: "06:00", end: "20:00" },
  tuesday: { enabled: true, start: "06:00", end: "20:00" },
  wednesday: { enabled: true, start: "06:00", end: "20:00" },
  thursday: { enabled: true, start: "06:00", end: "20:00" },
  friday: { enabled: true, start: "06:00", end: "20:00" },
  saturday: { enabled: true, start: "06:00", end: "20:00" },
  sunday: { enabled: true, start: "06:00", end: "20:00" },
};

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const toShortDayLabel = (day: string) => `${day.charAt(0).toUpperCase()}${day.slice(1, 3)}`;
const toFullDayLabel = (day: string) => `${day.charAt(0).toUpperCase()}${day.slice(1)}`;

type BlockerTx = {
  retry: () => void;
};

const useNavigationBlocker = (blocker: (tx: BlockerTx) => void, when = true) => {
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const navigator = navigationContext?.navigator;

  useEffect(() => {
    if (!when) return;
    if (!navigator || typeof navigator.block !== "function") return;

    const unblock = navigator.block((tx: BlockerTx) => {
      const autoUnblockingTx: BlockerTx = {
        ...tx,
        retry() {
          unblock();
          tx.retry();
        },
      };

      blocker(autoUnblockingTx);
    });

    return unblock;
  }, [navigator, blocker, when]);
};

const BusinessSettings = () => {
  const { toast } = useToast();
  const { refresh: refreshSetupChecklist } = useActivationContext();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [businessTypeOther, setBusinessTypeOther] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [bookingUrl, setBookingUrl] = useState("");
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [useBookingSystem, setUseBookingSystem] = useState(false);
  const [bookingNotificationsEnabled, setBookingNotificationsEnabled] = useState(false);
  const [bookingSystemProvider, setBookingSystemProvider] = useState("");
  const [autoOpeningsEnabled, setAutoOpeningsEnabled] = useState(false);
  const [forwardingCopied, setForwardingCopied] = useState(false);
  const [showForwardingSetupHelp, setShowForwardingSetupHelp] = useState(false);
  const [defaultDuration, setDefaultDuration] = useState<number | "">(30);
  const [avgAppointmentValue, setAvgAppointmentValue] = useState<number | "">(70);
  const [newAppointmentType, setNewAppointmentType] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [bookingModeDialogAction, setBookingModeDialogAction] = useState<"external" | "manual" | "booking-notifications" | null>(null);
  const [pendingTx, setPendingTx] = useState<BlockerTx | null>(null);
  const [appointmentDefaultsOpen, setAppointmentDefaultsOpen] = useState(false);
  const [bookingRulesOpen, setBookingRulesOpen] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  useSetupSectionFocus((sectionId) => {
    if (sectionId === "appointment-defaults") {
      setAppointmentDefaultsOpen(true);
      setBookingRulesOpen(false);
      return;
    }
    if (sectionId === "booking-platform") {
      setBookingRulesOpen(true);
      setAppointmentDefaultsOpen(false);
    }
  }, { scrollDelayMs: 520 });

  useEffect(() => {
    if (!forwardingCopied) return;
    const timeoutId = window.setTimeout(() => setForwardingCopied(false), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [forwardingCopied]);

  const { presets, loading: presetsLoading, createPreset, deletePreset } = useAppointmentPresets(userId || undefined);
  const {
    presets: durationPresets,
    loading: durationPresetsLoading,
    createPreset: createDurationPreset,
    deletePreset: deleteDurationPreset,
  } = useDurationPresets(userId || undefined);

  const BOOKING_SYSTEM_OPTIONS = [
    { value: "booksy", label: "Booksy" },
    { value: "setmore", label: "Setmore" },
    { value: "square", label: "Square Appointments" },
    { value: "vagaro", label: "Vagaro" },
    { value: "fresha", label: "Fresha" },
    { value: "acuity", label: "Acuity Scheduling" },
    { value: "glossgenius", label: "GlossGenius" },
    { value: "schedulicity", label: "Schedulicity" },
    { value: "mangomint", label: "Mangomint" },
    { value: "other", label: "Other" },
  ];

  const HOURS = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return {
      value: `${hour}:00`,
      label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}`,
    };
  });

  const enabledDaysCount = DAYS.filter((day) => workingHours[day]?.enabled).length;

  const inboundEmailSyncEnabled = useBookingSystem && autoOpeningsEnabled;
  const {
    inboundEmailAddress,
    isLoading: inboundEmailLoading,
    showVerifyButton,
    isOpeningVerification,
    openForwardingVerification,
  } = useInboundEmailSync({ enabled: inboundEmailSyncEnabled, userId });

  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      businessName,
      email: email.trim() || null,
      phone,
      address,
      timezone,
      businessType,
      businessTypeOther: businessType === "other" ? businessTypeOther.trim() : "",
      bookingUrl: useBookingSystem ? bookingUrl.trim() : null,
      requireConfirmation: useBookingSystem ? false : requireConfirmation,
      bookingNotificationsEnabled,
      useBookingSystem,
      bookingSystemProvider: bookingSystemProvider || null,
      autoOpeningsEnabled,
      defaultDuration: typeof defaultDuration === "number" ? defaultDuration : 30,
      avgAppointmentValue: typeof avgAppointmentValue === "number" ? avgAppointmentValue : 70,
      workingHours,
    });
  }, [
    businessName,
    email,
    phone,
    address,
    timezone,
    businessType,
    businessTypeOther,
    bookingUrl,
    requireConfirmation,
    bookingNotificationsEnabled,
    useBookingSystem,
    bookingSystemProvider,
    autoOpeningsEnabled,
    defaultDuration,
    avgAppointmentValue,
    workingHours,
  ]);

  const initialSnapshotSeed = useRef(currentSnapshot);

  const handleUseBookingSystemChange = (checked: boolean) => {
    if (checked && requireConfirmation) {
      setBookingModeDialogAction("external");
      return;
    }
    if (checked && bookingNotificationsEnabled) {
      setBookingModeDialogAction("external");
      return;
    }
    setUseBookingSystem(checked);
    if (checked) {
      setRequireConfirmation(false);
      setBookingNotificationsEnabled(false);
    }
  };

  const handleRequireConfirmationChange = (checked: boolean) => {
    if (checked && useBookingSystem) {
      setBookingModeDialogAction("manual");
      return;
    }
    if (checked && bookingNotificationsEnabled) {
      setBookingModeDialogAction("manual");
      return;
    }
    setRequireConfirmation(checked);
    if (checked) {
      setUseBookingSystem(false);
      setBookingNotificationsEnabled(false);
    }
  };

  const handleBookingNotificationsChange = (checked: boolean) => {
    if (checked && useBookingSystem) {
      setBookingModeDialogAction("booking-notifications");
      return;
    }
    if (checked && requireConfirmation) {
      setBookingModeDialogAction("booking-notifications");
      return;
    }
    setBookingNotificationsEnabled(checked);
  };

  const handleConfirmBookingModeSwitch = () => {
    if (bookingModeDialogAction === "external") {
      setUseBookingSystem(true);
      setRequireConfirmation(false);
      setBookingNotificationsEnabled(false);
    } else if (bookingModeDialogAction === "manual") {
      setRequireConfirmation(true);
      setUseBookingSystem(false);
      setBookingNotificationsEnabled(false);
    } else if (bookingModeDialogAction === "booking-notifications") {
      setBookingNotificationsEnabled(true);
      setUseBookingSystem(false);
      setRequireConfirmation(false);
    }
    setBookingModeDialogAction(null);
  };

  const handleCancelBookingModeSwitch = () => {
    setBookingModeDialogAction(null);
  };

  const bookingModeDialogCopy = useMemo(() => {
    const formatToggleList = (labels: string[]) => {
      if (labels.length <= 1) return labels[0] || "";
      if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
      return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    };

    if (bookingModeDialogAction === "manual") {
      const togglesToDisable: string[] = [];
      if (useBookingSystem) togglesToDisable.push("External Booking Platform");
      if (bookingNotificationsEnabled) togglesToDisable.push("Booking Notifications");
      const disabledText = formatToggleList(togglesToDisable) || "External Booking Platform";
      return {
        title: "Turn on manual approval?",
        description: `Are you sure you want to turn on Manual Approval and turn off ${disabledText}?`,
      };
    }

    if (bookingModeDialogAction === "booking-notifications") {
      const togglesToDisable: string[] = [];
      if (useBookingSystem) togglesToDisable.push("External Booking Platform");
      if (requireConfirmation) togglesToDisable.push("Manual Approval");
      const disabledText = formatToggleList(togglesToDisable) || "External Booking Platform";
      return {
        title: "Turn on booking notifications?",
        description: `Are you sure you want to turn on Booking Notifications and turn off ${disabledText}?`,
      };
    }

    if (bookingModeDialogAction === "external") {
      const togglesToDisable: string[] = [];
      if (requireConfirmation) togglesToDisable.push("Manual Approval");
      if (bookingNotificationsEnabled) togglesToDisable.push("Booking Notifications");

      const disabledText = formatToggleList(togglesToDisable) || "Manual Approval";
      return {
        title: "Use external booking platform?",
        description: `Are you sure you want to turn on External Booking Platform and turn off ${disabledText}?`,
      };
    }

    return {
      title: "",
      description: "",
    };
  }, [bookingModeDialogAction, requireConfirmation, bookingNotificationsEnabled, useBookingSystem]);

  const isDirty = initialSnapshot ? currentSnapshot !== initialSnapshot : false;
  const handleBlock = useCallback((tx: BlockerTx) => {
    if (!isDirty) {
      tx.retry();
      return;
    }

    setPendingTx((current) => current ?? tx);
    setShowUnsavedDialog(true);
  }, [isDirty]);

  useNavigationBlocker(handleBlock, isDirty);

  useEffect(() => {
    if (!isDirty) {
      setShowUnsavedDialog(false);
      setPendingTx(null);
    }
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const message = "You have unsaved changes.";
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setInitialSnapshot(initialSnapshotSeed.current);
        return;
      }

      setUserId(user.id);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "business_name, email, phone, address, time_zone, default_location_id, business_type, business_type_other, weekly_appointments, team_size, booking_url, require_confirmation, use_booking_system, booking_notifications_enabled, booking_system_provider, auto_openings_enabled, inbound_email_status, inbound_email_verified_at, default_opening_duration, avg_appointment_value, working_hours"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to load business settings:", error);
      }

      if (profile) {
        const resolvedWorkingHours = (profile.working_hours as WorkingHours) || DEFAULT_WORKING_HOURS;

        setBusinessName(profile.business_name || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setTimezone(profile.time_zone || "America/New_York");
        setDefaultLocationId(profile.default_location_id || null);
        setBusinessType(profile.business_type || "");
        setBusinessTypeOther(profile.business_type === "other" ? profile.business_type_other || "" : "");
        setBookingUrl(formatUrlForDisplay(profile.booking_url || ""));
        setRequireConfirmation(profile.use_booking_system ? false : profile.require_confirmation || false);
        setUseBookingSystem(profile.use_booking_system || false);
        setBookingNotificationsEnabled(profile.booking_notifications_enabled ?? false);
        setBookingSystemProvider(profile.booking_system_provider || "");
        setAutoOpeningsEnabled(profile.auto_openings_enabled || false);
        setInboundEmailStatus(profile.inbound_email_status || "");
        setInboundEmailVerifiedAt(profile.inbound_email_verified_at || null);
        setDefaultDuration(profile.default_opening_duration || 30);
        setAvgAppointmentValue(profile.avg_appointment_value || 70);
        setWorkingHours(resolvedWorkingHours);

        setInitialSnapshot(
          JSON.stringify({
            businessName: profile.business_name || "",
            email: profile.email || null,
            phone: profile.phone || "",
            address: profile.address || "",
            timezone: profile.time_zone || "America/New_York",
            businessType: profile.business_type || "",
            businessTypeOther: profile.business_type === "other" ? profile.business_type_other || "" : "",
            bookingUrl: profile.use_booking_system ? formatUrlForDisplay(profile.booking_url || "") : null,
            requireConfirmation: profile.use_booking_system ? false : profile.require_confirmation || false,
            bookingNotificationsEnabled: profile.booking_notifications_enabled ?? false,
            useBookingSystem: profile.use_booking_system || false,
            bookingSystemProvider: profile.booking_system_provider || null,
            autoOpeningsEnabled: profile.auto_openings_enabled || false,
            defaultDuration: profile.default_opening_duration || 30,
            avgAppointmentValue: profile.avg_appointment_value || 70,
            workingHours: resolvedWorkingHours,
          })
        );
      }

      setLoading(false);
      setInitialSnapshot((existing) => existing ?? initialSnapshotSeed.current);
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (!useBookingSystem && autoOpeningsEnabled) {
      setAutoOpeningsEnabled(false);
    }
  }, [useBookingSystem, autoOpeningsEnabled]);

  const handleSave = async () => {
    const trimmedBookingUrl = bookingUrl.trim();
    const trimmedPhone = phone.trim();

    if (autoOpeningsEnabled && !useBookingSystem) {
      toast({
        title: "Enable External Booking Platform",
        description: "Turn on External Booking Platform before enabling automatic opening creation",
        variant: "destructive",
      });
      return;
    }

    if (autoOpeningsEnabled && !bookingSystemProvider) {
      toast({
        title: "Select Booking Platform",
        description: "Choose your booking platform before enabling automatic opening creation",
        variant: "destructive",
      });
      return;
    }

    if (useBookingSystem && !trimmedBookingUrl) {
      toast({
        title: "Booking Link Required",
        description: "Please enter your external booking link",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address for billing and receipts",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    let normalizedBookingUrl: string | null = null;
    if (useBookingSystem && trimmedBookingUrl) {
      const bookingUrlResult = validateAndNormalizeBookingUrl(trimmedBookingUrl);
      if (!bookingUrlResult.ok) {
        toast({
          title: "Invalid URL",
          description: `${bookingUrlResult.error} Example: https://example.com`,
          variant: "destructive",
        });
        return;
      }

      normalizedBookingUrl = bookingUrlResult.value;
    }

    if (businessType === "other" && !businessTypeOther.trim()) {
      toast({
        title: "Business Type Required",
        description: "Please describe your business type",
        variant: "destructive",
      });
      return;
    }

    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      setPhoneError("Please enter a valid phone number and try again.");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: businessName,
          email: email.trim() || null,
          phone: phone,
          address: address,
          time_zone: timezone,
          business_type: businessType || null,
          business_type_other: businessType === "other" ? businessTypeOther.trim() || null : null,
          booking_url: useBookingSystem ? normalizedBookingUrl : null,
          require_confirmation: useBookingSystem ? false : requireConfirmation,
          booking_notifications_enabled: useBookingSystem ? false : bookingNotificationsEnabled,
          use_booking_system: useBookingSystem,
          booking_system_provider: bookingSystemProvider || null,
          auto_openings_enabled: autoOpeningsEnabled,
          default_opening_duration: typeof defaultDuration === "number" ? defaultDuration : 30,
          avg_appointment_value: typeof avgAppointmentValue === "number" ? avgAppointmentValue : 70,
          aov_source: 'user_set',
          working_hours: workingHours,
        })
        .eq("id", user.id);

      if (error) {
        toast({
          title: "Save failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (defaultLocationId) {
        const { error: locationError } = await supabase
          .from("locations")
          .update({
            address: address || null,
            phone: phone || null,
            time_zone: timezone || null,
          })
          .eq("id", defaultLocationId);

        if (locationError) {
          console.error("Failed to sync default location details:", locationError);
        }
      }

      setInitialSnapshot(currentSnapshot);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("openalert:merchant-profile-updated"));
      }

      toast({
        title: "Settings saved",
        description: "Your changes have been updated successfully",
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);

      void refreshSetupChecklist();
    } finally {
      setIsSaving(false);
    }
  };

  const formatDurationForSettings = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  };

  const parseDurationInput = (input: string): number => {
    if (!input) return 0;
    const cleaned = input.toLowerCase().trim();

    if (/^\d+$/.test(cleaned)) return parseInt(cleaned);
    if (/^\d+\.\d+$/.test(cleaned)) return Math.round(parseFloat(cleaned) * 60);

    let totalMinutes = 0;
    const hourMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/);
    if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
    const minuteMatch = cleaned.match(/(\d+)\s*m(?:in)?(?:ute)?s?/);
    if (minuteMatch) totalMinutes += parseInt(minuteMatch[1]);

    return Math.round(totalMinutes);
  };

  const handleAddAppointmentType = () => {
    if (newAppointmentType.trim() && presets.length < 20) {
      createPreset(newAppointmentType.trim());
      setNewAppointmentType("");
    }
  };

  const handleAddDuration = async () => {
    if (!newDuration.trim()) return;
    const parsed = parseDurationInput(newDuration);
    if (parsed > 0 && parsed <= 480 && durationPresets.length < 20) {
      const label = formatDurationForSettings(parsed);
      await createDurationPreset(label, parsed);
      setNewDuration("");
    } else {
      toast({
        title: "Invalid duration",
        description: "Enter 5 minutes to 8 hours",
        variant: "destructive",
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setShowUnsavedDialog(true);
      return;
    }

    handleStayOnPage();
  };

  const handleStayOnPage = () => {
    setShowUnsavedDialog(false);
    setPendingTx(null);
  };

  const handleLeavePage = () => {
    if (!pendingTx) {
      setShowUnsavedDialog(false);
      return;
    }

    const retry = pendingTx.retry;
    setShowUnsavedDialog(false);
    setPendingTx(null);
    retry();
  };

  return (
    <div className="w-full space-y-6 pb-4">
      <AlertDialog open={showUnsavedDialog} onOpenChange={handleDialogOpenChange}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Business Settings
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStayOnPage}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeavePage}>Leave without saving</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(bookingModeDialogAction)}
        onOpenChange={(open) => {
          if (!open) {
            setBookingModeDialogAction(null);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{bookingModeDialogCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{bookingModeDialogCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelBookingModeSwitch}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBookingModeSwitch}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/merchant/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2">Business Settings</h1>
            <p className="text-muted-foreground">
              Manage your business details and preferences
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="Business Profile"
        description="Your business identity, contact details, and time zone"
        icon={Building2}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="mt-1"
              placeholder="Your business name"
            />
          </div>

          <div>
            <Label htmlFor="business-type">Business Type</Label>
            <Select
              value={businessType}
              onValueChange={(value) => {
                setBusinessType(value);
                if (value !== "other") {
                  setBusinessTypeOther("");
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {businessType === "other" && (
              <Input
                id="business-type-other"
                value={businessTypeOther}
                onChange={(e) => setBusinessTypeOther(e.target.value)}
                placeholder="Describe your business"
                className="mt-2"
              />
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <PhoneInput
              value={phone}
              onChange={(value) => {
                setPhone(value || "");
                if (phoneError) setPhoneError("");
              }}
              placeholder="(555) 123-4567"
              className="mt-1"
              error={!!phoneError}
              onBlur={() => {
                const trimmedPhone = phone.trim();
                if (!trimmedPhone || isValidPhoneNumber(trimmedPhone)) {
                  setPhoneError("");
                  return;
                }
                setPhoneError("Please enter a valid phone number and try again.");
              }}
            />
            {phoneError && (
              <p className="text-sm text-destructive mt-1">{phoneError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Used for account verification and notifications
            </p>
          </div>

          <div>
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
              placeholder="you@business.com"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used for receipts and billing notices
            </p>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
              placeholder="123 Main St, City, State"
            />
          </div>

          <div>
            <Label htmlFor="timezone">Time Zone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="America/Phoenix">Arizona (No DST)</SelectItem>
                <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Used for SMS scheduling and appointment times
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Appointment Defaults"
        description="Set default appointment settings and presets"
        icon={Clock}
        sectionId="appointment-defaults"
        collapsible
        open={appointmentDefaultsOpen}
        onOpenChange={setAppointmentDefaultsOpen}
      >
        <div>
          <Label htmlFor="default-duration">Default Appointment Duration</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              id="default-duration"
              type="number"
              min="5"
              max="300"
              step="5"
              value={defaultDuration}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setDefaultDuration("");
                  return;
                }
                const parsed = parseInt(value);
                if (!isNaN(parsed)) setDefaultDuration(parsed);
              }}
              onBlur={(e) => {
                const value = e.target.value;
                if (value === "" || isNaN(parseInt(value))) {
                  setDefaultDuration(30);
                  return;
                }
                const parsed = parseInt(value);
                const rounded = Math.round(parsed / 5) * 5;
                setDefaultDuration(Math.max(5, Math.min(300, rounded)));
              }}
              className="w-24"
              placeholder="30"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        <div>
          <Label htmlFor="avg-appointment-value">Average Appointment Value</Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="avg-appointment-value"
              type="number"
              min="1"
              max="10000"
              value={avgAppointmentValue}
              onChange={(e) => {
                const val = e.target.value;
                setAvgAppointmentValue(val === "" ? "" : parseInt(val) || 70);
              }}
              className="pl-7"
              placeholder="70"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used to estimate revenue recovered in reporting
          </p>
        </div>

        <SettingsDivider />

        <SettingsSubsection
          title="Appointment Types"
          description="Quick-select labels for your openings"
        >
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {presetsLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : presets.length === 0 ? (
              <span className="text-sm text-muted-foreground">No types yet</span>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="group flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full text-sm"
                >
                  <span>{preset.label}</span>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${preset.label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newAppointmentType}
              onChange={(e) => setNewAppointmentType(e.target.value)}
              placeholder="e.g., Haircut, Consultation"
              maxLength={40}
              onKeyDown={(e) => e.key === "Enter" && handleAddAppointmentType()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddAppointmentType}
              disabled={!newAppointmentType.trim() || presets.length >= 20}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection
          title="Duration Presets"
          description="Quick-select durations for your openings"
        >
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {durationPresetsLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : durationPresets.length === 0 ? (
              <span className="text-sm text-muted-foreground">No presets yet</span>
            ) : (
              durationPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="group flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-full text-sm"
                >
                  <span>{preset.label}</span>
                  <button
                    onClick={() => deleteDurationPreset(preset.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${preset.label}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              placeholder="e.g., 30, 1h, 90m"
              onKeyDown={(e) => e.key === "Enter" && handleAddDuration()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddDuration}
              disabled={!newDuration.trim() || durationPresets.length >= 20}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </SettingsSubsection>
      </SettingsSection>

      <SettingsSection
        title="Working Hours"
        description="Configure working hours and availability"
        icon={CalendarDays}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-2.5">
          {DAYS.map((day) => (
            <div
              key={day}
              className={cn(
                "rounded-xl border border-border/50 px-3 py-3 transition-colors min-w-0 sm:px-4 sm:py-3.5",
                workingHours[day]?.enabled ? "bg-secondary/20" : "bg-background/60 opacity-70"
              )}
            >
              <div className="flex flex-col gap-3 md:grid md:grid-cols-[8.5rem_minmax(0,1fr)] md:items-center md:gap-4">
                <div className="flex items-center gap-3 sm:gap-3.5">
                  <Switch
                    className="shrink-0"
                    checked={workingHours[day]?.enabled || false}
                    onCheckedChange={(enabled) => {
                      setWorkingHours({
                        ...workingHours,
                        [day]: { ...workingHours[day], enabled },
                      });
                    }}
                  />
                  <div className="font-medium leading-none text-sm sm:text-base">
                    <span className="sm:hidden">
                      {toShortDayLabel(day)}
                    </span>
                    <span className="hidden sm:inline">{toFullDayLabel(day)}</span>
                  </div>
                </div>

                {workingHours[day]?.enabled ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2.5 sm:gap-x-3 md:max-w-[27rem] lg:max-w-[30rem] xl:max-w-[34rem]">
                    <Select
                      value={workingHours[day]?.start || "06:00"}
                      onValueChange={(value) => {
                        setWorkingHours({
                          ...workingHours,
                          [day]: { ...workingHours[day], start: value },
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-sm sm:h-10 sm:px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem
                            key={hour.value}
                            value={hour.value}
                            className="pl-3 [&>span:first-child]:hidden"
                          >
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="px-1 text-sm text-muted-foreground text-center">to</span>
                    <Select
                      value={workingHours[day]?.end || "20:00"}
                      onValueChange={(value) => {
                        setWorkingHours({
                          ...workingHours,
                          [day]: { ...workingHours[day], end: value },
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 w-full min-w-0 px-2.5 text-sm sm:h-10 sm:px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem
                            key={hour.value}
                            value={hour.value}
                            className="pl-3 [&>span:first-child]:hidden"
                          >
                            {hour.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground md:pl-0">Closed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <div data-tour-target="booking-rules-section" className="lg:pb-12">
      <SettingsSection
        title="Booking Preferences"
        description="Set booking preferences and sync with an existing booking platform"
        icon={Settings2}
        sectionId="booking-platform"
        collapsible
        open={bookingRulesOpen}
        onOpenChange={setBookingRulesOpen}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1">
              <div className="font-medium text-sm">Use External Booking Platform</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Send customers to your existing booking platform to complete their booking
              </p>
            </div>
            <Switch
              checked={useBookingSystem}
              onCheckedChange={handleUseBookingSystemChange}
            />
          </div>

          {useBookingSystem && (
            <div className="mt-1 space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label className="text-sm">Booking Platform</Label>
                <Select value={bookingSystemProvider} onValueChange={setBookingSystemProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your booking platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_SYSTEM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="booking-url" className="text-sm block">Booking Link</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customers are sent to this link to complete their booking
                </p>
                <Input
                  id="booking-url"
                  type="url"
                  placeholder="booksy.com/your-business"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  onBlur={() => setBookingUrl((current) => formatUrlForDisplay(current))}
                  className="mt-2"
                />
              </div>

              <div className="border-t border-border/50" />

              <div className="flex items-center justify-between gap-4 py-1">
                <div className="flex-1 space-y-0.5">
                  <div className="font-medium text-sm">Automatically Create Openings</div>
                  <p className="text-xs text-muted-foreground">
                    When a customer cancels through your booking platform, we create an opening for that time and text your waitlist
                  </p>
                </div>
                <Switch
                  checked={autoOpeningsEnabled}
                  onCheckedChange={setAutoOpeningsEnabled}
                />
              </div>

              {autoOpeningsEnabled && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-sm">Email Sync</Label>
                    <div className="mt-0.5 space-y-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          We use this email to sync cancellations from your booking platform
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowForwardingSetupHelp((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Setup instructions
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform",
                              showForwardingSetupHelp ? "rotate-180" : "rotate-0"
                            )}
                          />
                        </button>
                      </div>
                      {showForwardingSetupHelp && (
                        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                          <li>Recommended: Add this email as a notification recipient in your booking platform&apos;s settings</li>
                          <li>Alternative: Forward cancellation emails from your inbox to this address</li>
                        </ul>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={
                          inboundEmailLoading && !inboundEmailAddress
                            ? "Generating..."
                            : inboundEmailAddress || "Generating..."
                        }
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          if (!inboundEmailAddress) return;
                          await navigator.clipboard.writeText(inboundEmailAddress);
                          setForwardingCopied(true);
                          toast({ title: "Copied", description: "Forwarding address copied" });
                        }}
                      >
                        {forwardingCopied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  {showVerifyButton && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isOpeningVerification}
                      onClick={openForwardingVerification}
                    >
                      {isOpeningVerification ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Opening verification…
                        </>
                      ) : (
                        "Complete Forwarding Verification"
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

          <SettingsDivider />
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1">
              <div className="font-medium text-sm">Approve Appointments Manually</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review appointment requests before they are booked
              </p>
            </div>
            <Switch
              checked={requireConfirmation}
              onCheckedChange={handleRequireConfirmationChange}
            />
          </div>

          <SettingsDivider />
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1">
              <div className="font-medium text-sm">Receive Booking Notifications</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get a text message when a customer books one of your openings
              </p>
            </div>
            <Switch
              checked={bookingNotificationsEnabled}
              onCheckedChange={handleBookingNotificationsChange}
            />
          </div>
      </SettingsSection>
      </div>

      <div className="fixed bottom-[88px] left-0 right-0 z-50 pointer-events-none lg:bottom-8 lg:pl-56">
        <div className="container mx-auto flex px-4 pointer-events-none justify-end lg:px-6 lg:justify-start">
          <Button
            ref={saveButtonRef}
            onClick={handleSave}
            size="lg"
            className="pointer-events-auto shadow-2xl h-12 px-4 sm:px-6 transition-all flex items-center justify-center overflow-hidden active:scale-[0.97] lg:w-[128px] lg:px-4 lg:active:scale-100 disabled:opacity-100"
            disabled={loading || isSaving || savedSuccess}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isSaving ? (
                <motion.span
                  key="loading"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving…
                </motion.span>
              ) : savedSuccess ? (
                <motion.span
                  key="saved"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  Saved!
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check className="h-5 w-5" />
                  <span>Save</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BusinessSettings;
