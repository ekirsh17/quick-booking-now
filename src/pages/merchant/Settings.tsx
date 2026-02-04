import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, UNSAFE_NavigationContext } from "react-router-dom";
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
  Plus,
  Building2,
  Clock,
  CalendarDays,
  Settings2,
  Link2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkingHours } from "@/types/openings";
import { useAppointmentPresets } from "@/hooks/useAppointmentPresets";
import { useDurationPresets } from "@/hooks/useDurationPresets";
import { CalendarIntegration } from "@/components/merchant/CalendarIntegration";
import { SettingsSection, SettingsDivider, SettingsSubsection } from "@/components/settings/SettingsSection";
import { cn } from "@/lib/utils";
import { BUSINESS_TYPE_OPTIONS } from "@/types/businessProfile";

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
  const [bookingSystemProvider, setBookingSystemProvider] = useState("");
  const [autoOpeningsEnabled, setAutoOpeningsEnabled] = useState(false);
  const [inboundEmailAddress, setInboundEmailAddress] = useState("");
  const [inboundEmailStatus, setInboundEmailStatus] = useState("");
  const [inboundEmailVerifiedAt, setInboundEmailVerifiedAt] = useState<string | null>(null);
  const [inboundEmailVerificationUrl, setInboundEmailVerificationUrl] = useState("");
  const [defaultDuration, setDefaultDuration] = useState<number | "">(30);
  const [avgAppointmentValue, setAvgAppointmentValue] = useState<number | "">(70);
  const [newAppointmentType, setNewAppointmentType] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [loading, setLoading] = useState(true);

  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTx, setPendingTx] = useState<BlockerTx | null>(null);

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
      requireConfirmation,
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
    useBookingSystem,
    bookingSystemProvider,
    autoOpeningsEnabled,
    defaultDuration,
    avgAppointmentValue,
    workingHours,
  ]);

  const initialSnapshotSeed = useRef(currentSnapshot);

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
          "business_name, email, phone, address, time_zone, default_location_id, business_type, business_type_other, weekly_appointments, team_size, booking_url, require_confirmation, use_booking_system, booking_system_provider, auto_openings_enabled, inbound_email_status, inbound_email_verified_at, default_opening_duration, avg_appointment_value, working_hours"
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
        setBookingUrl(profile.booking_url || "");
        setRequireConfirmation(profile.require_confirmation || false);
        setUseBookingSystem(profile.use_booking_system || false);
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
            bookingUrl: profile.use_booking_system ? profile.booking_url || "" : null,
            requireConfirmation: profile.require_confirmation || false,
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

  useEffect(() => {
    const fetchInboundEmailConfig = async () => {
      if (!useBookingSystem || !autoOpeningsEnabled) {
        setInboundEmailAddress("");
        setInboundEmailVerificationUrl("");
        return;
      }

      const { data, error } = await supabase.rpc("ensure_inbound_email");
      if (error) {
        console.error("Failed to ensure inbound email:", error);
        return;
      }

      const config = Array.isArray(data) ? data[0] : data;
      if (config?.inbound_email_address) {
        setInboundEmailAddress(config.inbound_email_address);
      }
      if (config?.inbound_email_status) {
        setInboundEmailStatus(config.inbound_email_status);
      }
      if (config?.inbound_email_verified_at) {
        setInboundEmailVerifiedAt(config.inbound_email_verified_at);
      }

      if (userId) {
        const { data: events } = await supabase
          .from("email_inbound_events")
          .select("parsed_data, event_type, created_at")
          .eq("merchant_id", userId)
          .eq("event_type", "forwarding_verification")
          .order("created_at", { ascending: false })
          .limit(1);

        const latest = events?.[0];
        const verificationUrl = (latest?.parsed_data as { verification_url?: string } | null)?.verification_url || "";
        setInboundEmailVerificationUrl(verificationUrl);
      }
    };

    fetchInboundEmailConfig();
  }, [useBookingSystem, autoOpeningsEnabled, userId]);

  const handleSave = async () => {
    if (autoOpeningsEnabled && !useBookingSystem) {
      toast({
        title: "Enable Booking System",
        description: "Turn on your external booking system before enabling auto-openings.",
        variant: "destructive",
      });
      return;
    }

    if (autoOpeningsEnabled && !bookingSystemProvider) {
      toast({
        title: "Select Booking System",
        description: "Please choose your booking system to enable auto-openings.",
        variant: "destructive",
      });
      return;
    }

    if (useBookingSystem && !bookingUrl.trim()) {
      toast({
        title: "Booking URL Required",
        description: "Please enter your booking system URL.",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address for billing and receipts.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (useBookingSystem && bookingUrl.trim()) {
      try {
        new URL(bookingUrl);
      } catch {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL (e.g., https://example.com)",
          variant: "destructive",
        });
        return;
      }
    }

    if (businessType === "other" && !businessTypeOther.trim()) {
      toast({
        title: "Business Type Required",
        description: "Please describe your business type.",
        variant: "destructive",
      });
      return;
    }

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
        booking_url: useBookingSystem ? bookingUrl : null,
        require_confirmation: requireConfirmation,
        use_booking_system: useBookingSystem,
        booking_system_provider: bookingSystemProvider || null,
        auto_openings_enabled: autoOpeningsEnabled,
        default_opening_duration: typeof defaultDuration === "number" ? defaultDuration : 30,
        avg_appointment_value: typeof avgAppointmentValue === "number" ? avgAppointmentValue : 70,
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

    toast({
      title: "Settings saved",
      description: "Your changes have been updated successfully.",
    });
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
        description: "Enter 5 minutes to 8 hours.",
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
    <div className="max-w-2xl mx-auto space-y-6 pb-4">
      <AlertDialog open={showUnsavedDialog} onOpenChange={handleDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Business Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStayOnPage}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeavePage}>Leave without saving</AlertDialogAction>
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
              Manage your business details and preferences.
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
              onChange={(value) => setPhone(value || "")}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
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
        description="Defaults for new openings"
        icon={Clock}
        collapsible
        defaultOpen={false}
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
        description={`${enabledDaysCount} ${enabledDaysCount === 1 ? "day" : "days"} enabled`}
        icon={CalendarDays}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className={cn(
                "flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors",
                workingHours[day]?.enabled ? "bg-secondary/30" : "opacity-60"
              )}
            >
              <Switch
                checked={workingHours[day]?.enabled || false}
                onCheckedChange={(enabled) => {
                  setWorkingHours({
                    ...workingHours,
                    [day]: { ...workingHours[day], enabled },
                  });
                }}
              />
              <div className="w-20 font-medium text-sm capitalize">{day}</div>
              {workingHours[day]?.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={workingHours[day]?.start || "06:00"}
                    onValueChange={(value) => {
                      setWorkingHours({
                        ...workingHours,
                        [day]: { ...workingHours[day], start: value },
                      });
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">to</span>
                  <Select
                    value={workingHours[day]?.end || "20:00"}
                    onValueChange={(value) => {
                      setWorkingHours({
                        ...workingHours,
                        [day]: { ...workingHours[day], end: value },
                      });
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Booking Rules"
        description="Control how bookings are handled"
        icon={Settings2}
        collapsible
        defaultOpen={false}
      >
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex-1">
            <div className="font-medium text-sm">Require Manual Confirmation</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and approve each booking request before it is confirmed
            </p>
          </div>
          <Switch
            checked={requireConfirmation}
            onCheckedChange={setRequireConfirmation}
          />
        </div>

        <SettingsDivider />

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1">
              <div className="font-medium text-sm">Use External Booking System</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Redirect customers to your existing booking system
              </p>
            </div>
            <Switch
              checked={useBookingSystem}
              onCheckedChange={setUseBookingSystem}
            />
          </div>

          {useBookingSystem && (
            <div className="pl-4 pt-2 border-l-2 border-primary/20">
              <Label className="text-sm">Booking System</Label>
              <Select value={bookingSystemProvider} onValueChange={setBookingSystemProvider}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select your booking system" />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_SYSTEM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label htmlFor="booking-url" className="text-sm mt-4 block">Booking System URL</Label>
              <Input
                id="booking-url"
                type="url"
                placeholder="https://booksy.com/your-business"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Customers will be redirected here to complete their booking
              </p>

              <div className="flex items-center justify-between gap-4 py-3 mt-4 border-t border-border/50">
                <div className="flex-1">
                  <div className="font-medium text-sm">Auto-create openings from cancellations</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Detect cancellations and create openings automatically
                  </p>
                </div>
                <Switch
                  checked={autoOpeningsEnabled}
                  onCheckedChange={setAutoOpeningsEnabled}
                />
              </div>

              {autoOpeningsEnabled && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Forwarding Address</Label>
                    <div className="flex gap-2">
                      <Input
                        value={inboundEmailAddress || "Generating..."}
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          if (!inboundEmailAddress) return;
                          await navigator.clipboard.writeText(inboundEmailAddress);
                          toast({ title: "Copied", description: "Forwarding address copied." });
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add this as a forwarding address in your booking system or email provider.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Status:</span>
                    <span>{inboundEmailStatus || "pending"}</span>
                    {inboundEmailVerifiedAt && (
                      <span>· Verified</span>
                    )}
                  </div>

                  {inboundEmailVerificationUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(inboundEmailVerificationUrl, "_blank", "noopener,noreferrer")}
                    >
                      Verify Forwarding
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Integrations"
        description="Connect external services and booking platforms"
        icon={Link2}
        collapsible
        defaultOpen={false}
      >
        <SettingsSubsection
          title="Calendar Sync"
          description="Sync bookings with your calendar"
        >
          <CalendarIntegration />
        </SettingsSubsection>
      </SettingsSection>

      <Button
        onClick={handleSave}
        size="lg"
        className="fixed bottom-24 sm:bottom-20 md:bottom-20 lg:bottom-8 right-4 sm:right-6 z-50 shadow-2xl h-12 px-6 transition-all flex items-center justify-center"
        disabled={loading}
      >
        <Check className="mr-2 h-5 w-5" />
        Save Changes
      </Button>
    </div>
  );
};

export default BusinessSettings;
