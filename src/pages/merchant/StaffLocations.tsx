import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, ArrowLeft, ChevronRight, CreditCard, Clock, Phone, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Staff } from "@/types/openings";
import { useSubscription } from "@/hooks/useSubscription";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { TIMEZONE_OPTIONS } from "@/types/onboarding";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { useSetupSectionFocus } from "@/lib/setupSectionFocus";
import { isValidPhoneNumber } from "react-phone-number-input";
import { normalizeLocationShareSlug, validateLocationShareSlug } from "@/lib/locationShareSlug";
import { formatPhoneForDisplay } from "@/utils/phoneValidation";
import { formatUrlForDisplay } from "@/utils/displayUrl";
import {
  bulkDeleteLocationModalBody,
  bulkDeleteStaffModalBody,
  locationDeletionWarningBody,
  staffDeletionWarningBody,
} from "@/lib/deletionBlockCopy";

interface LocationRecord {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  time_zone: string | null;
  share_slug: string;
  created_at?: string | null;
}

interface SeatLimitBannerProps {
  message: string;
  ctaLabel?: string;
}

function SeatLimitBanner({ message, ctaLabel = "Add seats" }: SeatLimitBannerProps) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
      <AlertDescription className="flex min-h-8 flex-col justify-center gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">{message}</p>
        <Button
          variant="outline"
          asChild
          size="sm"
          className="h-8 self-start px-3 text-xs !border-input !bg-background !text-foreground hover:!border-warning/40 hover:!bg-orange-50 hover:!text-warning sm:self-auto"
        >
          <Link to="/merchant/billing">{ctaLabel}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function SettingsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

interface RowIconActionsProps {
  children: ReactNode;
}

function RowIconActions({ children }: RowIconActionsProps) {
  return <div className="flex shrink-0 items-center gap-0.5">{children}</div>;
}

const timezoneSelectItemClassName = "pl-2 pr-2 [&>span:first-child]:hidden";

interface LocationMetadataLineProps {
  icon: ReactNode;
  children: ReactNode;
}

function LocationMetadataLine({ icon, children }: LocationMetadataLineProps) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <span className="mt-0.5 shrink-0 opacity-70">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

interface LocationShareLinkEditProps {
  id: string;
  slug: string;
  slugPrefix: string;
  disabled: boolean;
  error: string | null;
  hasHandle: boolean;
  onSlugChange: (value: string) => void;
}

