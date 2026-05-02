import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Users, ArrowLeft, ChevronRight, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Staff } from "@/types/openings";
import { useSubscription } from "@/hooks/useSubscription";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { TIMEZONE_OPTIONS } from "@/types/onboarding";
import { useActiveLocation } from "@/hooks/useActiveLocation";

interface LocationRecord {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  time_zone: string | null;
  created_at?: string | null;
}

const StaffLocations = () => {
  const { toast } = useToast();
  const subscriptionData = useSubscription();
  const { locationId, setActiveLocationId, refresh: refreshActiveLocation } = useActiveLocation();

  const [userId, setUserId] = useState<string | null>(null);
  const [profileTimezone, setProfileTimezone] = useState("America/New_York");
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);

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

  const [locationEditingId, setLocationEditingId] = useState<string | null>(null);
  const [locationEditName, setLocationEditName] = useState("");
  const [locationEditAddress, setLocationEditAddress] = useState("");
  const [locationEditPhone, setLocationEditPhone] = useState("");
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

  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffNameError, setStaffNameError] = useState<string | null>(null);
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
      .select("id, name, address, phone, time_zone, created_at")
      .eq("merchant_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch locations:", error);
      setLocationsError("Unable to load locations.");
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
      setStaffError("Unable to load staff members.");
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
        .select("default_location_id, time_zone")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDefaultLocationId(profile.default_location_id || null);
        setProfileTimezone(profile.time_zone || "America/New_York");
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

  const handleAddStaff = async () => {
    if (!userId) return;
    if (!locationId) {
      toast({
        title: "Select a location",
        description: "Choose a location before adding staff members.",
        variant: "destructive",
      });
      return;
    }
    setStaffNameError(null);

    const trimmedFirst = staffFirstName.trim();
    const trimmedLast = staffLastName.trim();

    if (!trimmedFirst) {
      setStaffNameError("First name is required.");
      return;
    }

    if (!canAddStaff) {
      toast({
        title: "Upgrade required",
        description: "You've reached your staff seat limit. Upgrade to add more staff members.",
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
      toast({
        title: "Unable to add staff",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setStaffFirstName("");
    setStaffLastName("");
    await refreshStaff();
    await subscriptionData.refetch?.({ silent: true });
    toast({
      title: "Staff member added",
      description: `${fullName} can now be assigned to openings.`,
    });
  };

  const handleDeleteStaff = async (member: Staff) => {
    if (!userId || !member?.id) return;

    if (staffMembers.length <= 1) {
      toast({
        title: "Cannot remove staff member",
        description: "Each location needs at least one staff member. You can edit their name instead.",
        variant: "destructive",
      });
      return;
    }

    setStaffDeleteBlock(null);
    setStaffDeletingId(member.id);

    const nowIso = new Date().toISOString();
    const { count, error: countError } = await supabase
      .from("slots")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", userId)
      .eq("staff_id", member.id)
      .is("deleted_at", null)
      .or(`end_time.gte.${nowIso},and(end_time.is.null,start_time.gte.${nowIso})`);

    if (countError) {
      console.error("Failed to check staff openings:", countError);
    }

    if ((count || 0) > 0) {
      setStaffDeleteBlock({ id: member.id, name: member.name || "This staff member", count: count || 0 });
      setStaffDeletingId(null);
      return;
    }

    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", member.id);

    setStaffDeletingId(null);

    if (error) {
      console.error("Failed to delete staff member:", error);
      if (hasErrorTag(error, "MIN_STAFF_LOCATION_REQUIRED")) {
        toast({
          title: "Cannot remove staff member",
          description: "Each enforced location must keep at least one active staff member.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Unable to remove staff",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    await refreshStaff();
    await subscriptionData.refetch?.({ silent: true });
    toast({
      title: "Staff member removed",
      description: `${member.name || "Staff member"} was removed.`,
    });
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
      setStaffEditError("First name is required.");
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
        description: "Please try again.",
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

    const trimmedName = newLocationName.trim();
    if (!trimmedName) {
      toast({
        title: "Location name required",
        description: "Please enter a location name.",
        variant: "destructive",
      });
      return;
    }

    const trimmedStaffFirst = newLocationStaffFirstName.trim();
    const trimmedStaffLast = newLocationStaffLastName.trim();
    if (!trimmedStaffFirst) {
      setNewLocationStaffError("Initial staff first name is required.");
      return;
    }

    if (!canAddLocationWithStaff) {
      toast({
        title: "Upgrade required",
        description: "You've reached your staff seat limit. Upgrade to add another location with staff.",
        variant: "destructive",
      });
      return;
    }

    const trimmedAddress = newLocationAddress.trim() || null;
    const trimmedPhone = newLocationPhone.trim() || null;
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
          description: "You've reached your staff seat limit. Upgrade to add another location with staff.",
          variant: "destructive",
        });
        return;
      }
      if (hasErrorTag(error, "INITIAL_STAFF_NAME_REQUIRED")) {
        setNewLocationStaffError("Initial staff first name is required.");
        return;
      }
      toast({
        title: "Unable to add location",
        description: "Please try again.",
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
    setNewLocationTimezone(profileTimezone || "America/New_York");
    await refreshLocations();
    notifyLocationsUpdated();

    toast({
      title: "Location added",
      description: `${trimmedName} is ready to use with ${initialStaffName}.`,
    });
  };

  const startEditLocation = (location: LocationRecord) => {
    setLocationEditingId(location.id);
    setLocationEditName(location.name || "");
    setLocationEditAddress(location.address || "");
    setLocationEditPhone(location.phone || "");
    setLocationEditTimezone(location.time_zone || profileTimezone || "America/New_York");
  };

  const cancelEditLocation = () => {
    setLocationEditingId(null);
    setLocationEditName("");
    setLocationEditAddress("");
    setLocationEditPhone("");
    setLocationEditTimezone("America/New_York");
  };

  const handleUpdateLocation = async (location: LocationRecord) => {
    if (!userId || !location?.id) return;

    const trimmedName = locationEditName.trim();
    if (!trimmedName) {
      toast({
        title: "Location name required",
        description: "Please enter a location name.",
        variant: "destructive",
      });
      return;
    }

    const trimmedAddress = locationEditAddress.trim() || null;
    const trimmedPhone = locationEditPhone.trim() || null;
    const resolvedTimezone = locationEditTimezone || profileTimezone || "America/New_York";

    setLocationSavingId(location.id);
    const { error } = await supabase
      .from("locations")
      .update({
        name: trimmedName,
        address: trimmedAddress,
        phone: trimmedPhone,
        time_zone: resolvedTimezone,
      })
      .eq("id", location.id);

    setLocationSavingId(null);

    if (error) {
      console.error("Failed to update location:", error);
      toast({
        title: "Unable to update location",
        description: "Please try again.",
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
        description: "Please try again.",
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
          description: "Set another location as default before deleting this one.",
          variant: "destructive",
        });
        setLocationDeletingId(null);
        return;
      }
      if (hasErrorTag(error, "LAST_LOCATION_CANNOT_BE_DELETED")) {
        toast({
          title: "Cannot remove location",
          description: "You must keep at least one location.",
          variant: "destructive",
        });
        setLocationDeletingId(null);
        return;
      }
      toast({
        title: "Unable to remove location",
        description: "Please try again.",
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
        description: "You must keep at least one location.",
        variant: "destructive",
      });
      return;
    }

    if (location.id === defaultLocationId) {
      toast({
        title: "Cannot remove default location",
        description: "Set another location as default before deleting this one.",
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
        description: "Please try again.",
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
        description: "Please try again.",
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

  const handleConfirmPastSlotsRemoval = async () => {
    if (!pastSlotsConfirm) return;
    const { location } = pastSlotsConfirm;
    setPastSlotsConfirm(null);
    await executeDeleteLocation(location);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-4">
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
              Manage team members, locations, and staff seats.
            </p>
            <p className="text-xs text-muted-foreground mt-2">Changes save automatically.</p>
          </div>
        </div>
      </div>

      <SettingsSection
        title="Locations"
        description="Manage your locations and contact details"
        icon={MapPin}
        collapsible
        defaultOpen={false}
      >
        {locationDeleteBlock && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Unable to remove location</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>
                  {locationDeleteBlock.name} has {locationDeleteBlock.upcomingCount} upcoming opening
                  {locationDeleteBlock.upcomingCount === 1 ? "" : "s"} or booking
                  {locationDeleteBlock.upcomingCount === 1 ? "" : "s"}. Remove or move them, then try again.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" asChild size="sm" className="w-fit">
                    <Link to="/merchant/openings">Go to Openings</Link>
                  </Button>
                  <button
                    type="button"
                    className="text-left text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground sm:text-right"
                    onClick={() =>
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
                  >
                    Bulk delete upcoming openings and this location
                  </button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Your locations</div>
            <p className="text-xs text-muted-foreground">
              Add multiple locations to keep openings and notifications organized.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {locations.length} location{locations.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="new-location-name">Location name</Label>
            <Input
              id="new-location-name"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="e.g., Downtown Studio"
              disabled={locationAdding}
            />
          </div>
          <div>
            <Label htmlFor="new-location-staff-first">Initial staff first name</Label>
            <Input
              id="new-location-staff-first"
              value={newLocationStaffFirstName}
              onChange={(e) => {
                setNewLocationStaffFirstName(e.target.value);
                if (newLocationStaffError) setNewLocationStaffError(null);
              }}
              placeholder="First name"
              disabled={locationAdding}
            />
          </div>
          <div>
            <Label htmlFor="new-location-staff-last">Initial staff last name or initial</Label>
            <Input
              id="new-location-staff-last"
              value={newLocationStaffLastName}
              onChange={(e) => {
                setNewLocationStaffLastName(e.target.value);
                if (newLocationStaffError) setNewLocationStaffError(null);
              }}
              placeholder="Last name or initial"
              disabled={locationAdding}
            />
          </div>
          <div>
            <Label htmlFor="new-location-phone">Phone (optional)</Label>
            <PhoneInput
              value={newLocationPhone}
              onChange={(value) => setNewLocationPhone(value || "")}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="new-location-timezone">Time zone</Label>
            <Select value={newLocationTimezone} onValueChange={setNewLocationTimezone}>
              <SelectTrigger id="new-location-timezone" className="mt-1">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
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
          <div className="sm:col-span-2 flex items-end">
            <Button
              type="button"
              onClick={handleAddLocation}
              disabled={locationAdding || !canAddLocationWithStaff}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              {locationAdding ? "Adding..." : "Add location"}
            </Button>
          </div>
          {newLocationStaffError && (
            <p className="sm:col-span-2 text-xs text-destructive">{newLocationStaffError}</p>
          )}
        </div>

        {!canAddLocationWithStaff && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                You&apos;re at your staff seat limit. Upgrade to add another location.
              </p>
              <Button variant="ghost" asChild size="sm" className="h-auto justify-start px-2 py-1 text-sm sm:justify-center">
                <Link to="/merchant/billing">Upgrade</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {locationsLoading ? (
            <p className="text-sm text-muted-foreground">Loading locations...</p>
          ) : locationsError ? (
            <p className="text-sm text-destructive">{locationsError}</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No locations yet.</p>
          ) : (
            locations.map((location) => {
              const timezoneLabel = TIMEZONE_OPTIONS.find((tz) => tz.value === location.time_zone)?.label || location.time_zone;
              const isDefault = location.id === defaultLocationId;
              const isUpdatingDefault = defaultLocationUpdatingId === location.id;

              return (
                <div
                  key={location.id}
                  className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  {locationEditingId === location.id ? (
                    <>
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor={`location-edit-name-${location.id}`} className="text-xs">
                            Location name
                          </Label>
                          <Input
                            id={`location-edit-name-${location.id}`}
                            value={locationEditName}
                            onChange={(e) => setLocationEditName(e.target.value)}
                            disabled={locationSavingId === location.id}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`location-edit-phone-${location.id}`} className="text-xs">
                            Phone
                          </Label>
                          <PhoneInput
                            value={locationEditPhone}
                            onChange={(value) => setLocationEditPhone(value || "")}
                            placeholder="(555) 123-4567"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`location-edit-timezone-${location.id}`} className="text-xs">
                            Time zone
                          </Label>
                          <Select value={locationEditTimezone} onValueChange={setLocationEditTimezone}>
                            <SelectTrigger id={`location-edit-timezone-${location.id}`} className="mt-1">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONE_OPTIONS.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                  {tz.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor={`location-edit-address-${location.id}`} className="text-xs">
                            Address
                          </Label>
                          <Input
                            id={`location-edit-address-${location.id}`}
                            value={locationEditAddress}
                            onChange={(e) => setLocationEditAddress(e.target.value)}
                            disabled={locationSavingId === location.id}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleUpdateLocation(location)}
                          disabled={locationSavingId === location.id}
                        >
                          {locationSavingId === location.id ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditLocation}
                          disabled={locationSavingId === location.id}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{location.name || "Untitled location"}</div>
                          {isDefault && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Default</span>
                          )}
                        </div>
                        {location.address && (
                          <div className="text-xs text-muted-foreground">{location.address}</div>
                        )}
                        {location.phone && (
                          <div className="text-xs text-muted-foreground">{location.phone}</div>
                        )}
                        {timezoneLabel && (
                          <div className="text-xs text-muted-foreground">{timezoneLabel}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isDefault && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefaultLocation(location)}
                            disabled={isUpdatingDefault || locationDeletingId === location.id}
                          >
                            {isUpdatingDefault ? "Setting..." : "Set as default"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditLocation(location)}
                          disabled={locationDeletingId === location.id}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleBeginRemoveLocation(location)}
                          disabled={locationDeletingId === location.id}
                        >
                          {locationDeletingId === location.id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Staff Members"
        description="Manage staff names shown in openings and notifications"
        icon={Users}
        headerAction={showStaffLocationContext ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Current location:</span>
            <span className="sm:hidden">Location:</span>
            <Badge variant="secondary" className="max-w-[180px] truncate font-semibold" title={activeLocation?.name || "Selected location"}>
              {activeLocation?.name || "Selected location"}
            </Badge>
          </div>
        ) : undefined}
        collapsible
        defaultOpen={false}
      >
        {staffDeleteBlock && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>Unable to remove staff member</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {staffDeleteBlock.name} has {staffDeleteBlock.count} upcoming opening{staffDeleteBlock.count === 1 ? "" : "s"} assigned.
                  Reassign or cancel these openings, then try again.
                </p>
                <Button variant="outline" asChild size="sm">
                  <Link to="/merchant/openings">Go to Openings</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!canAddStaff && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Staff seat limit reached. Upgrade to add more staff members.</p>
              <Button variant="ghost" asChild size="sm" className="h-auto justify-start px-2 py-1 text-sm sm:justify-center">
                <Link to="/merchant/billing">Upgrade</Link>
              </Button>
            </div>
          </div>
        )}

        {staffMembers.length <= 1 && (
          <div className="text-sm text-muted-foreground">
            Add additional staff members so notifications and openings can be attributed to the right person.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="staff-first-name" className="sr-only">First name</Label>
            <Input
              id="staff-first-name"
              value={staffFirstName}
              onChange={(e) => setStaffFirstName(e.target.value)}
              placeholder="First name"
              disabled={!canAddStaff || staffAdding}
            />
          </div>
          <div>
            <Label htmlFor="staff-last-name" className="sr-only">Last name or initial</Label>
            <Input
              id="staff-last-name"
              value={staffLastName}
              onChange={(e) => setStaffLastName(e.target.value)}
              placeholder="Last name or initial"
              disabled={!canAddStaff || staffAdding}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddStaff();
                }
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={handleAddStaff}
              disabled={!canAddStaff || staffAdding}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              {staffAdding ? "Adding..." : "Add staff"}
            </Button>
          </div>
        </div>

        {staffNameError && (
          <p className="text-xs text-destructive">{staffNameError}</p>
        )}

        <div className="space-y-2">
          {staffLoading ? (
            <p className="text-sm text-muted-foreground">Loading staff...</p>
          ) : staffError ? (
            <p className="text-sm text-destructive">{staffError}</p>
          ) : staffMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff members yet.</p>
          ) : (
            staffMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                {staffEditingId === member.id ? (
                  <>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`staff-edit-first-${member.id}`} className="sr-only">First name</Label>
                        <Input
                          id={`staff-edit-first-${member.id}`}
                          value={staffEditFirstName}
                          onChange={(e) => setStaffEditFirstName(e.target.value)}
                          disabled={staffUpdatingId === member.id}
                          placeholder="First name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`staff-edit-last-${member.id}`} className="sr-only">Last name or initial</Label>
                        <Input
                          id={`staff-edit-last-${member.id}`}
                          value={staffEditLastName}
                          onChange={(e) => setStaffEditLastName(e.target.value)}
                          disabled={staffUpdatingId === member.id}
                          placeholder="Last name or initial"
                        />
                      </div>
                      {staffEditError && (
                        <p className="text-xs text-destructive sm:col-span-2">{staffEditError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleUpdateStaff(member)}
                        disabled={staffUpdatingId === member.id}
                      >
                        {staffUpdatingId === member.id ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditStaff}
                        disabled={staffUpdatingId === member.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditStaff(member)}
                        disabled={staffDeletingId === member.id}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStaff(member)}
                        disabled={staffDeletingId === member.id}
                      >
                        {staffDeletingId === member.id ? "Removing..." : "Remove"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      <AlertDialog
        open={!!pastSlotsConfirm}
        onOpenChange={(open) => {
          if (!open) setPastSlotsConfirm(null);
        }}
      >
        <AlertDialogContent>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete upcoming openings?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkUpcomingConfirm ? (
                <>
                  This removes {bulkUpcomingConfirm.upcomingCount} upcoming opening
                  {bulkUpcomingConfirm.upcomingCount === 1 ? "" : "s"} or booking
                  {bulkUpcomingConfirm.upcomingCount === 1 ? "" : "s"} at {bulkUpcomingConfirm.location.name || "this location"}, then
                  removes the location. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void handleConfirmBulkDeleteUpcoming()}>
              Delete upcoming and remove location
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  );
};

export default StaffLocations;