function LocationShareLinkEdit({
  id,
  slug,
  slugPrefix,
  disabled,
  error,
  hasHandle,
  onSlugChange,
}: LocationShareLinkEditProps) {
  return (
    <div className="sm:col-span-2 space-y-1">
      <Label htmlFor={id}>Location waitlist link</Label>
      {hasHandle ? (
        <div className="mt-1 flex h-10 items-center gap-1.5 rounded-md border border-input bg-background px-2">
          <span className="max-w-[55%] shrink-0 truncate whitespace-nowrap font-mono text-[11px] text-muted-foreground sm:max-w-none sm:text-sm">
            {slugPrefix}
          </span>
          <Input
            id={id}
            value={slug}
            onChange={(e) => onSlugChange(normalizeLocationShareSlug(e.target.value))}
            disabled={disabled}
            placeholder="e.g., downtown"
            className="h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 font-mono text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ) : (
        <Input
          id={id}
          value={slug}
          onChange={(e) => onSlugChange(normalizeLocationShareSlug(e.target.value))}
          disabled={disabled}
          placeholder="e.g., downtown"
          className="mt-1 font-mono"
        />
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Waitlist link can be shared from{" "}
        <Link to="/merchant/qr-code" className="underline underline-offset-2 hover:text-foreground">
          QR Code
        </Link>
      </p>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

interface DeletionBlockActionsProps {
  bulkLabel: string;
  onBulkClick: () => void;
}

function DeletionBlockActions({ bulkLabel, onBulkClick }: DeletionBlockActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button variant="outline" asChild size="sm" className="w-full sm:w-fit">
        <Link to="/merchant/openings">Go to Openings</Link>
      </Button>
      <Button type="button" variant="outline" size="sm" className="w-full sm:w-fit" onClick={onBulkClick}>
        {bulkLabel}
      </Button>
    </div>
  );
}

const StaffLocations = () => {
  const { toast } = useToast();
  const subscriptionData = useSubscription();
  const { locationId, setActiveLocationId, refresh: refreshActiveLocation } = useActiveLocation();

  const [userId, setUserId] = useState<string | null>(null);
  const [profileTimezone, setProfileTimezone] = useState("America/New_York");
  const [merchantHandle, setMerchantHandle] = useState<string | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);

  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [newLocationPhone, setNewLocationPhone] = useState("");
  const [newLocationTimezone, setNewLocationTimezone] = useState("America/New_York");
  const [newLocationStaffFirstName, setNewLocationStaffFirstName] = useState("");
  const [newLocationStaffLastName, setNewLocationStaffLastName] = useState("");
  const [newLocationStaffError, setNewLocationStaffError] = useState<string | null>(null);
  const [newLocationPhoneError, setNewLocationPhoneError] = useState<string | null>(null);

  const [locationEditingId, setLocationEditingId] = useState<string | null>(null);
  const [locationEditName, setLocationEditName] = useState("");
  const [locationEditSlug, setLocationEditSlug] = useState("");
  const [locationEditAddress, setLocationEditAddress] = useState("");
  const [locationEditPhone, setLocationEditPhone] = useState("");
  const [locationEditPhoneError, setLocationEditPhoneError] = useState<string | null>(null);
  const [locationEditSlugError, setLocationEditSlugError] = useState<string | null>(null);
  const [locationEditTimezone, setLocationEditTimezone] = useState("America/New_York");
  const [locationAdding, setLocationAdding] = useState(false);
  const [locationSavingId, setLocationSavingId] = useState<string | null>(null);
  const [locationDeletingId, setLocationDeletingId] = useState<string | null>(null);
  const [defaultLocationUpdatingId, setDefaultLocationUpdatingId] = useState<string | null>(null);
  const [locationDeleteBlock, setLocationDeleteBlock] = useState<{
    id: string;
    name: string;
    upcomingCount: number;
    pastCount: number;
  } | null>(null);
  const [pastSlotsConfirm, setPastSlotsConfirm] = useState<{ location: LocationRecord; pastCount: number } | null>(null);
  const [bulkUpcomingConfirm, setBulkUpcomingConfirm] = useState<{ location: LocationRecord; upcomingCount: number } | null>(null);
  const [bulkStaffConfirm, setBulkStaffConfirm] = useState<{ id: string; name: string; count: number } | null>(null);

  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffNameError, setStaffNameError] = useState<string | null>(null);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);

  useSetupSectionFocus((sectionId) => {
    if (sectionId === "staff-locations") {
      setLocationsOpen(true);
      setStaffOpen(true);
    }
  }, { scrollDelayMs: 420 });
  const [staffAdding, setStaffAdding] = useState(false);
  const [staffDeletingId, setStaffDeletingId] = useState<string | null>(null);
  const [staffDeleteBlock, setStaffDeleteBlock] = useState<{ id: string; name: string; count: number } | null>(null);
  const [staffEditingId, setStaffEditingId] = useState<string | null>(null);
  const [staffEditFirstName, setStaffEditFirstName] = useState("");
  const [staffEditLastName, setStaffEditLastName] = useState("");
  const [staffEditError, setStaffEditError] = useState<string | null>(null);
  const [staffUpdatingId, setStaffUpdatingId] = useState<string | null>(null);

  const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");
  const normalizeKey = (value: string) => normalizeName(value).toLowerCase();
  const firstNameKey = (value: string) => normalizeKey(value).split(" ")[0] || "";
  const splitName = (value: string) => {
    const [first, ...rest] = normalizeName(value).split(" ");
    return { first: first || "", last: rest.join(" ") };
  };
  const errorMessage = (error: unknown) => {
    if (!error || typeof error !== "object") return "";
    const candidate = (error as { message?: unknown }).message;
    return typeof candidate === "string" ? candidate : "";
  };
  const hasErrorTag = (error: unknown, tag: string) => errorMessage(error).includes(tag);
  const getOptionalPhoneError = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return null;
    return isValidPhoneNumber(trimmedValue) ? null : "Please enter a valid phone number and try again.";
  };

  const notifyLocationsUpdated = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("openalert:locations-updated"));
  };

  const refreshLocations = async () => {
    if (!userId) return;
    setLocationsLoading(true);
    setLocationsError(null);

    const { data, error } = await supabase
      .from("locations")
      .select("id, name, address, phone, time_zone, share_slug, created_at")
      .eq("merchant_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch locations:", error);
      setLocationsError("Unable to load locations");
      setLocations([]);
    } else {
      setLocations((data as LocationRecord[]) || []);
    }

    setLocationsLoading(false);
  };

  const refreshStaff = async () => {
    if (!userId || !locationId) {
      setStaffMembers([]);
      setStaffLoading(false);
      return;
    }
    setStaffLoading(true);
    setStaffError(null);
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, is_primary, active")
      .eq("merchant_id", userId)
      .eq("location_id", locationId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch staff:", error);
      setStaffError("Unable to load staff members");
      setStaffMembers([]);
    } else {
      setStaffMembers((data as Staff[]) || []);
    }
    setStaffLoading(false);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("default_location_id, time_zone, handle")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDefaultLocationId(profile.default_location_id || null);
        setProfileTimezone(profile.time_zone || "America/New_York");
        setMerchantHandle(profile.handle || null);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    if (profileTimezone) {
      setNewLocationTimezone(profileTimezone);
    }
  }, [profileTimezone]);

  useEffect(() => {
    refreshLocations();
  }, [userId]);

  useEffect(() => {
    refreshStaff();
  }, [userId, locationId]);

  useEffect(() => {
    if (!userId || !locationId) return;

    const backfillStaffLocation = async () => {
      const { data: missingLocationStaff } = await supabase
        .from("staff")
        .select("id")
        .eq("merchant_id", userId)
        .is("location_id", null)
        .limit(1);

      if (!missingLocationStaff || missingLocationStaff.length === 0) {
        return;
      }

      await supabase
        .from("staff")
        .update({ location_id: locationId })
        .eq("merchant_id", userId)
        .is("location_id", null);
    };

    backfillStaffLocation();
  }, [userId, locationId]);

  const seatUsage = subscriptionData.seatUsage;
  const canAddStaff = seatUsage ? seatUsage.canAdd : true;
  const canAddLocationWithStaff = seatUsage ? seatUsage.canAdd : true;
  const activeLocation = locations.find((location) => location.id === locationId) || null;
  const showStaffLocationContext = locations.length > 1 && Boolean(activeLocation);

  const shareHost = useMemo(
    () => formatUrlForDisplay((import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, "")),
    []
  );
  const slugPrefix = merchantHandle ? `${shareHost}/${merchantHandle}/` : `${shareHost}/`;

  useEffect(() => {
    if (locationsLoading) return;
    setAddLocationOpen(locations.length === 0);
  }, [locations.length, locationsLoading]);

  useEffect(() => {
    if (staffLoading) return;
    setAddStaffOpen(staffMembers.length === 0);
  }, [staffMembers.length, staffLoading]);

  const handleAddStaff = async () => {
    if (!userId) return;
    if (!locationId) {
      toast({
        title: "Select a location",
        description: "Choose a location before adding staff members",
        variant: "destructive",
      });
      return;
    }
    setStaffNameError(null);

    const trimmedFirst = staffFirstName.trim();
    const trimmedLast = staffLastName.trim();

    if (!trimmedFirst) {
      setStaffNameError("First name is required");
      return;
    }

    if (!canAddStaff) {
      toast({
        title: "Upgrade required",
        description: "You've reached your staff seat limit. Upgrade to add more staff members",
        variant: "destructive",
      });
      return;
    }

    const fullName = normalizeName(trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst);
    const fullKey = normalizeKey(fullName);

    if (!trimmedLast) {
      const hasSameFirst = staffMembers.some((member) => firstNameKey(member.name || "") === normalizeKey(trimmedFirst));
      if (hasSameFirst) {
        setStaffNameError(`A staff member named ${trimmedFirst} already exists. Add a last name or initial.`);
        return;
      }
    }

    const hasDuplicateFull = staffMembers.some((member) => normalizeKey(member.name || "") === fullKey);
    if (hasDuplicateFull) {
      setStaffNameError(`A staff member named ${fullName} already exists.`);
      return;
    }

    setStaffAdding(true);
    const { error } = await supabase
      .from("staff")
      .insert({
        merchant_id: userId,
        name: fullName,
        is_primary: false,
        active: true,
        location_id: locationId || null,
      });

    setStaffAdding(false);

    if (error) {
      console.error("Failed to add staff member:", error);
      if (hasErrorTag(error, "SEAT_LIMIT_REACHED")) {
        await subscriptionData.refetch?.({ silent: true });
        toast({
          title: "Upgrade required",
          description: "You've reached your staff seat limit. Upgrade to add more staff members",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Unable to add staff",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    setStaffFirstName("");
    setStaffLastName("");
    setAddStaffOpen(false);
    await refreshStaff();
    await subscriptionData.refetch?.({ silent: true });
    toast({
      title: "Staff member added",
      description: `${fullName} can now be assigned to openings.`,
    });
  };

  const executeDeleteStaff = async (member: Staff) => {
    if (!userId || !member?.id) return;

    setStaffDeletingId(member.id);
    const { error } = await supabase.from("staff").delete().eq("id", member.id);
    setStaffDeletingId(null);

    if (error) {
      console.error("Failed to delete staff member:", error);
      if (hasErrorTag(error, "MIN_STAFF_LOCATION_REQUIRED")) {
        toast({
          title: "Can't remove the last staff member",
          description:
            "Every location needs at least one staff member for openings and notifications. Add another staff member first, or edit their name instead.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Unable to remove staff",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    setStaffDeleteBlock(null);
    await refreshStaff();
    await subscriptionData.refetch?.({ silent: true });
    toast({
      title: "Staff member removed",
      description: `${member.name || "Staff member"} was removed.`,
    });
  };

  const handleDeleteStaff = async (member: Staff) => {
    if (!userId || !member?.id) return;

    if (staffMembers.length <= 1) {
      const locationLabel = activeLocation?.name || "This location";
      toast({
        title: "Can't remove the last staff member",
        description: `${locationLabel} needs at least one staff member for openings and notifications. Add another staff member first, or edit their name instead.`,
        variant: "destructive",
      });
      return;
    }

    setStaffDeleteBlock(null);
    setStaffDeletingId(member.id);

    const { data: previewRows, error: previewError } = await supabase.rpc("preview_staff_deletion_slots", {
      p_staff_id: member.id,
    });

    if (previewError) {
      console.error("preview_staff_deletion_slots:", previewError);
      toast({
        title: "Unable to remove staff",
        description: "Please try again",
        variant: "destructive",
      });
      setStaffDeletingId(null);
      return;
    }

    const upcomingCount = Number((previewRows?.[0] as { upcoming_count?: number } | undefined)?.upcoming_count ?? 0);

    if (upcomingCount > 0) {
      setStaffDeleteBlock({ id: member.id, name: member.name || "This staff member", count: upcomingCount });
      setStaffDeletingId(null);
      return;
    }

    await executeDeleteStaff(member);
  };

  const startEditStaff = (member: Staff) => {
    const { first, last } = splitName(member.name || "");
    setStaffEditFirstName(first);
    setStaffEditLastName(last);
    setStaffEditError(null);
    setStaffEditingId(member.id);
  };

  const cancelEditStaff = () => {
    setStaffEditingId(null);
    setStaffEditFirstName("");
    setStaffEditLastName("");
    setStaffEditError(null);
  };

  const handleUpdateStaff = async (member: Staff) => {
    if (!userId || !member?.id) return;
    setStaffEditError(null);

    const trimmedFirst = staffEditFirstName.trim();
    const trimmedLast = staffEditLastName.trim();

    if (!trimmedFirst) {
      setStaffEditError("First name is required");
      return;
    }

    const fullName = normalizeName(trimmedLast ? `${trimmedFirst} ${trimmedLast}` : trimmedFirst);
    const fullKey = normalizeKey(fullName);

    if (!trimmedLast) {
      const hasSameFirst = staffMembers.some((existing) =>
        existing.id !== member.id && firstNameKey(existing.name || "") === normalizeKey(trimmedFirst)
      );
      if (hasSameFirst) {
        setStaffEditError(`A staff member named ${trimmedFirst} already exists. Add a last name or initial.`);
        return;
      }
    }

    const hasDuplicateFull = staffMembers.some((existing) =>
      existing.id !== member.id && normalizeKey(existing.name || "") === fullKey
    );
    if (hasDuplicateFull) {
      setStaffEditError(`A staff member named ${fullName} already exists.`);
      return;
    }

    setStaffUpdatingId(member.id);
    const { error } = await supabase
      .from("staff")
      .update({ name: fullName })
      .eq("id", member.id);

    setStaffUpdatingId(null);

    if (error) {
      console.error("Failed to update staff member:", error);
      toast({
        title: "Unable to update staff",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    await refreshStaff();
    await subscriptionData.refetch?.({ silent: true });
    cancelEditStaff();
    toast({
      title: "Staff member updated",
      description: `${fullName} was updated.`,
    });
  };

  const handleAddLocation = async () => {
    if (!userId) return;
    setNewLocationStaffError(null);
    setNewLocationPhoneError(null);

    const trimmedName = newLocationName.trim();
    if (!trimmedName) {
      toast({
        title: "Location name required",
        description: "Please enter a location name",
        variant: "destructive",
      });
      return;
    }

    const trimmedStaffFirst = newLocationStaffFirstName.trim();
    const trimmedStaffLast = newLocationStaffLastName.trim();
    if (!trimmedStaffFirst) {
      setNewLocationStaffError("Initial staff first name is required");
      return;
    }

    if (!canAddLocationWithStaff) {
      toast({
        title: "Upgrade required",
        description: "You've reached your staff seat limit. Upgrade to add another location with staff",
        variant: "destructive",
      });
      return;
    }

    const trimmedAddress = newLocationAddress.trim() || null;
    const trimmedPhone = newLocationPhone.trim() || null;
    const phoneError = getOptionalPhoneError(newLocationPhone);
    if (phoneError) {
      setNewLocationPhoneError(phoneError);
      return;
    }
    const resolvedTimezone = newLocationTimezone || profileTimezone || "America/New_York";
    const initialStaffName = normalizeName(trimmedStaffLast ? `${trimmedStaffFirst} ${trimmedStaffLast}` : trimmedStaffFirst);

    setLocationAdding(true);
    const { data, error } = await supabase.rpc("create_location_with_initial_staff", {
      p_name: trimmedName,
      p_address: trimmedAddress,
      p_phone: trimmedPhone,
      p_time_zone: resolvedTimezone,
      p_staff_name: initialStaffName,
    });

    setLocationAdding(false);

    if (error) {
      console.error("Failed to add location:", error);
      if (hasErrorTag(error, "SEAT_LIMIT_REACHED")) {
        toast({
          title: "Upgrade required",
          description: "You've reached your staff seat limit. Upgrade to add another location with staff",
          variant: "destructive",
        });
        return;
      }
      if (hasErrorTag(error, "INITIAL_STAFF_NAME_REQUIRED")) {
        setNewLocationStaffError("Initial staff first name is required");
        return;
      }
      toast({
        title: "Unable to add location",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    const createdLocationId =
      Array.isArray(data) && data.length > 0
        ? ((data[0] as { location_id?: string | null }).location_id || null)
        : null;

    if (!defaultLocationId && createdLocationId) {
      const { error: defaultError } = await supabase
        .from("profiles")
        .update({ default_location_id: createdLocationId })
        .eq("id", userId);

      if (!defaultError) {
        setDefaultLocationId(createdLocationId);
        await refreshActiveLocation();
      }
    }

    setNewLocationName("");
    setNewLocationAddress("");
    setNewLocationPhone("");
    setNewLocationStaffFirstName("");
    setNewLocationStaffLastName("");
    setNewLocationStaffError(null);
    setNewLocationPhoneError(null);
    setNewLocationTimezone(profileTimezone || "America/New_York");
    setAddLocationOpen(false);
    await refreshLocations();
    await subscriptionData.refetch?.({ silent: true });
    notifyLocationsUpdated();

    toast({
      title: "Location added",
      description: `${trimmedName} is ready to use with ${initialStaffName}.`,
    });
  };

  const startEditLocation = (location: LocationRecord) => {
    setLocationEditingId(location.id);
    setLocationEditName(location.name || "");
    setLocationEditSlug(location.share_slug || "");
    setLocationEditAddress(location.address || "");
    setLocationEditPhone(location.phone || "");
    setLocationEditPhoneError(null);
    setLocationEditSlugError(null);
    setLocationEditTimezone(location.time_zone || profileTimezone || "America/New_York");
  };

  const cancelEditLocation = () => {
    setLocationEditingId(null);
    setLocationEditName("");
    setLocationEditSlug("");
    setLocationEditAddress("");
    setLocationEditPhone("");
    setLocationEditPhoneError(null);
    setLocationEditSlugError(null);
    setLocationEditTimezone("America/New_York");
  };

  const handleUpdateLocation = async (location: LocationRecord) => {
    if (!userId || !location?.id) return;

    const trimmedName = locationEditName.trim();
    if (!trimmedName) {
      toast({
        title: "Location name required",
        description: "Please enter a location name",
        variant: "destructive",
      });
      return;
    }

    const trimmedAddress = locationEditAddress.trim() || null;
    const trimmedPhone = locationEditPhone.trim() || null;
    const phoneError = getOptionalPhoneError(locationEditPhone);
    if (phoneError) {
      setLocationEditPhoneError(phoneError);
      return;
    }
    setLocationEditSlugError(null);
    const normalizedSlug = normalizeLocationShareSlug(locationEditSlug);
    const slugValidation = validateLocationShareSlug(normalizedSlug);
    if (!slugValidation.ok) {
      setLocationEditSlugError(slugValidation.error);
      return;
    }

    if (normalizedSlug !== location.share_slug) {
      const { data: existingSlug, error: existingSlugError } = await supabase
        .from("locations")
        .select("id")
        .eq("merchant_id", userId)
        .eq("share_slug", normalizedSlug)
        .neq("id", location.id)
        .maybeSingle();

      if (existingSlugError) {
        toast({
          title: "Unable to validate location link",
          description: "Please try again",
          variant: "destructive",
        });
        return;
      }

      if (existingSlug) {
        setLocationEditSlugError("This location link is already in use");
        return;
      }
    }

    const resolvedTimezone = locationEditTimezone || profileTimezone || "America/New_York";

    setLocationSavingId(location.id);
    const { error } = await supabase
      .from("locations")
      .update({
        name: trimmedName,
        address: trimmedAddress,
        phone: trimmedPhone,
        time_zone: resolvedTimezone,
        share_slug: normalizedSlug,
      })
      .eq("id", location.id);

    setLocationSavingId(null);

    if (error) {
      console.error("Failed to update location:", error);
      toast({
        title: "Unable to update location",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    if (location.id === defaultLocationId) {
      await supabase
        .from("profiles")
        .update({
          address: trimmedAddress,
          phone: trimmedPhone,
          time_zone: resolvedTimezone,
        })
        .eq("id", userId);
    }

    await refreshLocations();
    notifyLocationsUpdated();
    cancelEditLocation();
    toast({
      title: "Location updated",
      description: `${trimmedName} was updated.`,
    });
  };

  const handleSetDefaultLocation = async (location: LocationRecord) => {
    if (!userId || !location?.id || location.id === defaultLocationId) return;

    setDefaultLocationUpdatingId(location.id);
    const { error } = await supabase
      .from("profiles")
      .update({ default_location_id: location.id })
      .eq("id", userId);

    setDefaultLocationUpdatingId(null);

    if (error) {
      console.error("Failed to update default location:", error);
      toast({
        title: "Unable to set default location",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    setDefaultLocationId(location.id);
    await refreshLocations();
    notifyLocationsUpdated();
    await refreshActiveLocation();

    toast({
      title: "Default location updated",
      description: `${location.name || "Location"} is now the default.`,
    });
  };

  const refreshLocationDeleteBlock = async (location: LocationRecord) => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("preview_location_deletion_slots", {
      p_location_id: location.id,
    });
    if (error || !data?.length) return;
    const row = data[0] as { upcoming_count: number; past_count: number };
    setLocationDeleteBlock({
      id: location.id,
      name: location.name || "This location",
      upcomingCount: Number(row.upcoming_count ?? 0),
      pastCount: Number(row.past_count ?? 0),
    });
  };

  const executeDeleteLocation = async (location: LocationRecord) => {
    if (!userId || !location?.id) return;

    setLocationDeletingId(location.id);
    const { error } = await supabase.rpc("delete_location_with_staff_cleanup", {
      p_location_id: location.id,
    });

    if (error) {
      console.error("Failed to delete location:", error);
      if (hasErrorTag(error, "LOCATION_HAS_OPENINGS")) {
        await refreshLocationDeleteBlock(location);
        setLocationDeletingId(null);
        return;
      }
      if (hasErrorTag(error, "DEFAULT_LOCATION_CANNOT_BE_DELETED")) {
        toast({
          title: "Cannot remove default location",
          description: "Set another location as default before deleting this one",
          variant: "destructive",
        });
        setLocationDeletingId(null);
        return;
      }
      if (hasErrorTag(error, "LAST_LOCATION_CANNOT_BE_DELETED")) {
        toast({
          title: "Cannot remove location",
          description: "You must keep at least one location",
          variant: "destructive",
        });
        setLocationDeletingId(null);
        return;
      }
      toast({
        title: "Unable to remove location",
        description: "Please try again",
        variant: "destructive",
      });
      setLocationDeletingId(null);
      return;
    }

    if (location.id === locationId && defaultLocationId) {
      setActiveLocationId(defaultLocationId);
    }

    setLocationDeleteBlock(null);
    await refreshLocations();
    await subscriptionData.refetch?.({ silent: true });
    notifyLocationsUpdated();
    setLocationDeletingId(null);
    toast({
      title: "Location removed",
      description: `${location.name || "Location"} was removed.`,
    });
  };

  const handleBeginRemoveLocation = async (location: LocationRecord) => {
    if (!userId || !location?.id) return;
    setLocationDeleteBlock(null);

    if (locations.length <= 1) {
      toast({
        title: "Cannot remove location",
        description: "You must keep at least one location",
        variant: "destructive",
      });
      return;
    }

    if (location.id === defaultLocationId) {
      toast({
        title: "Cannot remove default location",
        description: "Set another location as default before deleting this one",
        variant: "destructive",
      });
      return;
    }

    setLocationDeletingId(location.id);
    const { data: previewRows, error: previewError } = await supabase.rpc("preview_location_deletion_slots", {
      p_location_id: location.id,
    });

    if (previewError) {
      console.error("preview_location_deletion_slots:", previewError);
      toast({
        title: "Unable to remove location",
        description: "Please try again",
        variant: "destructive",
      });
      setLocationDeletingId(null);
      return;
    }

    const preview = previewRows?.[0] as { upcoming_count: number; past_count: number } | undefined;
    const upcomingCount = Number(preview?.upcoming_count ?? 0);
    const pastCount = Number(preview?.past_count ?? 0);

    if (upcomingCount > 0) {
      setLocationDeleteBlock({
        id: location.id,
        name: location.name || "This location",
        upcomingCount,
        pastCount,
      });
      setLocationDeletingId(null);
      return;
    }

    if (pastCount > 0) {
      setPastSlotsConfirm({ location, pastCount });
      setLocationDeletingId(null);
      return;
    }

    await executeDeleteLocation(location);
  };

  const handleConfirmBulkDeleteUpcoming = async () => {
    if (!bulkUpcomingConfirm || !userId) return;
    const { location } = bulkUpcomingConfirm;
    setBulkUpcomingConfirm(null);

    const { data: removed, error: softError } = await supabase.rpc("soft_delete_upcoming_slots_at_location", {
      p_location_id: location.id,
    });

    if (softError) {
      console.error("soft_delete_upcoming_slots_at_location:", softError);
      toast({
        title: "Could not remove upcoming openings",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    const n = typeof removed === "number" ? removed : 0;
    if (n > 0) {
      toast({
        title: "Upcoming openings removed",
        description: `${n} upcoming opening${n === 1 ? "" : "s"} ${n === 1 ? "was" : "were"} removed from your calendar.`,
      });
    }

    setLocationDeleteBlock(null);
    await executeDeleteLocation(location);
  };

  const handleConfirmBulkDeleteStaffUpcoming = async () => {
    if (!bulkStaffConfirm || !userId) return;
    const { id } = bulkStaffConfirm;
    setBulkStaffConfirm(null);

    const member = staffMembers.find((s) => s.id === id);
    if (!member) {
      setStaffDeleteBlock(null);
      return;
    }

    const { data: removed, error: softError } = await supabase.rpc("soft_delete_upcoming_slots_for_staff", {
      p_staff_id: id,
    });

    if (softError) {
      console.error("soft_delete_upcoming_slots_for_staff:", softError);
      toast({
        title: "Could not remove upcoming openings",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    const n = typeof removed === "number" ? removed : 0;
    if (n > 0) {
      toast({
        title: "Upcoming openings removed",
        description: `${n} upcoming opening${n === 1 ? "" : "s"} ${n === 1 ? "was" : "were"} removed from your calendar.`,
      });
    }

    await executeDeleteStaff(member);
  };

  const handleConfirmPastSlotsRemoval = async () => {
    if (!pastSlotsConfirm) return;
    const { location } = pastSlotsConfirm;
    setPastSlotsConfirm(null);
    await executeDeleteLocation(location);
  };

  const renderAddLocationForm = ({
    showTitle = false,
    footerCancel = false,
  }: {
    showTitle?: boolean;
    footerCancel?: boolean;
  } = {}) => (
    <div className="space-y-3">
      {showTitle && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Add another location</h3>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="new-location-name">Location name</Label>
          <Input
            id="new-location-name"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="e.g., Downtown Studio"
            className="mt-1"
            disabled={locationAdding}
          />
        </div>
        <div>
          <Label htmlFor="new-location-staff-first">Staff first name</Label>
          <Input
            id="new-location-staff-first"
            value={newLocationStaffFirstName}
            onChange={(e) => {
              setNewLocationStaffFirstName(e.target.value);
              if (newLocationStaffError) setNewLocationStaffError(null);
            }}
            placeholder="Staff first name"
            className="mt-1"
            disabled={locationAdding}
          />
        </div>
        <div>
          <Label htmlFor="new-location-staff-last">Staff last name</Label>
          <Input
            id="new-location-staff-last"
            value={newLocationStaffLastName}
            onChange={(e) => {
              setNewLocationStaffLastName(e.target.value);
              if (newLocationStaffError) setNewLocationStaffError(null);
            }}
            placeholder="Staff last name"
            className="mt-1"
            disabled={locationAdding}
          />
        </div>
        <div>
          <Label htmlFor="new-location-phone">Phone (optional)</Label>
          <PhoneInput
            value={newLocationPhone}
            onChange={(value) => {
              setNewLocationPhone(value || "");
              if (newLocationPhoneError) setNewLocationPhoneError(null);
            }}
            placeholder="(555) 123-4567"
            className="mt-1"
            error={!!newLocationPhoneError}
            disabled={locationAdding}
            onBlur={() => setNewLocationPhoneError(getOptionalPhoneError(newLocationPhone))}
          />
          {newLocationPhoneError && (
            <p className="text-sm text-destructive mt-1">{newLocationPhoneError}</p>
          )}
        </div>
        <div>
          <Label htmlFor="new-location-timezone">Time zone</Label>
          <Select
            value={newLocationTimezone}
            onValueChange={setNewLocationTimezone}
            disabled={locationAdding}
          >
            <SelectTrigger id="new-location-timezone" className="mt-1">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className={timezoneSelectItemClassName}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="new-location-address">Address (optional)</Label>
          <Input
            id="new-location-address"
            value={newLocationAddress}
            onChange={(e) => setNewLocationAddress(e.target.value)}
            placeholder="123 Main St, City, State"
            className="mt-1"
            disabled={locationAdding}
          />
        </div>
        {newLocationStaffError && (
          <p className="sm:col-span-2 text-xs text-destructive">{newLocationStaffError}</p>
        )}
      </div>
      <div className="flex gap-2 w-full pt-2 sm:justify-end">
        {footerCancel && (
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={locationAdding}
              className="flex-1 sm:flex-initial sm:min-w-[90px] min-h-[44px]"
            >
              Cancel
            </Button>
          </CollapsibleTrigger>
        )}
        <Button
          type="button"
          onClick={handleAddLocation}
          disabled={locationAdding}
          className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px] font-medium"
        >
          {locationAdding ? "Saving..." : "Save location"}
        </Button>
      </div>
    </div>
  );

  const renderAddStaffForm = ({
    showTitle = false,
    footerCancel = false,
  }: {
    showTitle?: boolean;
    footerCancel?: boolean;
  } = {}) => (
    <div className="space-y-3">
      {showTitle && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Add staff member</h3>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="staff-first-name">First name</Label>
          <Input
            id="staff-first-name"
            value={staffFirstName}
            onChange={(e) => {
              setStaffFirstName(e.target.value);
              if (staffNameError) setStaffNameError(null);
            }}
            placeholder="First name"
            className="mt-1"
            disabled={staffAdding}
          />
        </div>
        <div>
          <Label htmlFor="staff-last-name">Last name</Label>
          <Input
            id="staff-last-name"
            value={staffLastName}
            onChange={(e) => {
              setStaffLastName(e.target.value);
              if (staffNameError) setStaffNameError(null);
            }}
            placeholder="Last name"
            className="mt-1"
            disabled={staffAdding}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddStaff();
              }
            }}
          />
        </div>
        {staffNameError && (
          <p className="sm:col-span-2 text-xs text-destructive">{staffNameError}</p>
        )}
      </div>
      <div className="flex gap-2 w-full pt-2 sm:justify-end">
        {footerCancel && (
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={staffAdding}
              className="flex-1 sm:flex-initial sm:min-w-[90px] min-h-[44px]"
            >
              Cancel
            </Button>
          </CollapsibleTrigger>
        )}
        <Button
          type="button"
          onClick={handleAddStaff}
          disabled={staffAdding}
          className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px] font-medium"
        >
          {staffAdding ? "Saving..." : "Save staff"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6 pb-4" data-tour-target="staff-locations-content">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/merchant/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold mb-2">Staff & Locations</h1>
            <p className="text-muted-foreground">
              Manage team members, locations, and staff seats
            </p>
            <p className="text-xs text-muted-foreground mt-2">Changes save automatically</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
      <div className="space-y-6" data-setup-section="staff-locations">
      <SettingsSection
        title="Locations"
        description="Manage your locations and contact details"
        icon={MapPin}
        sectionId="locations"
        collapsible
        defaultOpen={false}
        open={locationsOpen}
        onOpenChange={setLocationsOpen}
      >
        {locationDeleteBlock && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Unable to remove location</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>{locationDeletionWarningBody(locationDeleteBlock.name, locationDeleteBlock.upcomingCount)}</p>
                <DeletionBlockActions
                  bulkLabel="Delete openings and location"
                  onBulkClick={() =>
                    setBulkUpcomingConfirm({
                      location: {
                        id: locationDeleteBlock.id,
                        name: locationDeleteBlock.name,
                        address: null,
                        phone: null,
                        time_zone: null,
                      },
                      upcomingCount: locationDeleteBlock.upcomingCount,
                    })
                  }
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {!locationsLoading && locations.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add multiple locations to keep openings and notifications organized
            </p>
          )}

          <div className="space-y-2">
            {locationsLoading ? (
              <SettingsListSkeleton rows={3} />
            ) : locationsError ? (
              <p className="text-sm text-destructive">{locationsError}</p>
            ) : locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations yet</p>
            ) : (
              locations.map((location) => {
                const timezoneLabel = TIMEZONE_OPTIONS.find((tz) => tz.value === location.time_zone)?.label || location.time_zone;
                const isDefault = location.id === defaultLocationId;
                const isUpdatingDefault = defaultLocationUpdatingId === location.id;
                const isEditing = locationEditingId === location.id;

                return (
                  <div
                    key={location.id}
                    className="rounded-lg border px-3 py-3"
                  >
                    {isEditing ? (
                      <>
                        <div className="grid w-full gap-2 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Label htmlFor={`location-edit-name-${location.id}`}>Location name</Label>
                            <Input
                              id={`location-edit-name-${location.id}`}
                              value={locationEditName}
                              onChange={(e) => setLocationEditName(e.target.value)}
                              className="mt-1"
                              disabled={locationSavingId === location.id}
                            />
                          </div>
                          <LocationShareLinkEdit
                            id={`location-edit-slug-${location.id}`}
                            slug={locationEditSlug}
                            slugPrefix={slugPrefix}
                            disabled={locationSavingId === location.id}
                            error={locationEditSlugError}
                            hasHandle={Boolean(merchantHandle)}
                            onSlugChange={(value) => {
                              setLocationEditSlug(value);
                              if (locationEditSlugError) setLocationEditSlugError(null);
                            }}
                          />
                          <div>
                            <Label htmlFor={`location-edit-phone-${location.id}`}>Phone (optional)</Label>
                            <PhoneInput
                              value={locationEditPhone}
                              onChange={(value) => {
                                setLocationEditPhone(value || "");
                                if (locationEditPhoneError) setLocationEditPhoneError(null);
                              }}
                              placeholder="(555) 123-4567"
                              className="mt-1"
                              error={!!locationEditPhoneError}
                              disabled={locationSavingId === location.id}
                              onBlur={() => setLocationEditPhoneError(getOptionalPhoneError(locationEditPhone))}
                            />
                            {locationEditPhoneError && (
                              <p className="text-sm text-destructive mt-1">{locationEditPhoneError}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor={`location-edit-timezone-${location.id}`}>Time zone</Label>
                            <Select
                              value={locationEditTimezone}
                              onValueChange={setLocationEditTimezone}
                              disabled={locationSavingId === location.id}
                            >
                              <SelectTrigger id={`location-edit-timezone-${location.id}`} className="mt-1">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIMEZONE_OPTIONS.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value} className={timezoneSelectItemClassName}>
                                    {tz.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-2">
                            <Label htmlFor={`location-edit-address-${location.id}`}>Address (optional)</Label>
                            <Input
                              id={`location-edit-address-${location.id}`}
                              value={locationEditAddress}
                              onChange={(e) => setLocationEditAddress(e.target.value)}
                              className="mt-1"
                              disabled={locationSavingId === location.id}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 w-full pt-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEditLocation}
                            disabled={locationSavingId === location.id}
                            className="flex-1 sm:flex-initial sm:min-w-[90px] min-h-[44px]"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleUpdateLocation(location)}
                            disabled={locationSavingId === location.id}
                            className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px] font-medium"
                          >
                            {locationSavingId === location.id ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium">{location.name || "Untitled location"}</div>
                              {isDefault ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Default</span>
                              ) : (
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                                  onClick={() => handleSetDefaultLocation(location)}
                                  disabled={isUpdatingDefault || locationDeletingId === location.id}
                                >
                                  {isUpdatingDefault ? "Setting..." : "Set as default"}
                                </button>
                              )}
                            </div>
                          </div>
                          <RowIconActions>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:bg-accent/10 hover:text-warning"
                              onClick={() => startEditLocation(location)}
                              disabled={locationDeletingId === location.id}
                              aria-label={`Edit ${location.name || "location"}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleBeginRemoveLocation(location)}
                              disabled={locationDeletingId === location.id}
                              aria-label={`Remove ${location.name || "location"}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </RowIconActions>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {location.address && (
                            <LocationMetadataLine icon={<MapPin className="h-3.5 w-3.5" />}>
                              {location.address}
                            </LocationMetadataLine>
                          )}
                          {location.phone && (
                            <LocationMetadataLine icon={<Phone className="h-3.5 w-3.5" />}>
                              {formatPhoneForDisplay(location.phone)}
                            </LocationMetadataLine>
                          )}
                          {timezoneLabel && (
                            <LocationMetadataLine icon={<Clock className="h-3.5 w-3.5" />}>
                              {timezoneLabel}
                            </LocationMetadataLine>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {!canAddLocationWithStaff ? (
            <SeatLimitBanner message="Staff seat limit reached. Add seats to create another location." />
          ) : locations.length === 0 ? (
            renderAddLocationForm()
          ) : (
            <Collapsible open={addLocationOpen} onOpenChange={setAddLocationOpen}>
              <CollapsibleContent>{renderAddLocationForm({ showTitle: true, footerCancel: true })}</CollapsibleContent>
              {!addLocationOpen && (
                <CollapsibleTrigger asChild>
                  <Button type="button" className="w-full min-h-[44px] sm:w-auto">
                    <Plus className="w-4 h-4 mr-1" />
                    Add another location
                  </Button>
                </CollapsibleTrigger>
              )}
            </Collapsible>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Staff Members"
        description={
          showStaffLocationContext ? (
            <>
              Shown on openings and notifications for{" "}
              <strong
                className="font-semibold"
                title={activeLocation?.name || "Selected location"}
              >
                {activeLocation?.name || "Selected location"}
              </strong>
            </>
          ) : (
            "Shown on openings and notifications"
          )
        }
        icon={Users}
        sectionId="staff-members"
        collapsible
        defaultOpen={false}
        open={staffOpen}
        onOpenChange={setStaffOpen}
      >
        {staffDeleteBlock && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Unable to remove staff member</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>{staffDeletionWarningBody(staffDeleteBlock.name, staffDeleteBlock.count)}</p>
                <DeletionBlockActions
                  bulkLabel="Delete openings and remove staff"
                  onBulkClick={() =>
                    setBulkStaffConfirm({
                      id: staffDeleteBlock.id,
                      name: staffDeleteBlock.name,
                      count: staffDeleteBlock.count,
                    })
                  }
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            {staffLoading ? (
              <SettingsListSkeleton rows={3} />
            ) : staffError ? (
              <p className="text-sm text-destructive">{staffError}</p>
            ) : staffMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff members found for this location. Each location needs at least one — add a staff member below.
              </p>
            ) : (
              staffMembers.map((member) => {
                const isEditing = staffEditingId === member.id;

                return (
                  <div key={member.id} className="rounded-lg border px-3 py-3">
                    {isEditing ? (
                      <>
                        <div className="grid w-full gap-2 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`staff-edit-first-${member.id}`}>First name</Label>
                            <Input
                              id={`staff-edit-first-${member.id}`}
                              value={staffEditFirstName}
                              onChange={(e) => setStaffEditFirstName(e.target.value)}
                              className="mt-1"
                              disabled={staffUpdatingId === member.id}
                              placeholder="First name"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`staff-edit-last-${member.id}`}>Last name</Label>
                            <Input
                              id={`staff-edit-last-${member.id}`}
                              value={staffEditLastName}
                              onChange={(e) => setStaffEditLastName(e.target.value)}
                              className="mt-1"
                              disabled={staffUpdatingId === member.id}
                              placeholder="Last name"
                            />
                          </div>
                          {staffEditError && (
                            <p className="text-xs text-destructive sm:col-span-2">{staffEditError}</p>
                          )}
                        </div>
                        <div className="flex gap-2 w-full pt-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEditStaff}
                            disabled={staffUpdatingId === member.id}
                            className="flex-1 sm:flex-initial sm:min-w-[90px] min-h-[44px]"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleUpdateStaff(member)}
                            disabled={staffUpdatingId === member.id}
                            className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px] font-medium"
                          >
                            {staffUpdatingId === member.id ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 text-sm font-medium">{member.name}</div>
                        <RowIconActions>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-accent/10 hover:text-warning"
                            onClick={() => startEditStaff(member)}
                            disabled={staffDeletingId === member.id}
                            aria-label={`Edit ${member.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteStaff(member)}
                            disabled={staffDeletingId === member.id}
                            aria-label={`Remove ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </RowIconActions>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {!canAddStaff ? (
            <SeatLimitBanner message="Staff seat limit reached. Add seats to continue adding staff members." />
          ) : staffMembers.length === 0 ? (
            renderAddStaffForm()
          ) : (
            <Collapsible open={addStaffOpen} onOpenChange={setAddStaffOpen}>
              <CollapsibleContent>{renderAddStaffForm({ showTitle: true, footerCancel: true })}</CollapsibleContent>
              {!addStaffOpen && (
                <CollapsibleTrigger asChild>
                  <Button type="button" className="w-full min-h-[44px] sm:w-auto">
                    <Plus className="w-4 h-4 mr-1" />
                    Add staff member
                  </Button>
                </CollapsibleTrigger>
              )}
            </Collapsible>
          )}
        </div>
      </SettingsSection>
      </div>

      <Link
        to="/merchant/billing"
        state={{ backTo: "/merchant/settings/staff-locations" }}
        aria-label="Manage subscription"
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <SettingsSection
          title="Staff Seats"
          description="Manage the number of staff on your plan"
          icon={CreditCard}
          className="cursor-pointer"
          headerAction={<ChevronRight className="h-5 w-5 text-muted-foreground" />}
        >
          {null}
        </SettingsSection>
      </Link>
      </div>

      <AlertDialog
        open={!!pastSlotsConfirm}
        onOpenChange={(open) => {
          if (!open) setPastSlotsConfirm(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this location?</AlertDialogTitle>
            <AlertDialogDescription>
              {pastSlotsConfirm ? (
                <>
                  {pastSlotsConfirm.location.name || "This location"} has {pastSlotsConfirm.pastCount} past opening
                  {pastSlotsConfirm.pastCount === 1 ? "" : "s"} or booking{pastSlotsConfirm.pastCount === 1 ? "" : "s"}. Removing the
                  location will not erase that history; those records will simply no longer be tied to this address.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmPastSlotsRemoval()}
            >
              Remove location
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!bulkUpcomingConfirm}
        onOpenChange={(open) => {
          if (!open) setBulkUpcomingConfirm(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete openings and remove location?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkUpcomingConfirm
                ? bulkDeleteLocationModalBody(
                    bulkUpcomingConfirm.location.name || "this location",
                    bulkUpcomingConfirm.upcomingCount,
                  )
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmBulkDeleteUpcoming();
              }}
            >
              Delete and remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!bulkStaffConfirm}
        onOpenChange={(open) => {
          if (!open) setBulkStaffConfirm(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete openings and remove staff?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkStaffConfirm ? bulkDeleteStaffModalBody(bulkStaffConfirm.name, bulkStaffConfirm.count) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmBulkDeleteStaffUpcoming();
              }}
            >
              Delete and remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StaffLocations;
